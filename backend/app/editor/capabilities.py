from __future__ import annotations


def capabilities(premium: bool = False) -> dict:
    return {
        "max_length": 32768,
        "markdown": True,
        "html": True,
        "headings": premium,
        "tables_as_image": True,
        "spoiler": premium,
        "blockquote": True,
        "code": True,
        "premium_required_for": ["h1", "h2", "h3", "details"] if not premium else [],
        "notice": None
        if premium
        else "Расширенное форматирование требует Telegram Premium",
    }
