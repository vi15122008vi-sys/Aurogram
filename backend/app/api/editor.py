from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_current_account
from app.editor.capabilities import capabilities
from app.editor.rich_editor import preview
from app.models import EditorPreviewRequest, MessageOut, PostCreate
from app.telegram.client import get_client
from app.telegram.floodwait import with_floodwait
from app.telegram.messages import to_out

router = APIRouter(prefix="/editor", tags=["editor"])


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
    return to_out(message, channel_id)
