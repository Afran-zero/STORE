from __future__ import annotations

from typing import Any

from langchain_core.tools import StructuredTool
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field


def _summarize(doc: dict[str, Any]) -> dict[str, Any]:
    """Return a compact, model-friendly projection of a food_items doc."""
    return {
        "foodItemId": str(doc.get("_id", "")),
        "name": doc.get("name"),
        "category": doc.get("category"),
        "price": doc.get("price"),
        "cost": doc.get("cost"),
        "estimatedProfit": doc.get("estimatedProfit"),
        "status": doc.get("status"),
        "recipeId": doc.get("recipeId"),
        "assignedStores": doc.get("assignedStores", []),
    }


def build_food_tools(db: AsyncIOMotorDatabase, business_id: str) -> list[StructuredTool]:
    """Read-only tools over the food_items collection (i.e. the food menu).

    The agent previously had no way to answer "what's on the menu?" because no
    tool queried ``food_items`` directly. These tools fill that gap and stay
    scoped to the current ``businessId``.
    """

    async def list_food_menu(
        category: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> dict[str, Any]:
        capped = max(1, min(int(limit or 50), 200))
        query: dict[str, Any] = {"businessId": business_id}
        if category:
            query["category"] = {"$regex": f"^{category}$", "$options": "i"}
        if status:
            query["status"] = {"$regex": f"^{status}$", "$options": "i"}
        cursor = db["food_items"].find(query).limit(capped)
        items = [_summarize(doc) async for doc in cursor]
        # Build a small breakdown so the model can answer follow-ups without
        # calling again (e.g. "how many menu items?").
        categories: dict[str, int] = {}
        for item in items:
            cat = item.get("category") or "Uncategorized"
            categories[cat] = categories.get(cat, 0) + 1
        return {
            "count": len(items),
            "items": items,
            "categories": categories,
        }

    async def get_food_item(name_or_id: str) -> dict[str, Any]:
        query: dict[str, Any] = {
            "businessId": business_id,
            "$or": [
                {"_id": name_or_id},
                {"name": {"$regex": f"^{name_or_id}$", "$options": "i"}},
            ],
        }
        doc = await db["food_items"].find_one(query)
        if not doc:
            return {"found": False, "query": name_or_id}
        return {"found": True, **_summarize(doc)}

    class ListFoodMenuArgs(BaseModel):
        category: str | None = Field(
            default=None,
            description="Optional category filter, e.g. 'Burger', 'Drinks'. Case-insensitive exact match.",
        )
        status: str | None = Field(
            default=None,
            description="Optional status filter, e.g. 'ACTIVE' or 'INACTIVE'. Case-insensitive exact match.",
        )
        limit: int = Field(
            default=50,
            description="Maximum number of items to return (1-200).",
        )

    class FoodItemArgs(BaseModel):
        name_or_id: str = Field(
            description="Food item name (case-insensitive) or its _id string.",
        )

    return [
        StructuredTool.from_function(
            coroutine=list_food_menu,
            func=None,
            name="list_food_menu",
            description=(
                "List the food menu (food_items collection) for the current business. "
                "Returns every menu item with name, category, price (BDT), cost, "
                "estimated profit, status, and assigned stores. Use this whenever the "
                "user asks about the menu, available items, prices, categories, or "
                "'what do you sell'."
            ),
            args_schema=ListFoodMenuArgs,
        ),
        StructuredTool.from_function(
            coroutine=get_food_item,
            func=None,
            name="get_food_item",
            description=(
                "Look up a single food menu item by name or _id. Returns its price, "
                "cost, estimated profit, category, status, and recipeId. Use this when "
                "the user asks about a specific item (e.g. 'Beef Burger', 'Chicken Burger')."
            ),
            args_schema=FoodItemArgs,
        ),
    ]