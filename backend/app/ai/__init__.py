"""AI-функции Aurogram: суммаризация, вопросы по переписке, генерация виджетов."""

from app.ai.client import (
    AiError,
    AiNotConfigured,
    ask_with_context,
    generate_widget,
    summarize_text,
)

__all__ = [
    "AiError",
    "AiNotConfigured",
    "ask_with_context",
    "generate_widget",
    "summarize_text",
]
