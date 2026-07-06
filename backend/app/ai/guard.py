"""Grounding guard for AI assistant answers.

The OpenRouter model is told to call tools before answering factual
questions, but it can still drift. This module provides a lightweight,
server-side check: if the final answer mentions dates, currency, counts, or
percentages and no tool was invoked in the same turn, we replace the reply
with a clarification rather than persisting an unverified number.
"""
from __future__ import annotations

import re
from typing import Any

_NUMBER_PATTERN = re.compile(r"\b\d[\d,\.]*\b")
_DATE_PATTERN = re.compile(
    r"\b("
    r"today|yesterday|tomorrow|last\s+week|this\s+week|"
    r"\d{4}-\d{2}-\d{2}|"
    r"\d{1,2}/\d{1,2}/\d{2,4}"
    r")\b",
    re.IGNORECASE,
)
_PERCENT_PATTERN = re.compile(r"\b\d+(?:\.\d+)?\s*%")
_CURRENCY_PATTERN = re.compile(
    r"\b(?:BDT|TK|\u09F3|USD|GBP|\$|\u20AC|\u00A3)\s*\d|\b\d\s*(?:BDT|TK|\u09F3|USD|GBP|\$|\u20AC|\u00A3)\b",
    re.IGNORECASE,
)


def _looks_factual(text: str) -> bool:
    if not text:
        return False
    if _PERCENT_PATTERN.search(text):
        return True
    if _CURRENCY_PATTERN.search(text):
        return True
    if _DATE_PATTERN.search(text):
        return True
    # Standalone numbers (counts, totals) without a date -- still factual.
    if _NUMBER_PATTERN.search(text):
        return True
    return False


def check_grounding(content: str, tool_calls: list[dict[str, Any]]) -> str | None:
    """Return a replacement message when the answer is ungrounded.

    Returns ``None`` if the answer passes the check (fact-free, or backed
    by at least one tool in this turn).
    """
    if tool_calls:
        return None
    if not _looks_factual(content or ""):
        return None
    return (
        "I do not want to guess a number. Let me look that up for you — "
        "could you rephrase the question or pick a more specific date or "
        "store? If you'd like, open the relevant dashboard page for the "
        "exact figures."
    )
