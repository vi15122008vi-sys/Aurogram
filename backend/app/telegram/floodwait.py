from __future__ import annotations

import asyncio
import logging
import random
from functools import wraps
from typing import Any, Callable, TypeVar

from fastapi import HTTPException
from telethon.errors import FloodWaitError

F = TypeVar("F", bound=Callable[..., Any])

log = logging.getLogger("aurogram.floodwait")

# Telegram отдаёт точный лимит, но одинаковые паузы выглядят как бот.
# Добавляем джиттер, чтобы запросы не «слипались» в одну секунду.
MIN_JITTER = 1.0
MAX_JITTER = 5.0


def _delay_seconds(error: FloodWaitError, attempt: int) -> float:
    base = max(0, int(getattr(error, "seconds", 60) or 0))
    jitter = random.uniform(MIN_JITTER, MAX_JITTER)
    return base + jitter + attempt * 2


async def with_floodwait(coro_factory: Callable[[], Any], retries: int = 3) -> Any:
    last: FloodWaitError | None = None
    for attempt in range(retries):
        try:
            return await coro_factory()
        except FloodWaitError as e:
            last = e
            if attempt >= retries - 1:
                break
            delay = _delay_seconds(e, attempt)
            log.warning(
                "flood wait: пауза %.1f с (лимит %s с, попытка %s/%s)",
                delay,
                getattr(e, "seconds", "?"),
                attempt + 1,
                retries,
            )
            await asyncio.sleep(delay)
    seconds = max(0, int(getattr(last, "seconds", 60) or 60))
    raise HTTPException(
        status_code=429,
        detail=f"Слишком много попыток. Подождите {seconds} секунд.",
        headers={"Retry-After": str(seconds)},
    )


def floodwait(retries: int = 3) -> Callable[[F], F]:
    def decorator(fn: F) -> F:
        @wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            return await with_floodwait(lambda: fn(*args, **kwargs), retries=retries)

        return wrapper  # type: ignore[return-value]

    return decorator
