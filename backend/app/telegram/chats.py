from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from telethon.tl.types import Channel, Chat, User
from telethon import utils
from telethon.tl.functions.stories import GetAllStoriesRequest, GetPeerStoriesRequest, ReadStoriesRequest

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


def _story_entry(peer_id: int, entity: Any, peer_stories: Any) -> Optional[dict[str, Any]]:
    items = getattr(peer_stories, "stories", []) or []
    if entity is None or not items:
        return None
    latest = max(items, key=lambda item: int(item.id))
    latest_id = int(latest.id)
    return {
        "peer_id": peer_id,
        "title": _title(entity),
        "username": getattr(entity, "username", None),
        "count": len(items),
        "unread": int(getattr(peer_stories, "max_read_id", 0) or 0) < latest_id,
        "latest_story_id": latest_id,
        # Фронтенд решает, показывать превью истории или градиентную заглушку.
        "has_media": getattr(latest, "media", None) is not None,
        "media_kind": _media_kind(getattr(latest, "media", None)),
    }


def _media_kind(media: Any) -> Optional[str]:
    """Тип медиа истории: photo / video (None — истории без вложения)."""
    if media is None:
        return None
    document = getattr(media, "document", None)
    mime = getattr(document, "mime_type", "") or ""
    if mime.startswith("video") or getattr(media, "video", False):
        return "video"
    if getattr(media, "photo", None) is not None or mime.startswith("image"):
        return "photo"
    return None


async def get_peer_stories(account: dict, peer_id: int) -> Optional[dict[str, Any]]:
    """Истории одного собеседника: stories.GetPeerStoriesRequest(peer)."""
    client = await get_client(account["id"], account)
    entity = await client.get_entity(peer_id)
    result = await with_floodwait(lambda: client(GetPeerStoriesRequest(peer=entity)))
    return _story_entry(peer_id, entity, result.stories)


async def list_stories(account: dict) -> list[dict[str, Any]]:
    client = await get_client(account["id"], account)
    try:
        result = await with_floodwait(lambda: client(GetAllStoriesRequest()))
        entities = [*getattr(result, "users", []), *getattr(result, "chats", [])]
        by_peer = {utils.get_peer_id(entity): entity for entity in entities}
        stories: list[dict[str, Any]] = []
        for peer_stories in getattr(result, "peer_stories", []):
            peer_id = utils.get_peer_id(peer_stories.peer)
            entry = _story_entry(peer_id, by_peer.get(peer_id), peer_stories)
            if entry:
                stories.append(entry)
        if stories:
            return stories
    except Exception:
        # Старые слои/аккаунты без агрегата: молча уходим в per-peer режим.
        pass

    # Фолбэк: спрашиваем истории адресно по последним диалогам.
    stories = []
    try:
        dialogs = await client.get_dialogs(limit=15)
    except Exception:
        return stories
    for dialog in dialogs:
        try:
            peer_id = utils.get_peer_id(dialog.entity)
            entry = await get_peer_stories(account, peer_id)
            if entry:
                stories.append(entry)
        except Exception:
            continue
    return stories


async def get_story_avatar(account: dict, peer_id: int) -> bytes | None:
    """Аватар для кольца историй (профильное фото, не сама история)."""
    client = await get_client(account["id"], account)
    entity = await with_floodwait(lambda: client.get_entity(peer_id))
    return await with_floodwait(lambda: client.download_profile_photo(entity))


async def get_story_media(account: dict, peer_id: int, story_id: int = 0) -> tuple[bytes, str] | None:
    """Медиа конкретной истории: stories.GetPeerStoriesRequest → download_media.

    Если истории с таким id нет (или у неё нет медиа) — отдаём профильное фото,
    чтобы превью не было пустым.
    """
    client = await get_client(account["id"], account)
    entity = await with_floodwait(lambda: client.get_entity(peer_id))
    result = await with_floodwait(lambda: client(GetPeerStoriesRequest(peer=entity)))
    stories = getattr(getattr(result, "stories", None), "stories", []) or []
    target = None
    for item in stories:
        if int(getattr(item, "id", 0)) == int(story_id):
            target = item
            break
    if target is None and stories:
        target = max(stories, key=lambda item: int(getattr(item, "id", 0)))
    media = getattr(target, "media", None) if target is not None else None
    if media is None:
        photo = await with_floodwait(lambda: client.download_profile_photo(entity))
        return (bytes(photo), "image/jpeg") if photo else None
    data = await with_floodwait(lambda: client.download_media(media, file=bytes))
    if not isinstance(data, (bytes, bytearray)):
        return None
    kind = _media_kind(media)
    mime = "video/mp4" if kind == "video" else "image/jpeg"
    document = getattr(media, "document", None)
    document_mime = getattr(document, "mime_type", "") or ""
    if document_mime:
        mime = document_mime
    return bytes(data), mime


async def read_stories(account: dict, peer_id: int, story_ids: list[int]) -> int:
    """Отметить истории прочитанными: stories.ReadStoriesRequest(peer, max_id).

    У Telegram нет «списка id» — читается всё до максимального id,
    поэтому передаём самый свежий из запрошенных.
    """
    if not story_ids:
        return 0
    client = await get_client(account["id"], account)
    entity = await with_floodwait(lambda: client.get_entity(peer_id))
    max_id = int(max(story_ids))
    await with_floodwait(lambda: client(ReadStoriesRequest(peer=entity, max_id=max_id)))
    return max_id


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
