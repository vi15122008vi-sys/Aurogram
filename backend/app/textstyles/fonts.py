from __future__ import annotations

# Unicode mathematical alphanumeric style maps (base Latin A-Z a-z 0-9)
def _map(start_upper: int, start_lower: int, start_digit: int | None = None) -> dict[str, str]:
    m: dict[str, str] = {}
    for i in range(26):
        m[chr(ord("A") + i)] = chr(start_upper + i)
        m[chr(ord("a") + i)] = chr(start_lower + i)
    if start_digit is not None:
        for i in range(10):
            m[chr(ord("0") + i)] = chr(start_digit + i)
    return m


STYLES: dict[str, dict[str, str]] = {
    "script": _map(0x1D49C, 0x1D4B6),
    "script_bold": _map(0x1D4D0, 0x1D4EA),
    "fraktur": _map(0x1D504, 0x1D51E),
    "fraktur_bold": _map(0x1D56C, 0x1D586),
    "double_struck": _map(0x1D538, 0x1D552, 0x1D7D8),
    "monospace": _map(0x1D670, 0x1D68A, 0x1D7F6),
    "sans": _map(0x1D5A0, 0x1D5BA, 0x1D7E2),
    "sans_bold": _map(0x1D5D4, 0x1D5EE, 0x1D7EC),
    "sans_italic": _map(0x1D608, 0x1D622),
}

# Fix holes in Unicode Mathematical Alphanumeric Symbols for script/fraktur
_FIXES = {
    "script": {"B": "ℬ", "E": "ℰ", "F": "ℱ", "H": "ℋ", "I": "ℐ", "L": "ℒ", "M": "ℳ", "R": "ℛ",
               "e": "ℯ", "g": "ℊ", "o": "ℴ"},
    "fraktur": {"C": "ℭ", "H": "ℌ", "I": "ℑ", "R": "ℜ", "Z": "ℨ"},
    "double_struck": {"C": "ℂ", "H": "ℍ", "N": "ℕ", "P": "ℙ", "Q": "ℚ", "R": "ℝ", "Z": "ℤ"},
}
for name, fixes in _FIXES.items():
    STYLES[name].update(fixes)


STYLE_META = [
    {"id": "script", "label": "Script", "sample": "𝒜𝒷𝒸"},
    {"id": "script_bold", "label": "Script Bold", "sample": "𝓐𝓫𝓬"},
    {"id": "fraktur", "label": "Fraktur", "sample": "𝔄𝔟𝔠"},
    {"id": "fraktur_bold", "label": "Fraktur Bold", "sample": "𝕬𝖇𝖈"},
    {"id": "double_struck", "label": "Double-struck", "sample": "𝔸𝕓𝕔"},
    {"id": "monospace", "label": "Monospace", "sample": "𝙰𝚋𝚌"},
    {"id": "sans", "label": "Sans", "sample": "𝖠𝖻𝖼"},
    {"id": "sans_bold", "label": "Sans Bold", "sample": "𝗔𝗯𝗰"},
    {"id": "sans_italic", "label": "Sans Italic", "sample": "𝘈𝘣𝘤"},
]
