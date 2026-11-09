from __future__ import annotations

from typing import Any

from app.editor.capabilities import capabilities
from app.editor.html_renderer import blocks_to_html
from app.editor.image_fallback import maybe_table_from_markdown
from app.editor.markdown_to_json import markdown_to_json


def preview(markdown: str, premium: bool = False) -> dict[str, Any]:
    blocks = markdown_to_json(markdown)
    try:
        html, warnings = blocks_to_html(blocks, premium=premium)
    except ValueError as e:
        return {"ok": False, "error": str(e), "capabilities": capabilities(premium)}
    table_png = maybe_table_from_markdown(markdown)
    if table_png:
        warnings.append("Будет отправлена как изображение")
    plain = markdown or ""
    return {
        "ok": True,
        "html": html,
        "blocks": blocks,
        "plain_length": len(plain),
        "max_length": 32768,
        "warnings": warnings,
        "table_image": bool(table_png),
        "capabilities": capabilities(premium),
    }


def to_telethon_html(markdown: str, premium: bool = False) -> tuple[str, list[str]]:
    blocks = markdown_to_json(markdown)
    return blocks_to_html(blocks, premium=premium)
