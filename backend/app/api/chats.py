from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.deps import get_current_account
from app.models import ChatOut, MemberOut, MessageOut
from app.telegram.chats import get_chat, list_chats
from app.telegram.members import list_admins, list_members
from app.telegram.messages import delete_message, list_messages, send_message

router = APIRouter(prefix="/chats", tags=["chats"])


class MessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=4096)
    parse_mode: str | None = "html"


@router.get("", response_model=list[ChatOut])
async def chats(
    limit: int = Query(default=100, ge=1, le=200),
    account: dict[str, Any] = Depends(get_current_account),
) -> list[ChatOut]:
    return await list_chats(account, limit=limit)


@router.get("/{chat_id}", response_model=ChatOut)
async def chat(
    chat_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> ChatOut:
    result = await get_chat(account, chat_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Чат не найден")
    return result


@router.get("/{chat_id}/messages", response_model=list[MessageOut])
async def messages(
    chat_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset_id: int = Query(default=0, ge=0),
    ghost: bool = True,
    account: dict[str, Any] = Depends(get_current_account),
) -> list[MessageOut]:
    return await list_messages(account, chat_id, limit=limit, offset_id=offset_id, ghost=ghost)


@router.post("/{chat_id}/messages", response_model=MessageOut, status_code=201)
async def create_message(
    chat_id: int,
    payload: MessageCreate,
    account: dict[str, Any] = Depends(get_current_account),
) -> MessageOut:
    if payload.parse_mode not in {None, "html", "md"}:
        raise HTTPException(status_code=422, detail="Поддерживаются только html и md")
    return await send_message(account, chat_id, payload.text, parse_mode=payload.parse_mode)


@router.delete("/{chat_id}/messages/{message_id}", status_code=204)
async def remove_message(
    chat_id: int,
    message_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> Response:
    await delete_message(account, chat_id, message_id)
    return Response(status_code=204)


@router.get("/{chat_id}/members", response_model=list[MemberOut])
async def members(
    chat_id: int,
    limit: int = Query(default=200, ge=1, le=1000),
    account: dict[str, Any] = Depends(get_current_account),
) -> list[MemberOut]:
    return await list_members(account, chat_id, limit=limit)


@router.get("/{chat_id}/admins", response_model=list[MemberOut])
async def admins(
    chat_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> list[MemberOut]:
    return await list_admins(account, chat_id)