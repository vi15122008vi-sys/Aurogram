from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from telethon.tl.types import Channel, Chat, User
from telethon import utils
from telethon.tl.functions.stories import GetAllStoriesRequest

from app.models import ChatOut
from app.cache.manager import upsert_message
from app.telegram.client import get_client
from app.telegram.floodwait import with_floodwait


def _chat_type(entity: Any) -> str:
    if isinstance(entity, User):
        return "bot" if getattr(entity, "bot", False) else "user"
    if isinstance(entity, Channel):
        return "channel" if getattr(entity, "broadcast", False) else "group"
    if isinstance(entity, Chat):
        return "group"
    return "user"


def _is_managed_channel(entity: Any) -> bool:
    """Канал, которым управляет аккаунт: живёт в разделе «Каналы», не в чатах."""
    return (
        isinstance(entity, Channel)
        and bool(getattr(entity, "broadcast", False))
        and bool(getattr(entity, "creator", False) or getattr(entity, "admin_rights", None))
    )


def _is_bot(entity: Any) -> bool:
    """Бот: отдельный раздел «Боты», в списке чатов не дублируется."""
    return isinstance(entity, User) and bool(getattr(entity, "bot", False))


def _title(entity: Any) -> str:
    if isinstance(entity, User):
        parts = [entity.first_name or "", entity.last_name or ""]
        return " ".join(p for p in parts if p).strip() or (entity.username or str(entity.id))
    return getattr(entity, "title", None) or str(getattr(entity, "id", ""))


async def list_chats(
    account: dict,
    limit: int = 100,
    *,
    archived_ids: set[int] | None = None,
    archived: bool = False,
) -> list[ChatOut]:
    client = await get_client(account["id"], account)
    dialogs = await with_floodwait(lambda: client.get_dialogs(limit=limit))
    out: list[ChatOut] = []
    archived_ids = archived_ids or set()
    for d in dialogs:
        is_archived = d.id in archived_ids
        if is_archived != archived:
            continue
        entity = d.entity
        # Разделение режимов: админские каналы показываем в «Каналах»,
        # ботов — в «Ботах», чтобы одна и та же сущность не дублировалась.
        if _is_managed_channel(entity) or _is_bot(entity):
            continue
        last = d.message
        preview = None
        last_date = None
        if last:
            preview = last.message or (last.media and "[медиа]") or None
            if last.date:
                last_date = last.date if last.date.tzinfo else last.date.replace(tzinfo=timezone.utc)
        out.append(
            ChatOut(
                id=d.id,
                title=_title(entity),
                username=getattr(entity, "username", None),
                type=_chat_type(entity),  # type: ignore[arg-type]
                archived=is_archived,
                unread=d.unread_count or 0,
                last_message=preview,
                last_message_date=last_date,
                members_count=getattr(entity, "participants_count", None),
            )
        )
    return out


async def list_stories(account: dict) -> list[dict[str, Any]]:
    client = await get_client(account["id"], account)
    result = await with_floodwait(lambda: client(GetAllStoriesRequest()))
    entities = [*getattr(result, "users", []), *getattr(result, "chats", [])]
    by_peer = {utils.get_peer_id(entity): entity for entity in entities}
    stories: list[dict[str, Any]] = []
    for peer_stories in getattr(result, "peer_stories", []):
        peer_id = utils.get_peer_id(peer_stories.peer)
        entity = by_peer.get(peer_id)
        items = getattr(peer_stories, "stories", []) or []
        if entity is None or not items:
            continue
        latest_id = max(int(item.id) for item in items)
        stories.append({
            "peer_id": peer_id,
            "title": _title(entity),
            "username": getattr(entity, "username", None),
            "count": len(items),
            "unread": int(getattr(peer_stories, "max_read_id", 0) or 0) < latest_id,
            "latest_story_id": latest_id,
        })
    return stories


async def get_story_avatar(account: dict, peer_id: int) -> bytes | None:
    client = await get_client(account["id"], account)
    entity = await with_floodwait(lambda: client.get_entity(peer_id))
    return await with_floodwait(lambda: client.download_profile_photo(entity))


async def get_chat(account: dict, chat_id: int) -> Optional[ChatOut]:
    client = await get_client(account["id"], account)
    entity = await with_floodwait(lambda: client.get_entity(chat_id))
    return ChatOut(
        id=getattr(entity, "id", chat_id),
        title=_title(entity),
        username=getattr(entity, "username", None),
        type=_chat_type(entity),  # type: ignore[arg-type]
        members_count=getattr(entity, "participants_count", None),
    )


async def fetch_chat_history(account: dict, chat_id: int, limit: int = 150) -> int:
    """Fetch the latest messages for a chat and persist them to its local cache."""
    client = await get_client(account["id"], account)
    messages = await with_floodwait(lambda: client.get_messages(chat_id, limit=limit))
    ordered = list(reversed(messages or []))
    for message in ordered:
        await upsert_message(account["id"], chat_id, message)
    return len(ordered)
