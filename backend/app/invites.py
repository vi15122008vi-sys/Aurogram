"""Пригласительные коды: проверка доступа и учёт использования.

Мастер-код из окружения (INVITE_CODE) работает всегда, даже если таблица пуста.
Остальные коды живут в SQLite (таблица invite_codes).
"""

from __future__ import annotations

import logging
import secrets
import string
from typing import Any, Optional

from app.config import get_settings
from app.database import execute, fetchall, fetchone

log = logging.getLogger("aurogram.invites")

ALPHABET = string.ascii_uppercase + string.digits
DEFAULT_PREFIX = "AURO"


def normalize(code: Optional[str]) -> str:
    """Коды сравниваем без пробелов и регистра: «auro-1234» == «AURO1234»."""
    return "".join((code or "").split()).upper()


def generate_code(prefix: str = DEFAULT_PREFIX, length: int = 8) -> str:
    body = "".join(secrets.choice(ALPHABET) for _ in range(max(4, length)))
    return f"{prefix}{body}" if prefix else body


def master_code() -> str:
    return normalize(get_settings().invite_code)


def is_master(code: Optional[str]) -> bool:
    master = master_code()
    return bool(master) and normalize(code) == master


async def find_code(code: Optional[str]) -> Optional[dict[str, Any]]:
    normalized = normalize(code)
    if not normalized:
        return None
    row = await fetchone("SELECT * FROM invite_codes WHERE code = ?", (normalized,))
    return dict(row) if row else None


async def is_valid(code: Optional[str]) -> bool:
    """Код валиден, если это мастер-код или активная запись в таблице."""
    if is_master(code):
        return True
    row = await find_code(code)
    return bool(row and row["is_active"])


async def mark_used(code: Optional[str], phone: str) -> None:
    """Записать, кто и когда использовал код (для аудита в админке)."""
    normalized = normalize(code)
    if not normalized:
        return
    row = await find_code(normalized)
    if row is None:
        if not is_master(normalized):
            return
        # Мастер-код из .env мог ни разу не попасть в таблицу — создаём запись,
        # чтобы в админке было видно использование.
        await execute(
            "INSERT OR IGNORE INTO invite_codes (code, is_active) VALUES (?, 1)",
            (normalized,),
        )
    await execute(
        "UPDATE invite_codes SET used_by = ?, last_used_at = datetime('now') WHERE code = ?",
        (phone, normalized),
    )


async def list_codes() -> list[dict[str, Any]]:
    rows = await fetchall("SELECT * FROM invite_codes ORDER BY created_at DESC, id DESC")
    return [dict(row) for row in rows]


async def create_code(code: Optional[str] = None) -> dict[str, Any]:
    normalized = normalize(code) or generate_code()
    await execute(
        "INSERT INTO invite_codes (code, is_active) VALUES (?, 1)",
        (normalized,),
    )
    row = await find_code(normalized)
    log.info("invite created: %s", normalized)
    return dict(row) if row else {"code": normalized, "is_active": 1}


async def set_active(code_id: int, active: bool) -> Optional[dict[str, Any]]:
    await execute("UPDATE invite_codes SET is_active = ? WHERE id = ?", (1 if active else 0, code_id))
    row = await fetchone("SELECT * FROM invite_codes WHERE id = ?", (code_id,))
    return dict(row) if row else None


async def delete_code(code_id: int) -> bool:
    await execute("DELETE FROM invite_codes WHERE id = ?", (code_id,))
    row = await fetchone("SELECT id FROM invite_codes WHERE id = ?", (code_id,))
    return row is None


async def ensure_master_row() -> None:
    """На старте гарантируем запись для INVITE_CODE, чтобы её было видно в админке."""
    master = master_code()
    if not master:
        return
    await execute(
        "INSERT OR IGNORE INTO invite_codes (code, is_active) VALUES (?, 1)",
        (master,),
    )
