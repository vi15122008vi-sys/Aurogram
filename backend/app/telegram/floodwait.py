from __future__ import annotations

import asyncio
import random
from functools import wraps
from typing import Any, Callable, TypeVar

from fastapi import HTTPException
from telethon.errors import FloodWaitError

F = TypeVar("F", bound=Callable[..., Any])


async def with_floodwait(coro_factory: Callable[[], Any], retries: int = 3) -> Any:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            return await coro_factory()
        except FloodWaitError as e:
            last = e
            if attempt >= retries - 1:
                break
            await asyncio.sleep(e.seconds + random.randint(1, 5))
    seconds = getattr(last, "seconds", 60)
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
