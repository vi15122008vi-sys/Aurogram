from __future__ import annotations

from datetime import timezone
from typing import Any, Optional

from telethon.tl.functions.channels import GetFullChannelRequest
from telethon.tl.types import Channel

from app.models import ChannelOut
from app.telegram.client import get_client
from app.telegram.floodwait import with_floodwait


async def list_channels(account: dict) -> list[ChannelOut]:
    client = await get_client(account["id"], account)
    dialogs = await with_floodwait(lambda: client.get_dialogs(limit=200))
    out: list[ChannelOut] = []
    for d in dialogs:
        entity = d.entity
        if not isinstance(entity, Channel) or not getattr(entity, "broadcast", False):
            continue
        if not (getattr(entity, "creator", False) or getattr(entity, "admin_rights", None)):
            continue
        last = d.message
        last_at = None
        if last and last.date:
            last_at = last.date if last.date.tzinfo else last.date.replace(tzinfo=timezone.utc)
        out.append(
            ChannelOut(
                id=d.id,
                title=entity.title or str(entity.id),
                username=getattr(entity, "username", None),
                subscribers=getattr(entity, "participants_count", 0) or 0,
                last_post_at=last_at,
            )
        )
    return out


async def get_channel_full(account: dict, channel_id: int) -> dict[str, Any]:
    client = await get_client(account["id"], account)
    entity = await with_floodwait(lambda: client.get_entity(channel_id))
    full = await with_floodwait(lambda: client(GetFullChannelRequest(entity)))
    linked = getattr(full.full_chat, "linked_chat_id", None)
    return {
        "id": channel_id,
        "title": getattr(entity, "title", ""),
        "username": getattr(entity, "username", None),
        "subscribers": getattr(full.full_chat, "participants_count", 0) or 0,
        "about": getattr(full.full_chat, "about", "") or "",
        "linked_chat_id": linked,
    }


async def get_linked_chat_id(account: dict, channel_id: int) -> Optional[int]:
    data = await get_channel_full(account, channel_id)
    return data.get("linked_chat_id")
