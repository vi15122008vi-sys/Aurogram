from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import get_settings

log = logging.getLogger("aurogram.ai")

MAX_INPUT_CHARS = 12_000


class AiNotConfigured(RuntimeError):
    """Не задан AI_API_KEY — суммаризация выключена."""


class AiError(RuntimeError):
    """LLM недоступен или вернул мусор."""


def _endpoint(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    return f"{base}/chat/completions"


def _prompt(sentences: int) -> str:
    return (
        "Ты редактор Telegram-канала. Сделай краткий пересказ поста строго "
        f"в {sentences} предложениях: только суть и факты, без вступлений, "
        "без оценок и без списков. Язык — как в исходном тексте."
    )


def _ask_system() -> str:
    return (
        "Ты личный ассистент по переписке пользователя в Telegram. "
        "Ниже — последние сообщения из локального кэша в формате «[дата] чат: текст». "
        "Ответь на вопрос пользователя, опираясь ТОЛЬКО на эти сообщения; "
        "если данных не хватает — прямо скажи, что в переписке этого нет. "
        "Не выдумывай факты. Отвечай кратко (до 6 предложений) на языке вопроса."
    )


async def ask_with_context(question: str, context: str, messages: int = 0) -> dict[str, Any]:
    """Ответ на вопрос по последним сообщениям из кэша."""
    settings = get_settings()
    api_key = settings.ai_api_key.strip()
    if not api_key:
        raise AiNotConfigured("AI_API_KEY не задан")

    source = context.strip()[: MAX_INPUT_CHARS * 2]
    payload = {
        "model": settings.ai_model,
        "messages": [
            {"role": "system", "content": _ask_system()},
            {"role": "user", "content": f"Вопрос: {question.strip()}\n\nПереписка:\n{source}"},
        ],
        "temperature": 0.2,
        "max_tokens": 600,
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            response = await client.post(
                _endpoint(settings.ai_base_url),
                json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
    except httpx.HTTPError as exc:
        raise AiError("Не удалось связаться с LLM") from exc

    if response.status_code == 401:
        raise AiError("LLM отклонил ключ (401): проверьте AI_API_KEY")
    if response.status_code >= 400:
        log.warning("LLM error %s: %s", response.status_code, response.text[:200])
        raise AiError(f"LLM вернул ошибку {response.status_code}")

    try:
        data = response.json()
        answer = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    except (ValueError, AttributeError, IndexError) as exc:
        raise AiError("LLM вернул некорректный ответ") from exc

    answer = str(answer).strip()
    if not answer:
        raise AiError("LLM вернул пустой ответ")
    return {
        "answer": answer,
        "model": settings.ai_model,
        "context_chars": len(source),
        "context_messages": messages,
    }


async def summarize_text(text: str, sentences: int = 4) -> dict[str, Any]:
    settings = get_settings()
    api_key = settings.ai_api_key.strip()
    if not api_key:
        raise AiNotConfigured("AI_API_KEY не задан")

    source = text.strip()[:MAX_INPUT_CHARS]
    payload = {
        "model": settings.ai_model,
        "messages": [
            {"role": "system", "content": _prompt(sentences)},
            {"role": "user", "content": source},
        ],
        "temperature": 0.3,
        "max_tokens": 400,
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            response = await client.post(
                _endpoint(settings.ai_base_url),
                json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
    except httpx.HTTPError as exc:
        raise AiError("Не удалось связаться с LLM") from exc

    if response.status_code == 401:
        raise AiError("LLM отклонил ключ (401): проверьте AI_API_KEY")
    if response.status_code >= 400:
        log.warning("LLM error %s: %s", response.status_code, response.text[:200])
        raise AiError(f"LLM вернул ошибку {response.status_code}")

    try:
        data = response.json()
        summary = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    except (ValueError, AttributeError, IndexError) as exc:
        raise AiError("LLM вернул некорректный ответ") from exc

    summary = str(summary).strip()
    if not summary:
        raise AiError("LLM вернул пустой пересказ")
    return {
        "summary": summary,
        "model": settings.ai_model,
        "sentences": sentences,
        "source_chars": len(source),
    }
