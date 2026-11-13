from __future__ import annotations

from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.ai import AiError, AiNotConfigured, ask_with_context, generate_widget, summarize_text
from app.cache.manager import connect_cache
from app.deps import get_current_account
from app.ratelimit import AI_LIMITER, limit_requests
from app.telegram.client import get_client
from app.telegram.floodwait import with_floodwait

router = APIRouter(prefix="/ai", tags=["ai"])

MIN_TEXT_CHARS = 40


class WidgetRequest(BaseModel):
    prompt: str = Field(min_length=5, max_length=500)
    channel_id: Optional[int] = None


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    limit: int = Field(default=50, ge=10, le=200)
    translate: bool = False
    reply_style: Literal["strict", "friendly", "brief"] | None = None


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


async def _recent_dialog_context(account_id: str, limit: int) -> tuple[str, int]:
    """Последние сообщения из кэша: «[дата] чат: текст»."""
    conn = await connect_cache(account_id)
    try:
        cursor = await conn.execute(
            """
            SELECT m.date, m.text, c.title, c.type
            FROM cached_messages m
            LEFT JOIN cached_chats c ON c.id = m.chat_id
            WHERE m.deleted = 0 AND m.text IS NOT NULL AND TRIM(m.text) <> ''
            ORDER BY m.date DESC
            LIMIT ?
            """,
            (limit,),
        )
        rows = await cursor.fetchall()
    finally:
        await conn.close()

    lines: list[str] = []
    for row in reversed(rows):
        chat = row["title"] or ("ЛС" if row["type"] == "user" else "чат")
        text = " ".join(str(row["text"]).split())
        if len(text) > 400:
            text = text[:400] + "…"
        lines.append(f"[{row['date']}] {chat}: {text}")
    return "\n".join(lines), len(rows)


@router.post("/ask", dependencies=[Depends(limit_requests(AI_LIMITER, "ai.ask"))])
async def ask(
    payload: AskRequest,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    """Вопрос по своей переписке: последние N сообщений из кэша + LLM."""
    context, count = await _recent_dialog_context(account["id"], payload.limit)
    if not count:
        raise HTTPException(
            status_code=422,
            detail="В кэше пока нет сообщений — откройте чаты, чтобы они загрузились",
        )
    try:
        return await ask_with_context(
            payload.question,
            context,
            messages=count,
            translate=payload.translate,
            reply_style=payload.reply_style,
        )
    except AiNotConfigured as exc:
        raise HTTPException(
            status_code=503,
            detail="AI-ассистент не настроен: задайте AI_API_KEY в окружении бэкенда",
        ) from exc
    except AiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/widget", dependencies=[Depends(limit_requests(AI_LIMITER, "ai.widget"))])
async def create_widget(
    payload: WidgetRequest,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    """Промпт → готовый HTML-виджет (опрос/игра/таймер) для канала."""
    try:
        result = await generate_widget(payload.prompt)
    except AiNotConfigured as exc:
        raise HTTPException(
            status_code=503,
            detail="AI-генератор не настроен: задайте DEEPSEEK_API_KEY в окружении бэкенда",
        ) from exc
    except AiError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    import uuid

    from app.config import get_settings
    from app.database import execute

    # UUID4 вместо sha1: slug нельзя предсказать/подделать, HTML живёт в БД.
    slug = uuid.uuid4().hex
    await execute(
        "INSERT INTO widgets (slug, html, prompt, account_id) VALUES (?, ?, ?, ?)",
        (slug, result["html"], payload.prompt.strip()[:500], account["id"]),
    )
    base = get_settings().widget_public_base_url.rstrip("/")
    return {
        "slug": slug,
        "url": f"{base}/widgets/{slug}",
        "html": result["html"],
        "chars": result["chars"],
        "title": payload.prompt.strip()[:60],
        "channel_id": payload.channel_id,
        # Кнопка открывает WebApp/страницу виджета; slug — случайный UUID.
        "buttons": [
            {"text": "▶ Открыть виджет", "callback_data": f"widget:{slug}"},
            {"text": "Другой виджет", "callback_data": "widget:reroll"},
        ],
    }
