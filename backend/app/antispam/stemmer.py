from __future__ import annotations

import re

_RU_SUFFIXES = (
    "иями", "ями", "ами", "ией", "иям", "ием", "иях", "ию", "ья", "ье", "ьё",
    "ов", "ев", "ий", "ый", "ой", "ая", "ое", "ые", "ам", "ям", "ах", "ях",
    "ом", "ем", "ую", "юю", "ей", "ой", "ие", "ия", "ии", "ь", "а", "я", "о", "е", "у", "ю", "ы", "и",
)

_EN_SUFFIXES = ("ational", "tional", "enci", "anci", "izer", "alli", "entli", "eli", "ousli",
                "ization", "ation", "ator", "alism", "iveness", "fulness", "ousness", "aliti",
                "iviti", "biliti", "ement", "ance", "ence", "able", "ible", "ment", "ness",
                "ity", "ism", "ing", "ers", "ies", "ied", "ed", "ly", "es", "s")


def stem_token(token: str, case_sensitive: bool = False) -> str:
    original = token.strip()
    lookup = original.lower()
    if len(original) < 4:
        return original if case_sensitive else lookup
    if re.search(r"[а-яё]", lookup):
        for s in _RU_SUFFIXES:
            if lookup.endswith(s) and len(lookup) - len(s) >= 3:
                stem = original[:-len(s)]
                return stem if case_sensitive else stem.lower()
        return original if case_sensitive else lookup
    for s in _EN_SUFFIXES:
        if lookup.endswith(s) and len(lookup) - len(s) >= 3:
            stem = original[:-len(s)]
            return stem if case_sensitive else stem.lower()
    return original if case_sensitive else lookup


def stem_text(text: str, case_sensitive: bool = False) -> str:
    source = text if case_sensitive else text.lower()
    parts = re.findall(r"[A-Za-zА-Яа-яЁё0-9]+", source)
    return " ".join(stem_token(part, case_sensitive=case_sensitive) for part in parts)
