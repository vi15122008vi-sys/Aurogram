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
