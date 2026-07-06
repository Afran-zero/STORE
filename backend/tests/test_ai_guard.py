"""Pure unit tests for the AI grounding guard.

These tests do not require Redis, Mongo, or a live model. They validate that
``check_grounding`` rejects assistant messages containing factual content
(numbers, dates, percentages, currency) when the agent did not call any tool.

Run with:
    cd STORE/backend && python -m pytest tests/test_ai_guard.py -q
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.ai.guard import check_grounding  # noqa: E402

PASS_THROUGH_MESSAGES = [
    "There are no ingredients matching that name.",
    "Could you clarify which store you mean?",
    "Sorry, I didn't understand that. Please try again.",
    "",
]

GROUNDED_NUMERIC = [
    "Today's total sales were 12,500 BDT.",
    "We sold 320 units on 2025-08-01.",
    "Profit margin is 18%.",
    "Stock of flour is 8.5 kg left.",
    "You have 3 stores, 2 of which are open.",
]

TOOL_CALLS = [{"tool": "mcp_find", "input": {"collection": "sales"}}]


def test_pass_through_messages_with_no_tool_calls():
    for text in PASS_THROUGH_MESSAGES:
        assert check_grounding(text, tool_calls=[]) is None, text


def test_grounded_messages_with_tool_calls_are_kept():
    for text in GROUNDED_NUMERIC:
        assert check_grounding(text, tool_calls=TOOL_CALLS) is None, text


def test_numeric_message_without_tool_calls_is_replaced():
    for text in GROUNDED_NUMERIC:
        replacement = check_grounding(text, tool_calls=[])
        assert replacement is not None, text
        assert "guess" in replacement.lower() or "look that up" in replacement.lower()


def test_currency_symbol_detection():
    text = "Your revenue is $4,200 this week."
    assert check_grounding(text, tool_calls=[]) is not None
    assert check_grounding(text, tool_calls=TOOL_CALLS) is None


def test_threshold_for_short_numbers():
    # A single digit like "1" should not necessarily trip — guard targets
    # quantitative answers, not incidental mentions. We use a length
    # threshold inside the guard; this test documents the expected behaviour.
    short = "There is 1 store."
    # Either pass-through or replacement is acceptable; just must not raise.
    check_grounding(short, tool_calls=[])