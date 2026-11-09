from __future__ import annotations

import mimetypes
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.cache.manager import touch_cached_media
from app.deps import get_current_account
from app.models import MessageOut
from app.telegram.media import download_message_media, resolve_media_file
from app.telegram.messages import delete_message, list_messages, send_message

router = APIRouter(prefix="/messages", tags=["messages"])


class MessageCreate(BaseModel):
    chat_id: int
    text: str = Field(min_length=1, max_length=4096)
    parse_mode: Literal["html", "md"] | None = "html"


@router.get("", response_model=list[MessageOut])
async def messages(
    chat_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    offset_id: int = Query(default=0, ge=0),
    ghost: bool = True,
    account: dict[str, Any] = Depends(get_current_account),
) -> list[MessageOut]:
    return await list_messages(
        account,
        chat_id,
        limit=limit,
        offset_id=offset_id,
        ghost=ghost,
    )


@router.post("", response_model=MessageOut, status_code=201)
async def create_message(
    payload: MessageCreate,
    account: dict[str, Any] = Depends(get_current_account),
) -> MessageOut:
    return await send_message(
        account,
        payload.chat_id,
        payload.text,
        parse_mode=payload.parse_mode,
    )


@router.delete("/{chat_id}/{message_id}", status_code=204)
async def remove_message(
    chat_id: int,
    message_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> None:
    await delete_message(account, chat_id, message_id)


@router.get("/{chat_id}/{message_id}/media")
async def message_media(
    chat_id: int,
    message_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> FileResponse:
    path = resolve_media_file(account["id"], chat_id, message_id)
    if path is None or not path.is_file():
        path = await download_message_media(account, chat_id, message_id)
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="Медиафайл не найден")
    await touch_cached_media(account["id"], path, chat_id, message_id)
    media_type, _ = mimetypes.guess_type(path.name)
    return FileResponse(
        path,
        media_type=media_type or "application/octet-stream",
        filename=path.name,
    )