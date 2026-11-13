"""Команды бота: меню, /start-приветствие и inline-кнопки."""

from __future__ import annotations

import json
import logging

from app.bot.client import BotError, call

log = logging.getLogger("aurogram.bot.commands")

COMMANDS = [
    {"command": "start", "description": "Запустить бота и открыть меню"},
    {"command": "help", "description": "Что умеет Aurogram"},
    {"command": "widgets", "description": "Мои виджеты"},
    {"command": "create_widget", "description": "Сгенерировать виджет с AI"},
    {"command": "settings", "description": "Настройки"},
]

MENU_KEYBOARD = {
    "inline_keyboard": [
        [{"text": "🎨 Создать виджет", "callback_data": "menu:create_widget"}],
        [{"text": "📦 Мои виджеты", "callback_data": "menu:widgets"}],
        [{"text": "⚙️ Настройки", "callback_data": "menu:settings"}],
        [{"text": "❓ Помощь", "callback_data": "menu:help"}],
    ]
}

WELCOME = (
    "Привет! Я бот Aurogram 👋\n\n"
    "Умею генерировать интерактивные виджеты (опросы, игры, таймеры), "
    "собирать стикерпаки и показывать статистику канала.\n\n"
    "Выбери действие ниже или просто пришли картинку — сделаю стикер."
)

_commands_registered = False


async def ensure_commands() -> None:
    """Регистрирует меню команд (один раз за процесс)."""
    global _commands_registered
    if _commands_registered:
        return
    try:
        await call("setMyCommands", data={"commands": json.dumps(COMMANDS, ensure_ascii=False)})
        _commands_registered = True
        log.info("bot commands registered")
    except BotError as exc:
        log.warning("setMyCommands failed: %s", exc)


async def send_menu(chat_id: int | str, text: str = WELCOME) -> None:
    await call(
        "sendMessage",
        data={
            "chat_id": str(chat_id),
            "text": text,
            "parse_mode": "HTML",
            "reply_markup": json.dumps(MENU_KEYBOARD),
        },
    )


async def answer_callback(callback_id: str, text: str) -> None:
    try:
        await call("answerCallbackQuery", data={"callback_query_id": callback_id, "text": text})
    except BotError as exc:
        log.warning("answerCallbackQuery failed: %s", exc)


async def reply(chat_id: int | str, text: str) -> None:
    try:
        await call("sendMessage", data={"chat_id": str(chat_id), "text": text, "parse_mode": "HTML"})
    except BotError as exc:
        log.warning("sendMessage failed: %s", exc)
