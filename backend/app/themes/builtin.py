from __future__ import annotations

from typing import Any


def _theme(
    id: str,
    name: str,
    dark: bool,
    surface: str,
    accent: str,
    **extra: str,
) -> dict[str, Any]:
    on = "#FAFAFA" if dark else "#18181B"
    muted = "#A1A1AA" if dark else "#71717A"
    subtle = "#71717A" if dark else "#A1A1AA"
    border = "rgba(255,255,255,0.06)" if dark else "rgba(0,0,0,0.08)"
    raised = "#141416" if dark else "#FFFFFF"
    overlay = "rgba(10,10,11,0.72)" if dark else "rgba(255,255,255,0.72)"
    return {
        "id": id,
        "name": name,
        "dark": dark,
        "tokens": {
            "surface": surface,
            "surfaceRaised": raised if "surfaceRaised" not in extra else extra["surfaceRaised"],
            "surfaceOverlay": overlay,
            "border": border,
            "onSurface": on,
            "onSurfaceMuted": muted,
            "onSurfaceSubtle": subtle,
            "accent": accent,
            "accentHover": extra.get("accentHover", accent),
            "ghostIndicator": extra.get("ghostIndicator", "#A78BFA"),
            "success": "#22C55E",
            "warning": "#F59E0B",
            "error": "#EF4444",
        },
    }


BUILTIN_THEMES: list[dict[str, Any]] = [
    _theme("aurogram", "Aurogram", True, "#0A0A0B", "#6366F1", accentHover="#818CF8"),
    _theme("paper", "Paper", False, "#F7F7F8", "#18181B", surfaceRaised="#FFFFFF", accentHover="#27272A"),
    _theme("mint", "Mint", False, "#F7F7F8", "#10B981", accentHover="#059669"),
    _theme("sky", "Sky", False, "#F7F7F8", "#0EA5E9", accentHover="#0284C7"),
    _theme("ghost", "Ghost", True, "#0C0B10", "#A78BFA", accentHover="#C4B5FD", ghostIndicator="#C4B5FD"),
    _theme("midnight", "Midnight", True, "#07070A", "#F59E0B", accentHover="#FBBF24"),
    _theme("ocean", "Ocean", True, "#061016", "#06B6D4", accentHover="#22D3EE"),
    _theme("sunset", "Sunset", True, "#10080C", "#F43F5E", accentHover="#FB7185"),
]


def get_theme(theme_id: str) -> dict[str, Any] | None:
    for t in BUILTIN_THEMES:
        if t["id"] == theme_id:
            return t
    return None
