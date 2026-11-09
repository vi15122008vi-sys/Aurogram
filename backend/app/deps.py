from __future__ import annotations

import secrets
from typing import Annotated, Optional

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Cookie, Depends, Header, HTTPException, status

from app.config import Settings, get_settings
from app.database import fetchone


def get_fernet(settings: Settings | None = None) -> Fernet:
    settings = settings or get_settings()
    key = settings.secret_key.strip()
    if not key:
        raise RuntimeError("SECRET_KEY is not set")
    try:
        return Fernet(key.encode() if not key.startswith("gAAAA") else key.encode())
    except Exception:
        # Allow raw 32-url-safe-base64 or generate-compatible keys
        try:
            return Fernet(key.encode())
        except Exception as exc:
            raise RuntimeError("SECRET_KEY must be a valid Fernet key") from exc


def encrypt_secret(value: str, settings: Settings | None = None) -> str:
    return get_fernet(settings).encrypt(value.encode()).decode()


def decrypt_secret(token: str, settings: Settings | None = None) -> str:
    try:
        return get_fernet(settings).decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Не удалось расшифровать ключ") from exc


def new_auth_token() -> str:
    return secrets.token_urlsafe(32)


async def get_account_by_token(token: str) -> dict:
    row = await fetchone("SELECT * FROM accounts WHERE token = ?", (token,))
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Требуется вход")
    return dict(row)


async def get_current_account(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[Optional[str], Header()] = None,
    auth_token: Annotated[Optional[str], Cookie()] = None,
    x_auth_token: Annotated[Optional[str], Header(alias="X-Auth-Token")] = None,
) -> dict:
    token = x_auth_token or auth_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Требуется вход")
    account = await get_account_by_token(token)
    return account


async def get_optional_account(
    authorization: Annotated[Optional[str], Header()] = None,
    auth_token: Annotated[Optional[str], Cookie()] = None,
    x_auth_token: Annotated[Optional[str], Header(alias="X-Auth-Token")] = None,
) -> Optional[dict]:
    token = x_auth_token or auth_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        return None
    row = await fetchone("SELECT * FROM accounts WHERE token = ?", (token,))
    return dict(row) if row else None


def require_admin_action_token(
    settings: Settings,
    x_admin_action_token: Annotated[Optional[str], Header(alias="X-Admin-Action-Token")] = None,
) -> None:
    expected = settings.admin_action_token
    if not expected or x_admin_action_token != expected:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Неверный action token")
