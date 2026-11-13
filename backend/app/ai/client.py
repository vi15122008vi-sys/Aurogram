from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from app.config import get_settings

log = logging.getLogger("aurogram.ai")

MAX_INPUT_CHARS = 12_000


class AiNotConfigured(RuntimeError):
    """Не задан ключ LLM — AI-функции выключены."""


class AiError(RuntimeError):
    """LLM недоступен или вернул мусор."""


def api_key() -> str:
    """Ключ DeepSeek: DEEPSEEK_API_KEY, затем AI_API_KEY (обратная совместимость)."""
    settings = get_settings()
    return (
        (settings.deepseek_api_key or "").strip()
        or (settings.ai_api_key or "").strip()
        or (os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    )


def _endpoint(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    return f"{base}/chat/completions"


async def _complete(messages: list[dict[str, str]], temperature: float, max_tokens: int) -> str:
    """Один вызов chat/completions: openai SDK, при его отсутствии — httpx."""
    settings = get_settings()
    key = api_key()
    if not key:
        raise AiNotConfigured("DEEPSEEK_API_KEY не задан")

    try:
        from openai import AsyncOpenAI  # noqa: PLC0415 — опциональная зависимость
    except ImportError:
        AsyncOpenAI = None  # type: ignore[assignment]

    if AsyncOpenAI is not None:
        client = AsyncOpenAI(
            api_key=key,
            base_url=settings.ai_base_url,
            timeout=settings.ai_timeout_seconds,
        )
        try:
            completion = await client.chat.completions.create(
                model=settings.ai_model,
                messages=messages,  # type: ignore[arg-type]
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except Exception as exc:  # openai.APIError и сетевые сбои
            log.warning("openai error: %s", exc)
            raise AiError(f"LLM недоступен: {exc}") from exc
        content = (completion.choices[0].message.content or "").strip()
        if not content:
            raise AiError("LLM вернул пустой ответ")
        return content

    payload = {
        "model": settings.ai_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            response = await client.post(
                _endpoint(settings.ai_base_url),
                json=payload,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            )
    except httpx.HTTPError as exc:
        raise AiError("Не удалось связаться с LLM") from exc

    if response.status_code == 401:
        raise AiError("LLM отклонил ключ (401): проверьте DEEPSEEK_API_KEY")
    if response.status_code >= 400:
        log.warning("LLM error %s: %s", response.status_code, response.text[:200])
        raise AiError(f"LLM вернул ошибку {response.status_code}")

    try:
        data = response.json()
        content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    except (ValueError, AttributeError, IndexError) as exc:
        raise AiError("LLM вернул некорректный ответ") from exc

    content = str(content).strip()
    if not content:
        raise AiError("LLM вернул пустой ответ")
    return content


def _summarize_system(sentences: int) -> str:
    return (
        "Ты редактор Telegram-канала. Сделай краткий пересказ поста строго "
        f"в {sentences} предложениях: только суть и факты, без вступлений, "
        "без оценок и без списков. Язык — как в исходном тексте."
    )


async def summarize_text(text: str, sentences: int = 4) -> dict[str, Any]:
    settings = get_settings()
    source = text.strip()[:MAX_INPUT_CHARS]
    summary = await _complete(
        [
            {"role": "system", "content": _summarize_system(sentences)},
            {"role": "user", "content": source},
        ],
        temperature=0.3,
        max_tokens=400,
    )
    return {
        "summary": summary,
        "model": settings.ai_model,
        "sentences": sentences,
        "source_chars": len(source),
    }


TONES = {
    "strict": "Тон: сухо, по делу, без эмодзи и вступлений.",
    "friendly": "Тон: дружелюбный, живой, можно одно уместное эмодзи.",
    "brief": "Тон: максимально кратко, 1–2 предложения.",
}


def _ask_system(translate: bool = False, reply_style: str | None = None) -> str:
    tone = TONES.get(reply_style or "", "Отвечай кратко (до 6 предложений).")
    base = (
        "Ты личный ассистент по переписке пользователя в Telegram. "
        "Ниже — последние сообщения из локального кэша в формате «[дата] чат: текст». "
        "Ответь на вопрос пользователя, опираясь ТОЛЬКО на эти сообщения; "
        "если данных не хватает — прямо скажи, что в переписке этого нет. "
        "Не выдумывай факты. "
        f"{tone}"
    )
    if translate:
        base += " Ответ дай на русском языке; если переписка на другом языке — переведи смысл."
    else:
        base += " Язык ответа — язык вопроса."
    return base


async def ask_with_context(
    question: str,
    context: str,
    messages: int = 0,
    translate: bool = False,
    reply_style: str | None = None,
) -> dict[str, Any]:
    """Ответ на вопрос по последним сообщениям из кэша."""
    settings = get_settings()
    source = context.strip()[: MAX_INPUT_CHARS * 2]
    answer = await _complete(
        [
            {"role": "system", "content": _ask_system(translate, reply_style)},
            {"role": "user", "content": f"Вопрос: {question.strip()}\n\nПереписка:\n{source}"},
        ],
        temperature=0.2,
        max_tokens=600,
    )
    return {
        "answer": answer,
        "model": settings.ai_model,
        "context_chars": len(source),
        "context_messages": messages,
        "translate": translate,
        "reply_style": reply_style or "brief",
    }
