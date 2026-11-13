from __future__ import annotations

import secrets

from app.config import get_settings


def allowed_user_ids() -> set[int]:
    """Кому вообще разрешено писать боту. Пусто — никому (только бэкенд)."""
    return get_settings().bot_allowed_ids()


def is_allowed_user(user_id: int | str | None) -> bool:
    if user_id is None:
        return False
    try:
        numeric = int(user_id)
    except (TypeError, ValueError):
        return False
    return numeric in allowed_user_ids()


def internal_secret() -> str:
    return get_settings().bot_internal_secret.strip()


def is_internal_request(provided: str | None) -> bool:
    """Запрос пришёл от нашего бэкенда/Telegram-вебхука с общим секретом."""
    expected = internal_secret()
    if not expected or not provided:
        return False
    return secrets.compare_digest(provided, expected)
