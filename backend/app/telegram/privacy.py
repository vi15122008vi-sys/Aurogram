from __future__ import annotations

from telethon.tl.functions.account import SetPrivacyRequest
from telethon.tl.types import (
    InputPrivacyKeyStatusTimestamp,
    InputPrivacyValueAllowAll,
    InputPrivacyValueDisallowAll,
)

from app.telegram.client import get_client
from app.telegram.floodwait import with_floodwait


async def set_online_visibility(account: dict, hidden: bool) -> None:
    client = await get_client(account["id"], account)
    rule = InputPrivacyValueDisallowAll() if hidden else InputPrivacyValueAllowAll()
    await with_floodwait(
        lambda: client(SetPrivacyRequest(InputPrivacyKeyStatusTimestamp(), [rule]))
    )
