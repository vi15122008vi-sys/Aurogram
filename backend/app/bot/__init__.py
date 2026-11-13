"""Интеграция Aurogram Studio с Telegram-ботом (Bot API)."""

from app.bot.client import BotError, create_sticker_set, get_me, get_updates, send_message, send_photo, set_webhook, webhook_info

__all__ = [
    "BotError",
    "create_sticker_set",
    "get_me",
    "get_updates",
    "send_message",
    "send_photo",
    "set_webhook",
    "webhook_info",
]
