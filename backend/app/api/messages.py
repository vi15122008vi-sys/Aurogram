from __future__ import annotations

import asyncio
import mimetypes
import tempfile
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.cache.manager import touch_cached_media
from app.database import fetchone
from app.deps import get_current_account
from app.models import MessageOut
from app.telegram.media import download_message_media, ensure_thumbnail, resolve_media_file
from app.telegram.messages import delete_message, list_messages, react_to_message, send_message, send_video_note, set_message_pinned

import asyncio
import logging

from telethon.errors import (
    AuthKeyUnregisteredError,
    ChannelPrivateError,
    FloodWaitError,
    ServerError,
    SessionRevokedError,
)

log = logging.getLogger("aurogram.messages")


async def _safe_list_messages(account: dict, chat_id: int, limit: int, offset_id: int, ghost: bool):
    """Загружает сообщения, не роняя API на ошибках Telegram.

    FloodWait — ждём и пробуем ещё раз; приватный канал / сбой сервера —
    отдаём пустой список (фронтенд покажет «нет сообщений», а не 500).
    """
    try:
        return await list_messages(
            account, chat_id, limit=limit, offset_id=offset_id, ghost=ghost
        )
    except FloodWaitError as exc:
        wait = int(getattr(exc, "seconds", 0) or 0)
        log.warning("messages: floodwait %ss for chat %s", wait, chat_id)
        if wait > 60:
            # Долгое ожидание: не держим HTTP-запрос, отдаём точное время фронтенду.
            raise HTTPException(
                status_code=429,
                detail=f"Telegram просит подождать {wait} секунд",
                headers={"Retry-After": str(wait)},
            ) from exc
        await asyncio.sleep(max(1, wait))
        try:
            return await list_messages(
                account, chat_id, limit=limit, offset_id=offset_id, ghost=ghost
            )
        except Exception as retry_exc:  # noqa: BLE001
            log.warning("messages retry failed: %s", retry_exc)
            raise HTTPException(
                status_code=429,
                detail=f"Telegram просит подождать {wait} секунд",
                headers={"Retry-After": str(wait)},
            ) from retry_exc
    except ChannelPrivateError as exc:
        log.warning("messages: channel %s is private: %s", chat_id, exc)
        raise HTTPException(status_code=403, detail="Нет доступа к каналу") from exc
    except (AuthKeyUnregisteredError, SessionRevokedError) as exc:
        log.warning("messages: session dead for account %s: %s", account["id"][:8], exc)
        raise HTTPException(status_code=401, detail="Сессия истекла, войдите заново") from exc
    except (TimeoutError, ConnectionError) as exc:
        log.warning("messages: telegram unreachable: %s", exc)
        raise HTTPException(status_code=504, detail="Сервер Telegram не отвечает") from exc
    except ServerError as exc:
        log.warning("messages: telegram server error for %s: %s", chat_id, exc)
        raise HTTPException(status_code=502, detail="Telegram вернул ошибку") from exc



router = APIRouter(prefix="/messages", tags=["messages"])


class MessageCreate(BaseModel):
    chat_id: int
    text: str = Field(min_length=1, max_length=4096)
    parse_mode: Literal["html", "md"] | None = "html"


class ReactionUpdate(BaseModel):
    emoji: Literal["👍", "❤️", "🔥", "😂"]


class PinUpdate(BaseModel):
    pinned: bool


@router.get("", response_model=list[MessageOut])
async def messages(
    chat_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset_id: int = Query(default=0, ge=0),
    ghost: bool = True,
    account: dict[str, Any] = Depends(get_current_account),
) -> list[MessageOut]:
    privacy = await fetchone("SELECT no_read_receipts FROM account_preferences WHERE account_id = ?", (account["id"],))
    ghost = bool(privacy["no_read_receipts"]) if privacy else True
    return await _safe_list_messages(
        account,
        chat_id,
        limit=limit,
        offset_id=offset_id,
        ghost=ghost,
    )


