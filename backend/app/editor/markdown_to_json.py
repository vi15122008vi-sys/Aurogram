from __future__ import annotations

from typing import Any

from markdown_it import MarkdownIt


def markdown_to_json(md: str) -> list[dict[str, Any]]:
    parser = MarkdownIt("commonmark", {"breaks": True, "html": False})
    tokens = parser.parse(md or "")
    blocks: list[dict[str, Any]] = []
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if t.type == "heading_open":
            level = int(t.tag[1]) if t.tag.startswith("h") else 1
            inline = tokens[i + 1] if i + 1 < len(tokens) else None
            text = inline.content if inline and inline.type == "inline" else ""
            blocks.append({"type": "heading", "level": level, "text": text})
            i += 3
            continue
        if t.type == "paragraph_open":
            inline = tokens[i + 1] if i + 1 < len(tokens) else None
            text = inline.content if inline and inline.type == "inline" else ""
            blocks.append({"type": "paragraph", "text": text})
            i += 3
            continue
        if t.type == "bullet_list_open":
            blocks.append({"type": "list", "ordered": False, "items": []})
        if t.type == "ordered_list_open":
            blocks.append({"type": "list", "ordered": True, "items": []})
        if t.type == "list_item_open" and blocks and blocks[-1]["type"] == "list":
            # next inline roughly
            for j in range(i, min(i + 6, len(tokens))):
                if tokens[j].type == "inline":
                    blocks[-1]["items"].append(tokens[j].content)
                    break
        if t.type == "fence" or t.type == "code_block":
            blocks.append({"type": "code", "text": t.content})
        if t.type == "blockquote_open":
            blocks.append({"type": "quote", "text": ""})
        if t.type == "inline" and blocks and blocks[-1].get("type") == "quote" and not blocks[-1]["text"]:
            blocks[-1]["text"] = t.content
        if t.type == "html_block" and "<table" in (t.content or "").lower():
            blocks.append({"type": "table_html", "html": t.content})
        i += 1
    return blocks
