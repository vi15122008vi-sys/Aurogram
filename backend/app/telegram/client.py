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


async def get_client(account_id: str, account: Optional[dict] = None, device_id: Optional[str] = None) -> TelegramClient:
    from app.database import fetchone

    if device_id is None:
        registered = await fetchone(
            "SELECT device_id FROM account_devices WHERE account_id = ? ORDER BY created_at LIMIT 1",
            (account_id,),
        )
        device_id = registered["device_id"] if registered else "default"
    client_key = f"{account_id}:{device_id}"
    if client_key in _clients:
        client = _clients[client_key]
        if not client.is_connected():
            await client.connect()
        return client

    api_id, api_hash = resolve_api_credentials(account)
    path = session_path(account_id, device_id)
    preferences = await fetchone("SELECT hide_device_type FROM account_preferences WHERE account_id = ?", (account_id,))
    device = dict(DEVICE)
    if preferences and preferences["hide_device_type"]:
        device.update(device_model="Unknown device", system_version="Unknown", app_version="Aurogram")
    client = TelegramClient(str(path.with_suffix("")), api_id, api_hash, **device)
    await client.connect()
    secure_session_file(path)
    _clients[client_key] = client
    return client


async def drop_client(account_id: str) -> None:
    keys = [key for key in _clients if key == account_id or key.startswith(f"{account_id}:")]
    clients = [_clients.pop(key) for key in keys]
    for client in clients:
        try:
            await client.disconnect()
        except Exception:
            pass


def make_ephemeral_client(
    session_name: str,
    api_id: int,
    api_hash: str,
    device_id: str = "default",
    hide_device_type: bool = False,
) -> TelegramClient:
    path = session_path(session_name, device_id)
    device = dict(DEVICE)
    if hide_device_type:
        device.update(device_model="Unknown device", system_version="Unknown", app_version="Aurogram")
    return TelegramClient(str(path.with_suffix("")), api_id, api_hash, **device)
