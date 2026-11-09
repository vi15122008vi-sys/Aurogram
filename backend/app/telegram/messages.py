from __future__ import annotations

from datetime import timezone
from typing import Any, Optional

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
    name = type(msg.media).__name__.lower()
    if "photo" in name:
        return "photo"
    if "document" in name:
        attrs = getattr(msg.media, "document", None)
        mime = getattr(attrs, "mime_type", "") if attrs else ""
        if mime.startswith("audio/") or "voice" in name:
            return "voice" if getattr(msg, "voice", False) or "ogg" in mime else "audio"
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
        duration=getattr(msg, "voice", None) and getattr(msg.voice, "duration", None),
        waveform_data=_waveform(msg),
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
