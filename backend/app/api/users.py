from __future__ import annotations

import json
import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.cache.manager import connect_cache
from app.database import execute, fetchone
from app.deps import get_current_account

router = APIRouter(prefix="/users", tags=["users"])

MAX_PINNED_STORIES = 3
BIO_MAX = 200
NAME_MAX = 64
BIRTHDAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=NAME_MAX)
    bio: Optional[str] = Field(default=None, max_length=BIO_MAX)
    birthday: Optional[str] = None
    channel_id: Optional[int] = None
    pinned_story_ids: Optional[list[int]] = Field(default=None, max_length=MAX_PINNED_STORIES)

    @field_validator("birthday")
    @classmethod
    def _check_birthday(cls, value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        if not BIRTHDAY_RE.match(value):
            raise ValueError("Дата должна быть в формате YYYY-MM-DD")
        return value


async def _profile_row(account_id: str) -> dict[str, Any]:
    row = await fetchone("SELECT * FROM account_profiles WHERE account_id = ?", (account_id,))
    if not row:
        return {
            "account_id": account_id,
            "display_name": None,
            "bio": None,
            "birthday": None,
            "channel_id": None,
            "pinned_story_ids": [],
            "updated_at": None,
        }
    data = dict(row)
    try:
        data["pinned_story_ids"] = json.loads(data.get("pinned_stories_json") or "[]")
    except ValueError:
        data["pinned_story_ids"] = []
    return data


async def _counts(account_id: str) -> dict[str, int]:
    conn = await connect_cache(account_id)
    try:
        async def count(sql: str) -> int:
            cursor = await conn.execute(sql)
            row = await cursor.fetchone()
            return int(row[0] or 0) if row else 0

        return {
            "messages": await count("SELECT COUNT(*) FROM cached_messages WHERE deleted = 0"),
            "chats": await count("SELECT COUNT(*) FROM cached_chats"),
            "channels": await count("SELECT COUNT(*) FROM cached_chats WHERE type = 'channel'"),
        }
    finally:
        await conn.close()


@router.get("/me")
async def users_me(account: dict[str, Any] = Depends(get_current_account)) -> dict[str, Any]:
    """Полный профиль: аккаунт, редактируемые поля и статистика."""
    profile = await _profile_row(account["id"])
    return {
        "account": {
            "id": account["id"],
            "name": account.get("name") or "",
            "username": account.get("username"),
            "phone": account.get("phone") or "",
            "auth_state": account.get("auth_state"),
            "created_at": account.get("created_at"),
        },
        "profile": {
            "display_name": profile["display_name"],
            "bio": profile["bio"],
            "birthday": profile["birthday"],
            "channel_id": profile["channel_id"],
            "pinned_story_ids": profile["pinned_story_ids"],
            "updated_at": profile["updated_at"],
        },
        "stats": await _counts(account["id"]),
    }


@router.patch("/me")
async def users_me_update(
    payload: ProfileUpdate,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    current = await _profile_row(account["id"])
    pinned = payload.pinned_story_ids if payload.pinned_story_ids is not None else current["pinned_story_ids"]
    if len(pinned) > MAX_PINNED_STORIES:
        raise HTTPException(status_code=422, detail=f"Можно закрепить не больше {MAX_PINNED_STORIES} историй")
    display_name = payload.display_name if payload.display_name is not None else current["display_name"]
    bio = payload.bio if payload.bio is not None else current["bio"]
    birthday = payload.birthday if payload.birthday is not None else current["birthday"]
    channel_id = payload.channel_id if payload.channel_id is not None else current["channel_id"]

    await execute(
        """
        INSERT INTO account_profiles (account_id, display_name, bio, birthday, channel_id, pinned_stories_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(account_id) DO UPDATE SET
            display_name = excluded.display_name,
            bio = excluded.bio,
            birthday = excluded.birthday,
            channel_id = excluded.channel_id,
            pinned_stories_json = excluded.pinned_stories_json,
            updated_at = datetime('now')
        """,
        (account["id"], (display_name or "").strip() or None, (bio or "").strip() or None, birthday, channel_id, json.dumps(pinned)),
    )
    return {"status": "ok", "profile": await _profile_row(account["id"])}
