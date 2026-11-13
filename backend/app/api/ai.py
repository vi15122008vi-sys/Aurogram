from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.ai import AiError, AiNotConfigured, summarize_text
from app.deps import get_current_account
from app.ratelimit import AI_LIMITER, limit_requests
from app.telegram.client import get_client
from app.telegram.floodwait import with_floodwait

router = APIRouter(prefix="/ai", tags=["ai"])

MIN_TEXT_CHARS = 40


class SummarizeRequest(BaseModel):
    text: Optional[str] = Field(default=None, max_length=32_768)
    chat_id: Optional[int] = None
    message_id: Optional[int] = None
    sentences: int = Field(default=4, ge=2, le=6)


async def _message_text(account: dict[str, Any], chat_id: int, message_id: int) -> str:
    client = await get_client(account["id"], account)
    message = await with_floodwait(lambda: client.get_messages(chat_id, ids=message_id))
    return str(getattr(message, "message", "") or "")


@router.post("/summarize", dependencies=[Depends(limit_requests(AI_LIMITER, "ai.summarize"))])
async def summarize(
    payload: SummarizeRequest,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    """Краткий пересказ поста: по тексту или по ID сообщения канала."""
    text = (payload.text or "").strip()
    if not text and payload.chat_id is not None and payload.message_id is not None:
        text = (await _message_text(account, payload.chat_id, payload.message_id)).strip()
    if len(text) < MIN_TEXT_CHARS:
        raise HTTPException(
            status_code=422,
            detail=f"Нужен текст поста минимум {MIN_TEXT_CHARS} символов",
        )
    try:
        return await summarize_text(text, sentences=payload.sentences)
    except AiNotConfigured as exc:
        raise HTTPException(
            status_code=503,
            detail="AI-суммаризация не настроена: задайте AI_API_KEY в окружении бэкенда",
        ) from exc
    except AiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
