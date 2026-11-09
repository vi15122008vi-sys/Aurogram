from __future__ import annotations

import html
from typing import Any


def blocks_to_html(blocks: list[dict[str, Any]], premium: bool = False) -> tuple[str, list[str]]:
    warnings: list[str] = []
    parts: list[str] = []
    for b in blocks:
        t = b.get("type")
        if t == "heading":
            level = int(b.get("level") or 1)
            text = html.escape(b.get("text") or "")
            if not premium:
                warnings.append("Для расширенного форматирования нужен Premium")
                parts.append(f"<b>{text}</b>")
            else:
                parts.append(f"<b>{text}</b>" if level <= 2 else f"<i>{text}</i>")
        elif t == "paragraph":
            parts.append(html.escape(b.get("text") or ""))
        elif t == "list":
            items = b.get("items") or []
            for idx, item in enumerate(items, 1):
                prefix = f"{idx}." if b.get("ordered") else "•"
                parts.append(f"{prefix} {html.escape(str(item))}")
        elif t == "code":
            parts.append(f"<pre>{html.escape(b.get('text') or '')}</pre>")
        elif t == "quote":
            parts.append(f"<blockquote>{html.escape(b.get('text') or '')}</blockquote>")
        elif t == "table_html":
            warnings.append("Будет отправлена как изображение")
    body = "\n".join(p for p in parts if p is not None)
    plain_len = len(html.unescape(body))
    if plain_len > 32768:
        raise ValueError("Пост слишком длинный")
    return body, list(dict.fromkeys(warnings))
