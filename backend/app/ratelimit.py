from __future__ import annotations

import logging
import time
from collections import deque
from typing import Callable

from fastapi import HTTPException, Request

log = logging.getLogger("aurogram.ratelimit")


class SlidingWindowLimiter:
    """Скользящее окно в памяти процесса: не более N событий за window секунд."""

    def __init__(self, limit: int, window: float = 60.0, max_keys: int = 5000) -> None:
        self.limit = limit
        self.window = window
        self.max_keys = max_keys
        self._hits: dict[str, deque[float]] = {}

    def _prune(self, now: float) -> None:
        if len(self._hits) <= self.max_keys:
            return
        stale = [key for key, bucket in self._hits.items() if not bucket or now - bucket[-1] > self.window]
        for key in stale:
            self._hits.pop(key, None)

    def retry_after(self, key: str) -> float:
        """Регистрирует попытку. Возвращает 0.0 если можно, иначе — сколько ждать."""
        now = time.monotonic()
        bucket = self._hits.setdefault(key, deque())
        while bucket and now - bucket[0] >= self.window:
            bucket.popleft()
        if len(bucket) >= self.limit:
            return max(1.0, self.window - (now - bucket[0]))
        bucket.append(now)
        self._prune(now)
        return 0.0


def client_ip(request: Request) -> str:
    """IP клиента с учётом прокси (Caddy прокидывает X-Forwarded-For)."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"


def limit_requests(limiter: SlidingWindowLimiter, scope: str) -> Callable[..., None]:
    """Готовая FastAPI-зависимость: `dependencies=[Depends(limit_requests(...))]`."""

    async def dependency(request: Request) -> None:
        key = f"{scope}:{client_ip(request)}"
        retry = limiter.retry_after(key)
        if retry:
            log.warning("rate limit hit: %s, retry in %.1fs", key, retry)
            raise HTTPException(
                status_code=429,
                detail="Слишком много попыток. Попробуйте позже.",
                headers={"Retry-After": str(int(retry) + 1)},
            )

    return dependency


# Лимиты для чувствительных эндпоинтов авторизации.
SIGN_IN_LIMITER = SlidingWindowLimiter(limit=5, window=60.0)
SEND_CODE_LIMITER = SlidingWindowLimiter(limit=5, window=60.0)
RECOVER_LIMITER = SlidingWindowLimiter(limit=3, window=300.0)
QR_LIMITER = SlidingWindowLimiter(limit=10, window=60.0)
ADMIN_LOGIN_LIMITER = SlidingWindowLimiter(limit=5, window=300.0)
# AI тратит внешние токены — держим недорогой лимит на пользователя.
AI_LIMITER = SlidingWindowLimiter(limit=10, window=60.0)
