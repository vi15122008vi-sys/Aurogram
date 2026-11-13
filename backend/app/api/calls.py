"""Сигнальный сервер звонков: комнаты на 2 участника, обмен SDP/ICE.

Сервер ничего не знает про медиа — он только пересылает offer/answer/ICE
между двумя подключёнными к одной комнате участниками.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.database import fetchone

router = APIRouter(prefix="/calls", tags=["calls"])

log = logging.getLogger("aurogram.calls")

MAX_PEERS = 2
ALLOWED_TYPES = {"offer", "answer", "ice", "hangup", "ring"}


class Room:
    def __init__(self) -> None:
        self.peers: dict[str, WebSocket] = {}
        self.lock = asyncio.Lock()


rooms: dict[str, Room] = {}


async def _account_from(websocket: WebSocket) -> Optional[dict[str, Any]]:
    token = websocket.query_params.get("token") or websocket.cookies.get("auth_token")
    if not token:
        return None
    if isinstance(token, str) and token.lower().startswith("bearer "):
        token = token[7:].strip()
    row = await fetchone("SELECT id, name FROM accounts WHERE token = ?", (token,))
    return dict(row) if row else None


async def _broadcast(room: Room, payload: dict[str, Any], exclude: str) -> None:
    message = json.dumps(payload)
    for peer_id, socket in list(room.peers.items()):
        if peer_id == exclude:
            continue
        try:
            await socket.send_text(message)
        except Exception:  # сокет уже закрылся — вычистим ниже
            room.peers.pop(peer_id, None)


@router.websocket("/ws/{room_id}")
async def call_signaling(websocket: WebSocket, room_id: str) -> None:
    account = await _account_from(websocket)
    if not account:
        await websocket.close(code=4401)
        return

    room = rooms.setdefault(room_id, Room())
    peer_id = f"{account['id'][:8]}-{uuid4().hex[:6]}"
    async with room.lock:
        if len(room.peers) >= MAX_PEERS:
            await websocket.accept()
            await websocket.send_json({"type": "error", "detail": "Комната занята: максимум два участника"})
            await websocket.close(code=4409)
            return
        await websocket.accept()
        room.peers[peer_id] = websocket

    log.info("call room %s: peer %s joined (%s peers)", room_id, peer_id, len(room.peers))
    try:
        await websocket.send_json({"type": "ready", "peer": peer_id, "peers": len(room.peers)})
        await _broadcast(room, {"type": "peers", "count": len(room.peers)}, exclude=peer_id)

        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except ValueError:
                continue
            if payload.get("type") not in ALLOWED_TYPES:
                continue
            payload["from"] = peer_id
            await _broadcast(room, payload, exclude=peer_id)
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # не роняем сервер из-за одного сокета
        log.warning("call socket error in room %s: %s", room_id, exc)
    finally:
        room.peers.pop(peer_id, None)
        await _broadcast(room, {"type": "peers", "count": len(room.peers), "left": peer_id}, exclude=peer_id)
        if not room.peers:
            rooms.pop(room_id, None)
        log.info("call room %s: peer %s left (%s peers)", room_id, peer_id, len(room.peers))


@router.get("/rooms")
async def active_rooms() -> dict[str, Any]:
    """Диагностика: сколько комнат и участников сейчас в памяти процесса."""
    return {
        "rooms": [
            {"room": room_id, "peers": len(room.peers)}
            for room_id, room in rooms.items()
            if room.peers
        ]
    }
