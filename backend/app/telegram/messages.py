from __future__ import annotations

from datetime import timezone
from typing import Any, Optional

from telethon.tl.functions.messages import GetScheduledHistoryRequest, SendReactionRequest
from telethon.tl.types import ReactionEmoji

from app.models import MessageOut
from app.telegram.client import get_client
from app.telegram.floodwait import with_floodwait


def _status(msg: Any) -> str:
    if getattr(msg, "out", False):
        return "sent"
    return "delivered"


def _media_type(msg: Any) -> Optional[str]:
    if not msg.media:
        return None
    if getattr(msg, "video_note", False):
        return "video_note"
    name = type(msg.media).__name__.lower()
    if "photo" in name:
        return "photo"
    if "document" in name:
        attrs = getattr(msg.media, "document", None)
        mime = getattr(attrs, "mime_type", "") if attrs else ""
        if getattr(msg, "voice", None) or "ogg" in mime or "opus" in mime:
            return "voice"
        if mime.startswith("audio/") or "voice" in name:
            return "audio"
        if mime.startswith("video/"):
            return "video"
        return "document"
    return "media"


def _waveform(msg: Any) -> Optional[list[int]]:
    for attr in getattr(getattr(msg, "media", None), "document", None) and getattr(msg.media.document, "attributes", []) or []:
        data = getattr(attr, "waveform", None)
        if data:
            return list(data)[:40]
    return None


def to_out(msg: Any, chat_id: int) -> MessageOut:
    sender = getattr(msg, "sender", None)
    sender_name = None
    if sender:
        sender_name = " ".join(
            filter(None, [getattr(sender, "first_name", None), getattr(sender, "last_name", None)])
        ) or getattr(sender, "username", None)
    date = msg.date
    if date and date.tzinfo is None:
        date = date.replace(tzinfo=timezone.utc)
    reactions = []
    for item in getattr(getattr(msg, "reactions", None), "results", []) or []:
        reaction = getattr(item, "reaction", None)
        emoji = getattr(reaction, "emoticon", None)
        if emoji:
            reactions.append({"emoji": emoji, "count": int(getattr(item, "count", 0)), "chosen": bool(getattr(item, "chosen", False))})
    media = getattr(msg, "video", None) or getattr(msg, "voice", None)
    return MessageOut(
        id=msg.id,
        chat_id=chat_id,
        sender_id=getattr(msg, "sender_id", None),
        sender_name=sender_name,
        text=msg.message,
        date=date,
        out=bool(getattr(msg, "out", False)),
        status=_status(msg),  # type: ignore[arg-type]
        edited=bool(getattr(msg, "edit_date", None)),
        media_type=_media_type(msg),
        duration=getattr(media, "duration", None) if media else None,
        waveform_data=_waveform(msg),
        reactions=reactions,
        pinned=bool(getattr(msg, "pinned", False)),
    )


async def list_messages(
    account: dict,
    chat_id: int,
    limit: int = 50,
    offset_id: int = 0,
    ghost: bool = True,
) -> list[MessageOut]:
    client = await get_client(account["id"], account)
    # Ghost: do not mark as read — Telethon get_messages does not auto-read by default
    messages = await with_floodwait(
        lambda: client.get_messages(chat_id, limit=limit, offset_id=offset_id or None)
    )
    if not ghost and messages:
        await with_floodwait(lambda: client.send_read_acknowledge(chat_id, max_id=messages[0].id))
    return [to_out(m, chat_id) for m in messages if m]


async def send_message(
    account: dict,
    chat_id: int,
    text: str,
    parse_mode: Optional[str] = "html",
) -> MessageOut:
    client = await get_client(account["id"], account)
    msg = await with_floodwait(
        lambda: client.send_message(chat_id, text, parse_mode=parse_mode)
    )
    return to_out(msg, chat_id)


async def delete_message(account: dict, chat_id: int, message_id: int) -> None:
    client = await get_client(account["id"], account)
    await with_floodwait(lambda: client.delete_messages(chat_id, [message_id]))


async def react_to_message(account: dict, chat_id: int, message_id: int, emoji: str) -> MessageOut:
    client = await get_client(account["id"], account)
    peer = await client.get_input_entity(chat_id)
    await with_floodwait(lambda: client(SendReactionRequest(peer, message_id, [ReactionEmoji(emoticon=emoji)])))
    message = await with_floodwait(lambda: client.get_messages(chat_id, ids=message_id))
    if not message:
        raise ValueError("Сообщение не найдено после отправки реакции")
    return to_out(message, chat_id)


async def send_video_note(account: dict, chat_id: int, video_path: str) -> MessageOut:
    client = await get_client(account["id"], account)
    message = await with_floodwait(lambda: client.send_file(chat_id, video_path, video_note=True, supports_streaming=True))
    return to_out(message, chat_id)


async def send_photo(account: dict, chat_id: int, photo_path: str, caption: Optional[str] = None) -> MessageOut:
    client = await get_client(account["id"], account)
    message = await with_floodwait(
        lambda: client.send_file(chat_id, photo_path, caption=caption, force_document=False)
    )
    return to_out(message, chat_id)


async def list_scheduled(account: dict, chat_id: int) -> list[MessageOut]:
    """Отложенные посты канала (папка «Запланированные» в Telegram)."""
    client = await get_client(account["id"], account)
    peer = await client.get_input_entity(chat_id)
    result = await with_floodwait(lambda: client(GetScheduledHistoryRequest(peer, 0)))
    out = [to_out(message, chat_id) for message in getattr(result, "messages", []) or [] if message]
    out.sort(key=lambda item: item.date)
    return out


async def set_message_pinned(account: dict, chat_id: int, message_id: int, pinned: bool) -> MessageOut:
    client = await get_client(account["id"], account)
    if pinned:
        await with_floodwait(lambda: client.pin_message(chat_id, message_id, notify=False))
    else:
        await with_floodwait(lambda: client.unpin_message(chat_id, message_id, notify=False))
    message = await with_floodwait(lambda: client.get_messages(chat_id, ids=message_id))
    if not message:
        raise ValueError("Сообщение не найдено")
    return to_out(message, chat_id)
