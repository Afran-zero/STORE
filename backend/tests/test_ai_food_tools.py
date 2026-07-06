from __future__ import annotations

import pytest

from app.ai.tools.food_tools import _summarize, build_food_tools


def test_summarize_strips_id_and_keeps_menu_fields():
    doc = {
        "_id": "abc",
        "businessId": "biz",
        "name": "Chicken Burger",
        "category": "Burger",
        "price": 20.0,
        "cost": 7.25,
        "estimatedProfit": 12.75,
        "status": "ACTIVE",
        "recipeId": "r1",
        "assignedStores": ["s1"],
        "image": "ignored",
        "createdAt": "x",
    }
    out = _summarize(doc)
    assert out["foodItemId"] == "abc"
    assert out["name"] == "Chicken Burger"
    assert out["category"] == "Burger"
    assert out["price"] == 20.0
    assert out["cost"] == 7.25
    assert out["estimatedProfit"] == 12.75
    assert out["status"] == "ACTIVE"
    assert out["assignedStores"] == ["s1"]
    assert "_id" not in out
    assert "createdAt" not in out


class _FakeCursor:
    def __init__(self, docs):
        self._docs = list(docs)
        self._n = None

    def limit(self, n):
        self._n = n
        return self

    def __aiter__(self):
        return self._aiter()

    async def _aiter(self):
        docs = self._docs if self._n is None else self._docs[: self._n]
        for d in docs:
            yield d


class _FakeCollection:
    def __init__(self, docs):
        self._docs = docs

    def find(self, query, projection=None):
        return _FakeCursor(self._docs)

    async def find_one(self, query, projection=None):
        return None


class _FakeDB:
    def __init__(self, docs):
        self._docs = docs

    def __getitem__(self, name):
        return _FakeCollection(self._docs)


@pytest.mark.asyncio
async def test_list_food_menu_returns_summary_and_categories():
    docs = [
        {"_id": "1", "name": "A", "category": "Burger", "price": 1, "cost": 1,
         "estimatedProfit": 0, "status": "ACTIVE", "recipeId": "r1",
         "assignedStores": []},
        {"_id": "2", "name": "B", "category": "Drinks", "price": 1, "cost": 1,
         "estimatedProfit": 0, "status": "ACTIVE", "recipeId": "r2",
         "assignedStores": []},
    ]
    db = _FakeDB(docs)
    tools = build_food_tools(db, "biz-1")
    list_tool = next(t for t in tools if t.name == "list_food_menu")
    result = await list_tool.ainvoke({})
    assert result["count"] == 2
    assert {i["name"] for i in result["items"]} == {"A", "B"}
    assert result["categories"] == {"Burger": 1, "Drinks": 1}
    assert all("_id" not in i for i in result["items"])


@pytest.mark.asyncio
async def test_get_food_item_not_found():
    db = _FakeDB([])
    tools = build_food_tools(db, "biz-1")
    get_tool = next(t for t in tools if t.name == "get_food_item")
    result = await get_tool.ainvoke({"name_or_id": "Mystery"})
    assert result == {"found": False, "query": "Mystery"}
