from __future__ import annotations

import logging
from typing import Any

from telethon.tl.functions.channels import EditBannedRequest
from telethon.tl.types import ChatBannedRights

from app.antispam.log import write_log
from app.models import AntiSpamSettings, Verdict
from app.telegram.floodwait import with_floodwait

log = logging.getLogger("aurogram.antispam")


async def apply_verdict(
    client: Any,
    msg: Any,
    verdict: Verdict,
    settings: AntiSpamSettings,
    account_id: str,
    channel_id: int,
) -> None:
    chat = await msg.get_chat()
    sender = await msg.get_sender()
    user_id = getattr(sender, "id", None)

    # Always delete on non-allow (delete cannot be disabled)
    if verdict.action in {"delete", "mute", "ban", "warn"}:
        try:
            await with_floodwait(lambda: msg.delete())
        except Exception as e:
            log.warning("delete failed: %s", e)

    if verdict.action == "mute" and user_id and settings.mute_on_repeat:
        minutes = max(1, settings.mute_minutes)
        rights = ChatBannedRights(until_date=None, send_messages=True)
        # until_date relative: Telethon accepts datetime; use seconds via until_date offset
        from datetime import datetime, timedelta, timezone

        until = datetime.now(tz=timezone.utc) + timedelta(minutes=minutes)
        rights = ChatBannedRights(until_date=until, send_messages=True)
        try:
            await with_floodwait(
                lambda: client(EditBannedRequest(chat, user_id, rights))
            )
        except Exception as e:
            log.warning("mute failed: %s", e)

    if verdict.action == "ban" and user_id:
        rights = ChatBannedRights(until_date=None, view_messages=True)
        try:
            await with_floodwait(
                lambda: client(EditBannedRequest(chat, user_id, rights))
            )
        except Exception as e:
            log.warning("ban failed: %s", e)

    if settings.notify_author_dm and user_id and not getattr(sender, "bot", False):
        try:
            await with_floodwait(
                lambda: client.send_message(
                    user_id,
                    f"Сообщение удалено модерацией. Причина: {verdict.reason or 'правила канала'}.",
                )
            )
        except Exception:
            pass

    await write_log(
        account_id=account_id,
        channel_id=channel_id,
        user_id=user_id,
        username=getattr(sender, "username", None),
        reason=verdict.reason or "",
        action=verdict.action,
        matched=verdict.matched,
    )
