from __future__ import annotations

from datetime import timezone
from typing import Any, Optional

from telethon import utils
from telethon.tl.functions.channels import GetAdminedPublicChannelsRequest, GetFullChannelRequest
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
        views = 0
        if last is not None:
            if last.date:
                last_at = last.date if last.date.tzinfo else last.date.replace(tzinfo=timezone.utc)
            # Просмотры последнего поста — единственная метрика охвата,
            # которую Telegram отдаёт без отдельного stats-запроса.
            views = int(getattr(last, "views", 0) or 0)
        out.append(
            ChannelOut(
                id=d.id,
                title=entity.title or str(entity.id),
                username=getattr(entity, "username", None),
                subscribers=getattr(entity, "participants_count", 0) or 0,
                last_post_at=last_at,
                views=views,
            )
        )
    return out


async def list_admined_public_channels(account: dict) -> list[ChannelOut]:
    """Return public channels Telegram reports as administered by this account."""
    client = await get_client(account["id"], account)
    result = await with_floodwait(
        lambda: client(GetAdminedPublicChannelsRequest(by_location=False, check_limit=False))
    )
    out: list[ChannelOut] = []
    for entity in getattr(result, "chats", []):
        if not isinstance(entity, Channel) or not getattr(entity, "broadcast", False):
            continue
        out.append(
            ChannelOut(
                id=utils.get_peer_id(entity),
                title=entity.title or str(entity.id),
                username=getattr(entity, "username", None),
                subscribers=getattr(entity, "participants_count", 0) or 0,
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
