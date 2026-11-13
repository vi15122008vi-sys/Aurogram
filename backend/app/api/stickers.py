from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.bot.client import BotError
from app.config import get_settings
from app.botapi.sticker_maker import create_single_sticker, send_hint
from app.deps import get_current_account

router = APIRouter(prefix="/stickers", tags=["stickers"])


def _owner_id(account: dict[str, Any]) -> int | None:
    """Telegram ID владельца: из аккаунта, иначе первый из BOT_ALLOWED_USER_IDS."""
    raw = account.get("telegram_user_id") or account.get("telegram_id")
    if raw:
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None
    allowed = get_settings().bot_allowed_ids()
    return allowed[0] if allowed else None

log = logging.getLogger("aurogram.stickers")

MAX_UPLOAD = 8 * 1024 * 1024


class StickerHintRequest(BaseModel):
    telegram_user_id: Optional[int] = None


@router.post("/create")
async def create_sticker(
    file: UploadFile = File(...),
    title: str = Form(default="Aurogram sticker"),
    remove_bg: bool = Form(default=True),
    emoji: str = Form(default="⭐"),
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    """Фото → статический стикерпак; бот присылает ссылку в личку владельцу."""
    raw = await file.read(MAX_UPLOAD + 1)
    if not raw:
        raise HTTPException(status_code=422, detail="Пустой файл")
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="Файл больше 8 МБ")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=415, detail="Нужно изображение (JPEG/PNG)")

    owner = _owner_id(account)
    if not owner:
        raise HTTPException(
            status_code=409,
            detail="Неизвестен Telegram ID владельца: откройте бота и отправьте /start",
        )
    try:
        return await create_single_sticker(
            owner_id=int(owner),
            title=title,
            photo=raw,
            cut_background=remove_bg,
            emoji=emoji,
        )
    except BotError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/hint")
async def sticker_hint(
    payload: StickerHintRequest,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    """Подсказка в личку от бота: «Скинь мне картинку, и я сделаю стикер!»"""
    owner = payload.telegram_user_id or _owner_id(account)
    if not owner:
        raise HTTPException(status_code=409, detail="Неизвестен Telegram ID — отправьте боту /start")
    sent = await send_hint(int(owner))
    return {"status": "ok" if sent else "skipped", "sent": sent}