@router.post("", response_model=MessageOut, status_code=201)
async def create_message(
    payload: MessageCreate,
    account: dict[str, Any] = Depends(get_current_account),
) -> MessageOut:
    return await send_message(
        account,
        payload.chat_id,
        payload.text,
        parse_mode=payload.parse_mode,
    )


@router.post("/video-note", response_model=MessageOut, status_code=201)
async def create_video_note(
    chat_id: int = Form(...),
    video: UploadFile = File(...),
    account: dict[str, Any] = Depends(get_current_account),
) -> MessageOut:
    if not (video.content_type or "").startswith("video/"):
        raise HTTPException(status_code=415, detail="Ожидается видеофайл")
    raw = await video.read(25 * 1024 * 1024 + 1)
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Видеосообщение должно быть не больше 25 МБ")
    with tempfile.TemporaryDirectory(prefix="aurogram-video-note-") as temp_dir:
        source = Path(temp_dir) / "recording.webm"
        target = Path(temp_dir) / "video-note.mp4"
        source.write_bytes(raw)
        process = await asyncio.create_subprocess_exec(
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
            "-vf", "scale=512:512:force_original_aspect_ratio=increase,crop=512:512",
            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(target),
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await process.communicate()
        if process.returncode != 0 or not target.exists():
            detail = stderr.decode("utf-8", "replace")[-500:] if stderr else "Не удалось обработать видео"
            raise HTTPException(status_code=422, detail=detail)
        return await send_video_note(account, chat_id, str(target))


@router.put("/{chat_id}/{message_id}/reaction", response_model=MessageOut)
async def update_reaction(
    chat_id: int,
    message_id: int,
    payload: ReactionUpdate,
    account: dict[str, Any] = Depends(get_current_account),
) -> MessageOut:
    return await react_to_message(account, chat_id, message_id, payload.emoji)


@router.put("/{chat_id}/{message_id}/pin", response_model=MessageOut)
async def update_pin(
    chat_id: int,
    message_id: int,
    payload: PinUpdate,
    account: dict[str, Any] = Depends(get_current_account),
) -> MessageOut:
    return await set_message_pinned(account, chat_id, message_id, payload.pinned)


@router.delete("/{chat_id}/{message_id}", status_code=204)
async def remove_message(
    chat_id: int,
    message_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> None:
    await delete_message(account, chat_id, message_id)


@router.get("/{chat_id}/{message_id}/media")
async def message_media(
    chat_id: int,
    message_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> FileResponse:
    path = resolve_media_file(account["id"], chat_id, message_id)
    if path is None or not path.is_file():
        path = await download_message_media(account, chat_id, message_id)
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Медиафайл не найден")
    await touch_cached_media(account["id"], path, chat_id, message_id)
    media_type, _ = mimetypes.guess_type(path.name)
    return FileResponse(
        path,
        media_type=media_type or "application/octet-stream",
        filename=path.name,
    )


@router.get("/{chat_id}/{message_id}/thumb")
async def message_thumbnail(
    chat_id: int,
    message_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> FileResponse:
    """Превью медиа: 640px JPEG для сеток (в 10–40 раз легче оригинала)."""
    path = resolve_media_file(account["id"], chat_id, message_id)
    if path is None or not path.is_file():
        path = await download_message_media(account, chat_id, message_id)
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Медиафайл не найден")
    await touch_cached_media(account["id"], path, chat_id, message_id)
    thumbnail = await ensure_thumbnail(account["id"], chat_id, message_id, path)
    if thumbnail is not None:
        return FileResponse(
            thumbnail,
            media_type="image/jpeg",
            headers={"Cache-Control": "private, max-age=86400"},
        )
    # Превью не получилось (нет ffmpeg / не изображение) — отдаём оригинал.
    media_type, _ = mimetypes.guess_type(path.name)
    return FileResponse(path, media_type=media_type or "application/octet-stream")
