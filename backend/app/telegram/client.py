from __future__ import annotations

from typing import Optional

from telethon import TelegramClient

from app.config import get_settings
from app.deps import decrypt_secret
from app.telegram.sessions import secure_session_file, session_path

_clients: dict[str, TelegramClient] = {}


DEVICE = dict(
    device_model="iPhone 14",
    system_version="iOS 16.6",
    app_version="10.14.5",
    lang_code="ru",
    system_lang_code="ru",
)


def resolve_api_credentials(account: Optional[dict] = None) -> tuple[int, str]:
    settings = get_settings()
    if (
        settings.allow_per_account_keys
        and account
        and account.get("api_id_enc")
        and account.get("api_hash_enc")
    ):
        api_id = int(decrypt_secret(account["api_id_enc"]))
        api_hash = decrypt_secret(account["api_hash_enc"])
        return api_id, api_hash
    if not settings.api_id or not settings.api_hash:
        raise RuntimeError("API_ID / API_HASH не заданы")
    return settings.api_id, settings.api_hash


async def get_client(account_id: str, account: Optional[dict] = None) -> TelegramClient:
    if account_id in _clients:
        client = _clients[account_id]
        if not client.is_connected():
            await client.connect()
        return client

    api_id, api_hash = resolve_api_credentials(account)
    path = session_path(account_id)
    client = TelegramClient(str(path.with_suffix("")), api_id, api_hash, **DEVICE)
    await client.connect()
    secure_session_file(path)
    _clients[account_id] = client
    return client


async def drop_client(account_id: str) -> None:
    client = _clients.pop(account_id, None)
    if client:
        try:
            await client.disconnect()
        except Exception:
            pass


def make_ephemeral_client(session_name: str, api_id: int, api_hash: str) -> TelegramClient:
    path = session_path(session_name)
    return TelegramClient(str(path.with_suffix("")), api_id, api_hash, **DEVICE)
