from __future__ import annotations

import logging
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.deps import get_current_account
from app.editor.capabilities import capabilities
from app.editor.rich_editor import preview
from app.integrations.crosspost import deliver
from app.models import EditorPreviewRequest, MessageOut, PostCreate
from app.telegram.client import get_client
from app.telegram.floodwait import with_floodwait
from app.telegram.messages import list_scheduled, send_photo, to_out

router = APIRouter(prefix="/editor", tags=["editor"])

MAX_PHOTO_BYTES = 10 * 1024 * 1024


@router.get("/capabilities")
async def editor_capabilities(
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    client = await get_client(account["id"], account)
    telegram_user = await client.get_me()
    return capabilities(bool(getattr(telegram_user, "premium", False)))


@router.post("/preview")
async def editor_preview(payload: EditorPreviewRequest) -> dict[str, Any]:
    return preview(payload.markdown, premium=payload.premium)


@router.post("/channels/{channel_id}/posts", response_model=MessageOut, status_code=201)
async def publish_post(
    channel_id: int,
    payload: PostCreate,
    account: dict[str, Any] = Depends(get_current_account),
) -> MessageOut:
    if not payload.text or len(payload.text) > 32768:
        raise HTTPException(status_code=422, detail="Длина поста должна быть от 1 до 32768 символов")
    if payload.parse_mode not in {"html", "md"}:
        raise HTTPException(status_code=422, detail="Поддерживаются только html и md")
    if payload.schedule_at:
        if payload.schedule_at.tzinfo is None:
            raise HTTPException(status_code=422, detail="Время публикации должно включать часовой пояс")
        if payload.schedule_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=422, detail="Время публикации должно быть в будущем")
    client = await get_client(account["id"], account)
    message = await with_floodwait(
        lambda: client.send_message(
            channel_id,
            payload.text,
            parse_mode=payload.parse_mode,
            schedule=payload.schedule_at,
            silent=payload.silent,
        )
    )
    # Кросс-постинг только для немедленных публикаций: отложенные отправит
    # Telegram, и копировать их сразу было бы неверно.
    if not payload.schedule_at:
        try:
            await deliver(account["id"], channel_id, payload.text)
        except Exception as exc:  # интеграции не должны ломать публикацию
            log.warning("crosspost failed for channel %s: %s", channel_id, exc)
    return to_out(message, channel_id)


@router.get("/channels/{channel_id}/scheduled", response_model=list[MessageOut])
async def scheduled_posts(
    channel_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> list[MessageOut]:
    """Отложенные посты канала — источник для календаря Студии."""
    return await list_scheduled(account, channel_id)


@router.post("/channels/{channel_id}/photos", response_model=MessageOut, status_code=201)
async def publish_photo(
    channel_id: int,
    photo: UploadFile = File(...),
    caption: str = Form(default=""),
    account: dict[str, Any] = Depends(get_current_account),
) -> MessageOut:
    """Публикация изображения (стикер из Студии) в канал."""
    if not (photo.content_type or "").startswith("image/"):
        raise HTTPException(status_code=415, detail="Ожидается изображение")
    raw = await photo.read(MAX_PHOTO_BYTES + 1)
    if len(raw) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=413, detail="Изображение должно быть не больше 10 МБ")
    suffix = ".png" if "png" in (photo.content_type or "") else ".jpg"
    with tempfile.TemporaryDirectory(prefix="aurogram-photo-") as temp_dir:
        target = Path(temp_dir) / f"photo{suffix}"
        target.write_bytes(raw)
        return await send_photo(account, channel_id, str(target), caption=caption.strip() or None)
