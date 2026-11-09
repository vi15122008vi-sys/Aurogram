from __future__ import annotations

from app.textstyles.fonts import STYLE_META, STYLES


def list_styles() -> list[dict]:
    return STYLE_META


def convert(text: str, style: str) -> str:
    table = STYLES.get(style)
    if not table:
        return text
    return "".join(table.get(ch, ch) for ch in text)


def detect(text: str) -> list[str]:
    found: list[str] = []
    for name, table in STYLES.items():
        values = set(table.values())
        if any(ch in values for ch in text):
            found.append(name)
    return found


def strip_styles(text: str) -> str:
    reverse: dict[str, str] = {}
    for table in STYLES.values():
        for k, v in table.items():
            reverse[v] = k
    return "".join(reverse.get(ch, ch) for ch in text)
