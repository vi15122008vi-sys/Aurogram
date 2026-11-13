"""Проверки конфигурации секретов и аудит шифрования в базе.

Чувствительные значения (api_id, api_hash, токены ботов) обязаны лежать в БД
только в зашифрованном виде — Fernet-токены имеют префикс `gAAAA`. Этот модуль
позволяет убедиться в этом без ручной инспекции SQLite.
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings
from app.deps import get_fernet
from app.database import fetchall

log = logging.getLogger("aurogram.security")

FERNET_PREFIX = "gAAAA"


def is_encrypted(value: str | None) -> bool:
    return bool(value) and str(value).startswith(FERNET_PREFIX)


def ensure_secret_key() -> bool:
    """Падаем громко при старте, если SECRET_KEY непригоден для Fernet."""
    settings = get_settings()
    if not settings.secret_key.strip():
        log.error(
            "SECRET_KEY не задан: шифрование ключей и токенов ботов отключено. "
            "Задайте SECRET_KEY (Fernet) в окружении."
        )
        return False
    try:
        get_fernet(settings)
    except RuntimeError as exc:
        log.error("SECRET_KEY не является валидным Fernet-ключом: %s", exc)
        return False
    return True


async def audit_secrets() -> dict[str, Any]:
    """Ищет в БД незашифрованные api_hash и токены ботов."""
    accounts = await fetchall("SELECT id, api_id_enc, api_hash_enc FROM accounts")
    bots = await fetchall("SELECT id, username, token_enc FROM bots")

    plain_accounts = [
        row["id"]
        for row in accounts
        if (row["api_hash_enc"] and not is_encrypted(row["api_hash_enc"]))
        or (row["api_id_enc"] and not is_encrypted(row["api_id_enc"]))
    ]
    plain_bots = [
        row["username"] or str(row["id"])
        for row in bots
        if row["token_enc"] and not is_encrypted(row["token_enc"])
    ]

    if plain_accounts or plain_bots:
        log.error(
            "обнаружены незашифрованные секреты: аккаунты=%s, боты=%s. "
            "Перезапишите их через повторную авторизацию / повторный ввод токена.",
            len(plain_accounts),
            len(plain_bots),
        )
    else:
        log.info("audit: все секреты в БД зашифрованы (аккаунтов %s, ботов %s)", len(accounts), len(bots))

    return {
        "accounts_total": len(accounts),
        "bots_total": len(bots),
        "plaintext_accounts": plain_accounts,
        "plaintext_bots": plain_bots,
        "ok": not plain_accounts and not plain_bots,
    }
