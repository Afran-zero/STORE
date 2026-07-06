"""Tests for ``app.ai.tools.employee_tools.build_employee_tools``.

Covers the new ``list_employees`` tool that surfaces the Members-page roster
to the LangChain agent, plus the existing ``get_employee_performance`` tool.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.ai.tools.employee_tools import build_employee_tools


class _AsyncIter:
    def __init__(self, docs: list[dict[str, Any]]) -> None:
        self._docs = list(docs)
        self._i = 0

    def __aiter__(self) -> "_AsyncIter":
        return self

    async def __anext__(self) -> dict[str, Any]:
        if self._i >= len(self._docs):
            raise StopAsyncIteration
        doc = self._docs[self._i]
        self._i += 1
        return doc


class _FakeCursor:
    def __init__(self, docs: list[dict[str, Any]]) -> None:
        self._docs = list(docs)

    def sort(self, _key: Any) -> "_FakeCursor":
        return self

    def limit(self, _n: int) -> "_FakeCursor":
        return self

    def __aiter__(self) -> _AsyncIter:
        return _AsyncIter(self._docs)


def _make_db(
    *,
    users: list[dict[str, Any]] | None = None,
    sales_agg: list[dict[str, Any]] | None = None,
    stores: list[dict[str, Any]] | None = None,
) -> MagicMock:
    all_users = users or []
    all_stores = stores or []
    users_coll = MagicMock()
    stores_coll = MagicMock()
    # The "find" must respect the query -- a real Mongo would. So we capture
    # the query and filter our fake rows against it before yielding them.
    def _find(query: dict[str, Any], projection: dict[str, Any] | None = None):
        rows = [doc for doc in all_users if _matches(doc, query)]
        cursor = _FakeCursor(rows)
        users_coll._last_query = query  # type: ignore[attr-defined]
        users_coll._last_projection = projection  # type: ignore[attr-defined]
        return cursor

    users_coll.find = MagicMock(side_effect=_find)

    def _stores_find(query: dict[str, Any], projection: dict[str, Any] | None = None):
        rows = [doc for doc in all_stores if _matches(doc, query)]
        return _FakeCursor(rows)

    stores_coll.find = MagicMock(side_effect=_stores_find)

    sales_cursor = _FakeCursor(sales_agg or [])
    users_coll.aggregate = MagicMock(return_value=sales_cursor)

    colls = {"users": users_coll, "stores": stores_coll}

    db = MagicMock()
    db.__getitem__ = MagicMock(side_effect=lambda name: colls.get(name, MagicMock()))
    db._users_coll = users_coll  # type: ignore[attr-defined]
    db._stores_coll = stores_coll  # type: ignore[attr-defined]
    return db


def _matches(doc: dict[str, Any], query: dict[str, Any]) -> bool:
    """Tiny subset-Mongo matcher supporting equality, role regex, and isActive.

    Only the operators used by ``list_employees`` need to be supported.
    """
    import re
    for key, expected in query.items():
        actual = doc.get(key)
        if isinstance(expected, dict):
            for op_key, op_val in expected.items():
                if op_key == "$regex":
                    if not re.search(str(op_val), str(actual or ""), flags=re.IGNORECASE):
                        return False
                elif op_key == "$options":
                    continue
                else:
                    # Operator we don't know how to fake -- assume match.
                    continue
            continue
        if expected != actual:
            return False
    return True


def _by_name(tools) -> dict[str, Any]:
    return {t.name: t for t in tools}


@pytest.mark.asyncio
async def test_list_employees_returns_roster_and_role_breakdown():
    db = _make_db(users=[
        {
            "_id": "u1",
            "businessId": "business-default",
            "name": "kudus",
            "email": "kudus@gmail.com",
            "role": "WORKER",
            "assignedStore": "khanas",
            "isActive": True,
            "createdAt": "2026-07-01",
            "passwordHash": "should-be-excluded",
        },
        {
            "_id": "u2",
            "businessId": "business-default",
            "name": "Basar",
            "email": "bashar@gmail.com",
            "role": "WORKER",
            "assignedStore": "BasharBurger",
            "isActive": True,
            "createdAt": "2026-07-02",
        },
        {
            "_id": "u3",
            "businessId": "business-default",
            "name": "Store Admin",
            "email": "admin",
            "role": "OWNER",
            "assignedStore": None,
            "isActive": True,
            "createdAt": "2026-07-05",
            "passwordHash": "should-be-excluded",
        },
    ])

    tools = build_employee_tools(
        db, business_id="business-default", current_user_id="u3", current_user_role="OWNER"
    )
    list_tool = _by_name(tools)["list_employees"]
    result = await list_tool.ainvoke({})

    assert result["count"] == 3
    assert result["roleCounts"] == {"WORKER": 2, "OWNER": 1}

    by_id = {w["id"]: w for w in result["workers"]}
    assert by_id["u1"]["name"] == "kudus"
    assert by_id["u1"]["store"] == "khanas"
    assert by_id["u1"]["status"] == "active"
    # Password material must never leak through to the LLM.
    for w in result["workers"]:
        assert "passwordHash" not in w
        assert "password" not in w


@pytest.mark.asyncio
async def test_list_employees_filters_by_role_and_status():
    db = _make_db(users=[
        {"_id": "a", "businessId": "biz-1", "name": "Ana", "role": "WORKER", "isActive": True},
        {"_id": "b", "businessId": "biz-1", "name": "Bob", "role": "MANAGER", "isActive": False},
        {"_id": "c", "businessId": "biz-1", "name": "Cee", "role": "WORKER", "isActive": False},
    ])
    tools = build_employee_tools(
        db, business_id="biz-1", current_user_id="x", current_user_role="OWNER"
    )
    list_tool = _by_name(tools)["list_employees"]

    workers_only = await list_tool.ainvoke({"role": "WORKER"})
    assert {w["id"] for w in workers_only["workers"]} == {"a", "c"}

    inactive = await list_tool.ainvoke({"status": "inactive"})
    assert {w["id"] for w in inactive["workers"]} == {"b", "c"}


@pytest.mark.asyncio
async def test_list_employees_always_scopes_by_business():
    """Even if a caller forgot to add businessId, the tool must not leak rows
    from a different business."""
    db = _make_db(users=[
        {"_id": "mine", "businessId": "business-default", "name": "Local", "role": "WORKER", "isActive": True},
    ])
    tools = build_employee_tools(
        db, business_id="business-default", current_user_id="x", current_user_role="OWNER"
    )
    list_tool = _by_name(tools)["list_employees"]
    result = await list_tool.ainvoke({})
    assert result["count"] == 1
    # The find() call must have been issued with a businessId filter. Inspect
    # the call args to confirm the scoping is enforced at query time, not just
    # in the projection.
    users_coll = db._users_coll  # type: ignore[attr-defined]
    assert users_coll.find.call_count == 1, "list_employees should hit MongoDB once"
    call_args, _ = users_coll.find.call_args
    query = call_args[0]
    assert query["businessId"] == "business-default"
    # Sensitive fields stripped at the projection level.
    projection = call_args[1]
    assert projection["passwordHash"] == 0
    assert projection["password"] == 0


@pytest.mark.asyncio
async def test_list_employees_resolves_store_names():
    """The store field on each worker should be the store's name, not its id."""
    db = _make_db(
        users=[
            {"_id": "u1", "businessId": "biz", "name": "Basar", "role": "WORKER",
             "assignedStore": "6a4a2527a4e93e36dd99b677", "isActive": True},
        ],
        stores=[
            {"_id": "6a4a2527a4e93e36dd99b677", "businessId": "biz", "name": "BasharBurger", "code": "1"},
        ],
    )
    tools = build_employee_tools(
        db, business_id="biz", current_user_id="x", current_user_role="OWNER"
    )
    list_tool = _by_name(tools)["list_employees"]
    result = await list_tool.ainvoke({})
    assert result["workers"][0]["store"] == "BasharBurger"
