"""Стикер-мейкер: фото → прозрачный PNG → статический стикерпак через Bot API.

rembg подключается опционально: если пакет не установлен (или модель не скачана),
стикер делается без удаления фона, а в ответе приходит removed_background=false.
Создание пака идёт через Bot API `createNewStickerSet` (наш bot.client),
aiogram для этого не нужен.
"""

from __future__ import annotations

import io
import logging
from typing import Any

from PIL import Image

from app.bot.client import BotError, create_sticker_set, send_message
from app.config import get_settings

log = logging.getLogger("aurogram.stickers")

STICKER_SIDE = 512
MAX_BYTES = 512 * 1024


# u2netp — лёгкая модель (~4 МБ вместо ~170 МБ у u2net):
# образ не раздувается, фон режется чуть грубее, но для стикеров этого достаточно.
REMBG_MODEL = "u2netp"
_session: Any = None


def _session_instance() -> Any:
    """Ленивая сессия rembg с моделью u2netp (скачивается один раз)."""
    global _session
    if _session is None:
        from rembg import new_session  # noqa: PLC0415

        _session = new_session(REMBG_MODEL)
    return _session


def _has_rembg() -> bool:
    try:
        import rembg  # noqa: F401
    except Exception:  # ImportError или сбой модели
        return False
    return True


def remove_background(data: bytes) -> bytes:
    """Удаляет фон через rembg(u2netp). При отсутствии библиотеки возвращает исходник."""
    try:
        from rembg import remove  # noqa: PLC0415

        return remove(data, session=_session_instance())
    except Exception as exc:  # модель не скачана / нет памяти
        log.warning("rembg недоступен: %s", exc)
        return data


def prepare_sticker(data: bytes, cut_background: bool = True) -> tuple[bytes, bool]:
    """Готовит PNG 512×512 с прозрачным фоном. Возвращает (png, фон_удалён)."""
    source = data
    removed = False
    if cut_background:
        processed = remove_background(data)
        removed = processed is not data
        source = processed

    image = Image.open(io.BytesIO(source)).convert("RGBA")
    image.thumbnail((STICKER_SIDE, STICKER_SIDE), Image.LANCZOS)
    canvas = Image.new("RGBA", (STICKER_SIDE, STICKER_SIDE), (0, 0, 0, 0))
    canvas.paste(image, ((STICKER_SIDE - image.width) // 2, (STICKER_SIDE - image.height) // 2), image)

    output = io.BytesIO()
    canvas.save(output, format="PNG", optimize=True)
    payload = output.getvalue()
    if len(payload) > MAX_BYTES:
        # Telegram жёстко ограничивает стикер 512 КБ — ужимаем палитрой.
        quantized = canvas.convert("RGB").quantize(colors=256, method=Image.MEDIANCUT)
        output = io.BytesIO()
        canvas.save(output, format="PNG", optimize=True)
        payload = output.getvalue()
    return payload, removed


def _slug(title: str, owner_id: int) -> str:
    base = "".join(char for char in title.lower() if char.isalnum())[:24] or "aurogram"
    return f"{base}_by_aurogram{str(owner_id)[-4:]}_sticker"


async def send_hint(chat_id: int | str) -> bool:
    """Подсказка в личку: как сделать стикер."""
    settings = get_settings()
    if not settings.bot_token:
        return False
    try:
        await send_message(
            chat_id,
            "Скинь мне картинку, и я сделаю стикер! 🎨\n"
            "Можно прямо сюда в чат — верну готовый пак со ссылкой.",
        )
        return True
    except BotError as exc:
        log.warning("send_hint failed: %s", exc)
        return False


async def publish_pack(
    *,
    owner_id: int,
    title: str,
    stickers: list[bytes],
    emoji: str = "⭐",
    desired_name: str | None = None,
) -> dict[str, Any]:
    """Создаёт стикерпак и уведомляет владельца ссылкой."""
    name = desired_name or _slug(title, owner_id)
    result = await create_sticker_set(
        user_id=owner_id,
        name=name,
        title=title[:64] or "Aurogram stickers",
        stickers=stickers,
        emoji=emoji,
    )
    link = f"https://t.me/addstickers/{name}"
    notified = False
    try:
        await send_message(owner_id, f"Стикер готов! Открой: {link}")
        notified = True
    except BotError as exc:
        log.warning("sticker notify failed: %s", exc)
    return {"name": name, "link": link, "count": len(stickers), "notified": notified, "raw": result}


async def create_multi_sticker(
    *,
    owner_id: int,
    title: str,
    photos: list[bytes],
    cut_background: bool = True,
    emoji: str = "⭐",
) -> dict[str, Any]:
    """Список фото → один стикерпак с несколькими стикерами (+ личка со ссылкой)."""
    settings = get_settings()
    if not settings.bot_token:
        raise BotError("BOT_TOKEN не задан — создание стикеров недоступно")
    if not photos:
        raise BotError("Нужен хотя бы один файл")
    if len(photos) > 50:
        raise BotError("Не больше 50 стикеров в паке")

    prepared: list[bytes] = []
    removed_any = False
    for photo in photos:
        sticker, removed = prepare_sticker(photo, cut_background=cut_background)
        prepared.append(sticker)
        removed_any = removed_any or removed

    pack = await publish_pack(owner_id=owner_id, title=title, stickers=prepared, emoji=emoji)
    return {
        "status": "ok",
        "name": pack["name"],
        "link": pack["link"],
        "count": pack["count"],
        "removed_background": removed_any,
        "notified": pack["notified"],
        "size_bytes": sum(len(item) for item in prepared),
    }


async def create_single_sticker(
    *,
    owner_id: int,
    title: str,
    photo: bytes,
    cut_background: bool = True,
    emoji: str = "⭐",
) -> dict[str, Any]:
    """Фото → стикер → пак из одного стикера (+ личка со ссылкой)."""
    settings = get_settings()
    if not settings.bot_token:
        raise BotError("BOT_TOKEN не задан — создание стикеров недоступно")
    sticker, removed = prepare_sticker(photo, cut_background=cut_background)
    pack = await publish_pack(owner_id=owner_id, title=title, stickers=[sticker], emoji=emoji)
    return {
        "status": "ok",
        "name": pack["name"],
        "link": pack["link"],
        "count": pack["count"],
        "removed_background": removed,
        "notified": pack["notified"],
        "size_bytes": len(sticker),
    }
