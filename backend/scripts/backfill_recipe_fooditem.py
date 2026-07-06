"""One-time backfill: link orphaned recipes to their food items.

Recipes created before this fix were saved without a ``foodItemId``. This script
walks the ``food_items`` collection to build a ``recipeId -> foodItemId`` map
and patches any recipe whose ``foodItemId`` is null/missing by linking it back
to the food item that references its id in ``food_items.recipeId``.

Falls back to a case-insensitive name match when the recipeId link is missing.

Usage:
    cd backend && .venv/Scripts/python.exe scripts/backfill_recipe_fooditem.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Allow running from repo root or backend dir
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.config import get_settings  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


async def main() -> None:
    settings = get_settings()
    # Use a fresh client per run so the script is self-contained and idempotent
    # when run from the CLI (the cached app-wide manager ties to the running
    # uvicorn loop and cannot be reused here).
    client = AsyncIOMotorClient(settings.mongo_uri)
    try:
        db = client[settings.mongo_db_name]
        recipes = db["recipes"]
        food_items = db["food_items"]

        await _backfill(recipes, food_items)
    finally:
        client.close()


async def _backfill(recipes, food_items) -> None:
    # 1) recipeId -> foodItemId (primary)
    recipe_to_food: dict[str, str] = {}
    name_to_food: dict[str, str] = {}
    async for food in food_items.find({}, {"name": 1, "recipeId": 1}):
        fid = str(food["_id"])
        if food.get("recipeId"):
            recipe_to_food[str(food["recipeId"])] = fid
        if food.get("name"):
            name_to_food[food["name"].strip().lower()] = fid

    matched = 0
    skipped = 0
    cursor = recipes.find(
        {
            "$or": [
                {"foodItemId": None},
                {"foodItemId": ""},
                {"foodItemId": {"$exists": False}},
            ]
        }
    )
    async for recipe in cursor:
        rid = str(recipe["_id"])
        food_id = recipe_to_food.get(rid)
        if not food_id:
            # Fall back to name match
            name = (recipe.get("name") or "").strip().lower()
            food_id = name_to_food.get(name)
        if not food_id:
            skipped += 1
            print(f"  - skip: no food item matches recipe '{recipe.get('name')}' (id={rid})")
            continue
        await recipes.update_one({"_id": recipe["_id"]}, {"$set": {"foodItemId": food_id}})
        matched += 1
        print(f"  + linked: '{recipe.get('name')}' (recipe {rid}) -> food {food_id}")

    print(f"\nDone. matched={matched}, skipped={skipped}")


if __name__ == "__main__":
    asyncio.run(main())