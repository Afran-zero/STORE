from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.ai.tools.mcp_query_tools import build_mcp_query_tools


class _AsyncIter:
    """Tiny async iterator over a list -- used to mock motor cursors."""

    def __init__(self, docs):
        self._docs = list(docs)
        self._i = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._i >= len(self._docs):
            raise StopAsyncIteration
        d = self._docs[self._i]
        self._i += 1
        return d


class _FakeCursor:
    def __init__(self, docs):
        self._docs = list(docs)

    def sort(self, _):
        return self

    def limit(self, _):
        return self

    def __aiter__(self):
        return _AsyncIter(self._docs)


def _make_db(find_docs: list[dict] | None = None,
             count_value: int | None = None,
             agg_docs: list[dict] | None = None,
             find_raises: Exception | None = None) -> MagicMock:
    """Build a mock motor DB that mimics the slice of cursor ops the bridge uses."""

    cursor_find = _FakeCursor(find_docs or [])

    cursor_agg = _FakeCursor(agg_docs or [])

    coll = MagicMock()
    coll.find = MagicMock(return_value=cursor_find)
    coll.count_documents = AsyncMock(return_value=count_value or 0)
    coll.aggregate = MagicMock(return_value=cursor_agg)
    if find_raises is not None:
        coll.find = MagicMock(side_effect=find_raises)

    db = MagicMock()
    db.__getitem__ = MagicMock(return_value=coll)
    return db


@pytest.mark.asyncio
async def test_mcp_find_strips_internal_fields_and_returns_count():
    db = _make_db(find_docs=[
        {"_id": "x", "businessId": "biz-1", "name": "t1", "status": "open"},
        {"_id": "y", "businessId": "biz-1", "name": "t2", "status": "closed"},
    ])
    tools = build_mcp_query_tools(db, "biz-1")
    find_tool = next(t for t in tools if t.name == "mcp_find")
    result = await find_tool.ainvoke({"collection": "tickets"})
    assert result["count"] == 2
    assert {d["name"] for d in result["documents"]} == {"t1", "t2"}
    # Internal fields stripped from each returned doc.
    for d in result["documents"]:
        assert "_id" not in d
        assert "businessId" not in d


@pytest.mark.asyncio
async def test_mcp_count_returns_int():
    db = _make_db(count_value=42)
    tools = build_mcp_query_tools(db, "biz-1")
    count_tool = next(t for t in tools if t.name == "mcp_count")
    result = await count_tool.ainvoke({"collection": "sales"})
    assert result == {"count": 42}


@pytest.mark.asyncio
async def test_mcp_aggregate_returns_documents_and_count():
    db = _make_db(agg_docs=[
        {"storeId": "store-a", "total": 1000},
        {"storeId": "store-b", "total": 750},
    ])
    tools = build_mcp_query_tools(db, "biz-1")
    agg_tool = next(t for t in tools if t.name == "mcp_aggregate")
    result = await agg_tool.ainvoke({
        "collection": "sales",
        "pipeline": [
            {"$group": {"_id": "$storeId", "total": {"$sum": "$amount"}}}
        ],
    })
    assert result["count"] == 2
    assert result["documents"][0]["storeId"] == "store-a"


@pytest.mark.asyncio
async def test_mcp_find_rejects_collection_outside_allowlist():
    """A collection name not in McpService.ALLOWED_COLLECTIONS must raise."""
    db = _make_db()
    tools = build_mcp_query_tools(db, "biz-1")
    find_tool = next(t for t in tools if t.name == "mcp_find")
    with pytest.raises(Exception) as exc_info:
        await find_tool.ainvoke({"collection": "secret_users_table"})
    # ValidationError's str() returns the message text, not the code field.
    assert "not accessible via the read-only MCP bridge" in str(exc_info.value)


@pytest.mark.asyncio
async def test_mcp_aggregate_rejects_forbidden_stage():
    db = _make_db()
    tools = build_mcp_query_tools(db, "biz-1")
    agg_tool = next(t for t in tools if t.name == "mcp_aggregate")
    with pytest.raises(Exception) as exc_info:
        await agg_tool.ainvoke({
            "collection": "sales",
            "pipeline": [{"$out": "evil_sales"}],
        })
    assert "not permitted via the read-only bridge" in str(exc_info.value)


@pytest.mark.asyncio
async def test_mcp_find_scrubs_unsafe_where_operator():
    """$where is in McpService._UNSAFE_OPERATORS and must be dropped silently."""
    db = _make_db(find_docs=[])
    tools = build_mcp_query_tools(db, "biz-1")
    find_tool = next(t for t in tools if t.name == "mcp_find")
    # Should NOT raise -- $where should be scrubbed, then the safe remainder runs.
    result = await find_tool.ainvoke({
        "collection": "tickets",
        "filter": {"$where": "this.status == 'open'", "status": "open"},
    })
    assert "count" in result