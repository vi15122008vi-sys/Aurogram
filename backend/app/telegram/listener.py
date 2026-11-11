from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

from telethon import events
from telethon.errors import AuthKeyUnregisteredError, FloodWaitError
from telethon import utils
from telethon.tl.types import PeerChannel

from app.config import get_settings
from app.database import fetchall, execute, init_db
from app.telegram.client import drop_client, get_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s listener %(levelname)s %(message)s")
log = logging.getLogger("aurogram.listener")

_started_at = time.time()
_errors_24h = 0
_last_message_at: float | None = None
_status = "ok"


def _marked_channel_id(channel_id: int) -> int:
    channel_id = int(channel_id)
    if channel_id < 0:
        return channel_id
    return utils.get_peer_id(PeerChannel(channel_id))


async def _write_heartbeat(accounts_active: int) -> None:
    from app.cache.index import update_listener_heartbeat

    global _status
    await update_listener_heartbeat(
        {
            "status": _status,
            "uptime": int(time.time() - _started_at),
            "accounts_active": accounts_active,
            "last_message_at": (
                datetime.fromtimestamp(_last_message_at, tz=timezone.utc).isoformat()
                if _last_message_at
                else None
            ),
            "errors_24h": _errors_24h,
            "ts": datetime.now(tz=timezone.utc).isoformat(),
        }
    )


async def _catch_up(account: dict, client: Any) -> None:
    """Doge offset_date for active chats with backoff."""
    from app.cache.manager import get_chat_offsets, upsert_chat, upsert_message

    offsets = await get_chat_offsets(account["id"])
    dialogs = await client.get_dialogs(limit=50)
    for d in dialogs:
        chat_id = d.id
        offset_date = offsets.get(chat_id)
        try:
            await upsert_chat(account["id"], chat_id, d.entity, d.message, d.unread_count)
            messages = await client.get_messages(chat_id, limit=40, offset_date=offset_date)
            for m in reversed(list(messages) or []):
                await upsert_message(account["id"], chat_id, m)
            log.info("account %s: +%s catch-up messages chat %s", account["id"][:8], len(messages or []), chat_id)
        except FloodWaitError as e:
            await asyncio.sleep(e.seconds + 1)
        except Exception as e:
            log.warning("catch-up failed account %s chat %s: %s", account["id"][:8], chat_id, e)


async def _on_new_message(account: dict, event: Any) -> None:
    global _last_message_at, _errors_24h
    from app.cache.manager import upsert_message
    from app.antispam.checker import check_message
    from app.antispam.actions import apply_verdict
    from app.antispam.settings import load_channel_settings
    from app.database import fetchall as db_fetchall

    _last_message_at = time.time()
    msg = event.message
    chat_id = event.chat_id
    moderated = False
    await upsert_message(account["id"], chat_id, msg)

    # Antispam only in linked discussion chats
    if isinstance(getattr(msg, "peer_id", None), PeerChannel):
        rows = await db_fetchall(
            "SELECT channel_id, antispam_json FROM channel_settings WHERE account_id = ?",
            (account["id"],),
        )
        for row in rows:
            settings = load_channel_settings(row["antispam_json"])
            if not settings.enabled:
                continue
            try:
                from app.telegram.channels import get_linked_chat_id

                linked = await get_linked_chat_id(account, int(row["channel_id"]))
                if linked and _marked_channel_id(chat_id) == _marked_channel_id(linked):
                    verdict = await check_message(
                        msg,
                        settings,
                        account_id=account["id"],
                        channel_id=int(row["channel_id"]),
                    )
                    if verdict.action != "allow":
                        moderated = True
                        client = await get_client(account["id"], account)
                        await apply_verdict(
                            client,
                            msg,
                            verdict,
                            settings,
                            account_id=account["id"],
                            channel_id=int(row["channel_id"]),
                        )
                    break
            except Exception as e:
                _errors_24h += 1
                log.warning("antispam error account %s: %s", account["id"][:8], e)

    if not msg.out and not moderated:
        try:
            from app.notifications import send_push

            await send_push(
                account["id"],
                {"title": "Aurogram", "body": "Новое сообщение", "url": "/chats"},
            )
        except Exception as e:
            log.warning("push notification failed account %s: %s", account["id"][:8], e)


async def _run_account(account: dict, device_id: str) -> None:
    global _status, _errors_24h
    try:
        client = await get_client(account["id"], account, device_id)
        await _catch_up(account, client)

        @client.on(events.NewMessage)
        async def handler(event: Any) -> None:  # noqa: ANN401
            await _on_new_message(account, event)

        log.info("account %s device %s: listening", account["id"][:8], device_id[:8])
        await client.run_until_disconnected()
    except AuthKeyUnregisteredError:
        log.error("account %s: session invalidated", account["id"][:8])
        await execute("UPDATE accounts SET auth_state = 'dead' WHERE id = ?", (account["id"],))
        await drop_client(account["id"])
    except Exception as e:
        _errors_24h += 1
        _status = "reconnecting"
        log.exception("account %s crashed: %s", account["id"][:8], e)
        await asyncio.sleep(5)


async def _cleanup_loop() -> None:
    from app.cache.cleanup import run_cleanup

    settings = get_settings()
    while True:
        try:
            await run_cleanup()
        except Exception as e:
            log.warning("cleanup failed: %s", e)
        await asyncio.sleep(max(60, settings.cache_cleanup_interval_min * 60))


async def _heartbeat_loop() -> None:
    while True:
        try:
            rows = await fetchall("SELECT id FROM accounts WHERE auth_state = 'ok'")
            await _write_heartbeat(len(rows))
        except Exception as e:
            log.warning("heartbeat write failed: %s", e)
        await asyncio.sleep(30)


async def main() -> None:
    await init_db()
    settings = get_settings()
    log.info("listener start cache_dir=%s", settings.cache_dir)

    background = [
        asyncio.create_task(_heartbeat_loop(), name="listener-heartbeat"),
        asyncio.create_task(_cleanup_loop(), name="cache-cleanup"),
    ]
    running: dict[str, asyncio.Task] = {}
    try:
        while True:
            rows = await fetchall("SELECT accounts.*, account_devices.device_id FROM accounts JOIN account_devices ON account_devices.account_id = accounts.id WHERE accounts.auth_state = 'ok'")
            alive_ids = {f"{r['id']}:{r['device_id']}" for r in rows}
            for session_key, task in list(running.items()):
                if session_key not in alive_ids or task.done():
                    task.cancel()
                    running.pop(session_key, None)
            for row in rows:
                device_id = row["device_id"]
                session_key = f"{row['id']}:{device_id}"
                if session_key not in running:
                    running[session_key] = asyncio.create_task(_run_account(dict(row), device_id), name=f"session-{session_key}")
            global _status
            _status = "ok"
            await asyncio.sleep(15)
    finally:
        tasks = [*background, *running.values()]
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


if __name__ == "__main__":
    asyncio.run(main())
