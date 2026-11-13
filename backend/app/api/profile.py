from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.cache.manager import connect_cache
from app.database import fetchall, fetchone
from app.deps import get_current_account

router = APIRouter(prefix="/profile", tags=["profile"])


async def _cache_counts(account_id: str) -> dict[str, int]:
    """Счётчики по локальному кэшу аккаунта (сообщения/чаты/каналы)."""
    conn = await connect_cache(account_id)
    try:
        async def count(sql: str, params: tuple[Any, ...] = ()) -> int:
            cursor = await conn.execute(sql, params)
            row = await cursor.fetchone()
            return int(row[0] or 0) if row else 0

        return {
            "messages": await count("SELECT COUNT(*) FROM cached_messages WHERE deleted = 0"),
            "chats": await count("SELECT COUNT(*) FROM cached_chats"),
            "channels": await count("SELECT COUNT(*) FROM cached_chats WHERE type = 'channel'"),
            "groups": await count("SELECT COUNT(*) FROM cached_chats WHERE type = 'group'"),
            "direct": await count("SELECT COUNT(*) FROM cached_chats WHERE type = 'user'"),
            "media": await count("SELECT COUNT(*) FROM cached_media"),
        }
    finally:
        await conn.close()


@router.get("/stats")
async def profile_stats(account: dict[str, Any] = Depends(get_current_account)) -> dict[str, Any]:
    counts = await _cache_counts(account["id"])
    return {
        "account": {
            "id": account["id"],
            "name": account.get("name") or "",
            "username": account.get("username"),
            "phone": account.get("phone") or "",
            "auth_state": account.get("auth_state"),
        },
        **counts,
    }


@router.get("/export")
async def profile_export(account: dict[str, Any] = Depends(get_current_account)) -> JSONResponse:
    """Экспорт настроек и статистики профиля в JSON (без переписки)."""
    counts = await _cache_counts(account["id"])
    preferences = await fetchone(
        "SELECT hide_online, no_read_receipts, hide_device_type FROM account_preferences WHERE account_id = ?",
        (account["id"],),
    )
    channels = await fetchall(
        "SELECT channel_id FROM channel_settings WHERE account_id = ? ORDER BY channel_id",
        (account["id"],),
    )
    archived = await fetchall(
        "SELECT chat_id FROM archived_chats WHERE account_id = ? ORDER BY chat_id",
        (account["id"],),
    )
    payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "app": "Aurogram",
        "account": {
            "id": account["id"],
            "name": account.get("name") or "",
            "username": account.get("username"),
            "phone": account.get("phone") or "",
            "auth_state": account.get("auth_state"),
        },
        "stats": counts,
        "preferences": {
            "hide_online": bool(preferences["hide_online"]) if preferences else False,
            "no_read_receipts": bool(preferences["no_read_receipts"]) if preferences else True,
            "hide_device_type": bool(preferences["hide_device_type"]) if preferences else False,
        },
        "configured_channels": [int(row["channel_id"]) for row in channels],
        "archived_chats": [int(row["chat_id"]) for row in archived],
    }
    return JSONResponse(
        payload,
        headers={"Content-Disposition": 'attachment; filename="aurogram-profile.json"'},
    )
