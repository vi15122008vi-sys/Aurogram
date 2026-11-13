from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.deps import get_current_account
from app.database import execute, fetchall
from app.cache.manager import search_cached
from app.models import ChatOut, MemberOut, MessageOut
from app.telegram.chats import get_chat, get_story_avatar, get_story_media, list_chats, list_stories, read_stories
from app.telegram.members import list_admins, list_members
from app.telegram.messages import delete_message, list_messages, send_message

router = APIRouter(prefix="/chats", tags=["chats"])

SESSION_ERRORS = ("AuthKeyUnregistered", "SessionRevoked", "UserDeactivated", "AuthKeyDuplicated")


def telegram_error(exc: Exception) -> HTTPException:
    """Невалидная сессия Telegram — это 401, а не сетевой сбой на клиенте."""
    name = type(exc).__name__
    if any(code in name for code in SESSION_ERRORS):
        return HTTPException(
            status_code=401,
            detail="Сессия Telegram недействительна. Войдите в аккаунт заново.",
        )
    return HTTPException(status_code=502, detail="Telegram не ответил. Попробуйте позже.")


class StoryReadRequest(BaseModel):
    story_ids: list[int] = Field(default_factory=list, max_length=50)


class MessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=4096)
    parse_mode: str | None = "html"


class ChatArchiveUpdate(BaseModel):
    archived: bool


class ChatFolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=32)


class ChatFolderAssignment(BaseModel):
    folder_id: int | None = None


@router.get("/search/global")
async def global_search(
    q: str = Query(min_length=2, max_length=100),
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, list[dict[str, Any]]]:
    return await search_cached(account["id"], q, limit=40)


@router.get("/folders")
async def list_chat_folders(
    account: dict[str, Any] = Depends(get_current_account),
) -> list[dict[str, Any]]:
    folders = await fetchall("SELECT id, name FROM chat_folders WHERE account_id = ? ORDER BY created_at, id", (account["id"],))
    assignments = await fetchall("SELECT folder_id, chat_id FROM chat_folder_chats WHERE account_id = ?", (account["id"],))
    chat_ids: dict[int, list[int]] = {}
    for row in assignments:
        chat_ids.setdefault(int(row["folder_id"]), []).append(int(row["chat_id"]))
    return [{"id": int(folder["id"]), "name": folder["name"], "chat_ids": chat_ids.get(int(folder["id"]), [])} for folder in folders]


@router.post("/folders", status_code=201)
async def create_chat_folder(
    payload: ChatFolderCreate,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Название папки не может быть пустым")
    existing = await fetchone("SELECT id FROM chat_folders WHERE account_id = ? AND name = ? COLLATE NOCASE", (account["id"], name))
    if existing:
        raise HTTPException(status_code=409, detail="Папка с таким названием уже существует")
    folder_id = await execute("INSERT INTO chat_folders (account_id, name) VALUES (?, ?)", (account["id"], name))
    return {"id": folder_id, "name": name, "chat_ids": []}


@router.put("/{chat_id}/folder")
async def assign_chat_folder(
    chat_id: int,
    payload: ChatFolderAssignment,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    if payload.folder_id is None:
        await execute("DELETE FROM chat_folder_chats WHERE account_id = ? AND chat_id = ?", (account["id"], chat_id))
    else:
        folder = await fetchone("SELECT id FROM chat_folders WHERE id = ? AND account_id = ?", (payload.folder_id, account["id"]))
        if not folder:
            raise HTTPException(status_code=404, detail="Папка не найдена")
        await execute(
            """INSERT INTO chat_folder_chats (account_id, folder_id, chat_id) VALUES (?, ?, ?)
               ON CONFLICT(account_id, chat_id) DO UPDATE SET folder_id = excluded.folder_id""",
            (account["id"], payload.folder_id, chat_id),
        )
    return {"chat_id": chat_id, "folder_id": payload.folder_id}


@router.get("", response_model=list[ChatOut])
async def chats(
    limit: int = Query(default=100, ge=1, le=200),
    archived: bool = False,
    account: dict[str, Any] = Depends(get_current_account),
) -> list[ChatOut]:
    rows = await fetchall(
        "SELECT chat_id FROM archived_chats WHERE account_id = ?",
        (account["id"],),
    )
    archived_ids = {int(row["chat_id"]) for row in rows}
    try:
        return await list_chats(account, limit=limit, archived_ids=archived_ids, archived=archived)
    except HTTPException:
        raise
    except Exception as exc:
        raise telegram_error(exc) from exc


@router.get("/stories")
async def stories(
    account: dict[str, Any] = Depends(get_current_account),
) -> list[dict[str, Any]]:
    try:
        return await list_stories(account)
    except HTTPException:
        raise
    except Exception as exc:
        # Истории не должны ломать экран чатов: отдаём пустой список вместо 500.
        logging.getLogger("aurogram.chats").warning("stories: %s", exc)
        raise telegram_error(exc) from exc


@router.get("/stories/{peer_id}/media")
async def story_media(
    peer_id: int,
    story_id: int = Query(default=0, ge=0),
    account: dict[str, Any] = Depends(get_current_account),
) -> Response:
    try:
        result = await get_story_media(account, peer_id, story_id)
    except Exception as exc:
        raise telegram_error(exc) from exc
    if not result:
        raise HTTPException(status_code=404, detail="Медиа истории не найдено")
    content, media_type = result
    return Response(content=content, media_type=media_type, headers={"Cache-Control": "private, max-age=300"})


@router.post("/stories/{peer_id}/read")
async def story_read(
    peer_id: int,
    payload: StoryReadRequest,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    try:
        read_until = await read_stories(account, peer_id, payload.story_ids)
    except Exception as exc:
        raise telegram_error(exc) from exc
    return {"status": "ok", "read_until": read_until}


@router.get("/stories/{peer_id}/avatar")
async def story_avatar(
    peer_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> Response:
    image = await get_story_avatar(account, peer_id)
    if not image:
        raise HTTPException(status_code=404, detail="Аватар не найден")
    return Response(content=image, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=300"})


@router.get("/{chat_id}/avatar")
async def chat_avatar(
    chat_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> Response:
    image = await get_story_avatar(account, chat_id)
    if not image:
        raise HTTPException(status_code=404, detail="Аватар не найден")
    return Response(content=image, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=300"})


@router.put("/{chat_id}/archive")
async def update_chat_archive(
    chat_id: int,
    payload: ChatArchiveUpdate,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, int | bool]:
    if payload.archived:
        await execute(
            "INSERT OR IGNORE INTO archived_chats (account_id, chat_id) VALUES (?, ?)",
            (account["id"], chat_id),
        )
    else:
        await execute(
            "DELETE FROM archived_chats WHERE account_id = ? AND chat_id = ?",
            (account["id"], chat_id),
        )
    return {"chat_id": chat_id, "archived": payload.archived}


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
