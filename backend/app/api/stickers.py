from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.bot.client import BotError
from app.config import get_settings
from app.botapi.sticker_maker import create_multi_sticker, send_hint
from app.deps import get_current_account

router = APIRouter(prefix="/stickers", tags=["stickers"])


def _owner_id(account: dict[str, Any]) -> int | None:
    """Telegram ID владельца из accounts.tg_user_id (пишется при авторизации)."""
    raw = account.get("tg_user_id")
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None

log = logging.getLogger("aurogram.stickers")

MAX_UPLOAD = 8 * 1024 * 1024


class StickerHintRequest(BaseModel):
    telegram_user_id: Optional[int] = None


@router.post("/create")
async def create_sticker(
    files: list[UploadFile] = File(default_factory=list),
    title: str = Form(default="Aurogram sticker"),
    remove_bg: bool = Form(default=True),
    emoji: str = Form(default="⭐"),
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    """Фото → статический стикерпак; бот присылает ссылку в личку владельцу."""
    if not files:
        raise HTTPException(status_code=422, detail="Нужен хотя бы один файл")
    if len(files) > 50:
        raise HTTPException(status_code=422, detail="Не больше 50 стикеров в паке")

    payloads: list[bytes] = []
    for item in files:
        raw = await item.read(MAX_UPLOAD + 1)
        if not raw:
            raise HTTPException(status_code=422, detail=f"Пустой файл: {item.filename}")
        if len(raw) > MAX_UPLOAD:
            raise HTTPException(status_code=413, detail=f"Файл больше 8 МБ: {item.filename}")
        if not (item.content_type or "").startswith("image/"):
            raise HTTPException(status_code=415, detail=f"Нужно изображение: {item.filename}")
        payloads.append(raw)

    owner = _owner_id(account)
    if not owner:
        raise HTTPException(
            status_code=409,
            detail="В аккаунте нет Telegram ID: перелогиньтесь, чтобы он сохранился",
        )
    try:
        return await create_multi_sticker(
            owner_id=int(owner),
            title=title,
            photos=payloads,
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
    owner = _owner_id(account)
    if not owner:
        raise HTTPException(status_code=409, detail="Неизвестен Telegram ID — отправьте боту /start")
    sent = await send_hint(int(owner))
    return {"status": "ok" if sent else "skipped", "sent": sent}
