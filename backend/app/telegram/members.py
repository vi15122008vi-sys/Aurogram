from __future__ import annotations

from typing import Any

from telethon.tl.types import ChannelParticipantsAdmins

from app.models import MemberOut
from app.telegram.client import get_client
from app.telegram.floodwait import with_floodwait


def _member(user: Any, tag: str | None = None) -> MemberOut:
    name = " ".join(
        filter(None, [getattr(user, "first_name", None), getattr(user, "last_name", None)])
    ).strip() or (user.username or str(user.id))
    return MemberOut(
        id=user.id,
        name=name,
        username=getattr(user, "username", None),
        tag=tag,
        is_bot=bool(getattr(user, "bot", False)),
    )


async def list_members(account: dict, chat_id: int, limit: int = 200) -> list[MemberOut]:
    client = await get_client(account["id"], account)
    participants = await with_floodwait(
        lambda: client.get_participants(chat_id, limit=limit)
    )
    return [_member(u) for u in participants]


async def list_admins(account: dict, chat_id: int) -> list[MemberOut]:
    client = await get_client(account["id"], account)
    participants = await with_floodwait(
        lambda: client.get_participants(chat_id, filter=ChannelParticipantsAdmins)
    )
    return [_member(u, tag="admin") for u in participants]
