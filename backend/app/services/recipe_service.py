from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.repositories.ingredient_repository import IngredientRepository
from app.repositories.recipe_repository import RecipeRepository


class RecipeNotFoundError(Exception):
    pass


class RecipeConflictError(Exception):
    pass


class IngredientNotFoundForRecipeError(Exception):
    pass


class RecipeService:
    def __init__(self, db: Any) -> None:
        self.repo = RecipeRepository(db)
        self.ingredients = IngredientRepository(db)

    async def list_recipes(self, *, business_id: str) -> List[Dict[str, Any]]:
        return await self.repo.list(business_id=business_id)

    async def get_recipe(self, *, business_id: str, recipe_id: str) -> Dict[str, Any]:
        item = await self.repo.get(business_id=business_id, recipe_id=recipe_id)
        if not item:
            raise RecipeNotFoundError(recipe_id)
        return item

    async def create_recipe(self, *, business_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        name = (payload.get("name") or "").strip()
        if not name:
            raise ValueError("name is required")
        existing = await self.repo.get_by_name(business_id=business_id, name=name)
        if existing:
            raise RecipeConflictError(name)
        await self._validate_ingredients(business_id=business_id, ingredients=payload.get("ingredients") or [])
        doc = {
            "name": name,
            "foodItemId": payload.get("foodItemId") or None,
            "ingredients": payload.get("ingredients") or [],
            "preparationSteps": payload.get("preparationSteps") or [],
            "servingSize": payload.get("servingSize"),
        }
        return await self.repo.create(business_id=business_id, payload=doc)

    async def update_recipe(self, *, business_id: str, recipe_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        await self.get_recipe(business_id=business_id, recipe_id=recipe_id)
        update: Dict[str, Any] = {}
        if payload.get("name") is not None:
            new_name = payload["name"].strip()
            dup = await self.repo.get_by_name(business_id=business_id, name=new_name)
            if dup and dup["id"] != recipe_id:
                raise RecipeConflictError(new_name)
            update["name"] = new_name
        if "foodItemId" in payload:
            update["foodItemId"] = payload.get("foodItemId") or None
        if payload.get("ingredients") is not None:
            await self._validate_ingredients(business_id=business_id, ingredients=payload["ingredients"])
            update["ingredients"] = payload["ingredients"]
        if payload.get("preparationSteps") is not None:
            update["preparationSteps"] = payload["preparationSteps"]
        if payload.get("servingSize") is not None:
            update["servingSize"] = payload["servingSize"]
        item = await self.repo.update(business_id=business_id, recipe_id=recipe_id, payload=update)
        if not item:
            raise RecipeNotFoundError(recipe_id)
        return item

    async def delete_recipe(self, *, business_id: str, recipe_id: str) -> None:
        ok = await self.repo.delete(business_id=business_id, recipe_id=recipe_id)
        if not ok:
            raise RecipeNotFoundError(recipe_id)

    async def compute_cost(self, *, business_id: str, recipe_id: str) -> Dict[str, Any]:
        recipe = await self.get_recipe(business_id=business_id, recipe_id=recipe_id)
        line_items = []
        total = 0.0
        for line in recipe.get("ingredients") or []:
            ing_id = line.get("ingredientId")
            qty = float(line.get("quantity") or 0)
            ing = await self.ingredients.get(business_id=business_id, ingredient_id=ing_id)
            if not ing:
                raise IngredientNotFoundForRecipeError(ing_id)
            unit_cost = float(ing.get("costPerUnit") or ing.get("averageCost") or 0)
            line_cost = unit_cost * qty
            total += line_cost
            line_items.append({"ingredientId": ing_id, "name": ing.get("name"), "quantity": qty, "unitCost": unit_cost, "lineCost": round(line_cost, 4)})
        return {"recipeId": recipe_id, "currency": "USD", "totalCost": round(total, 4), "lines": line_items}

    async def _validate_ingredients(self, *, business_id: str, ingredients: List[Dict[str, Any]]) -> None:
        for line in ingredients:
            ing_id = line.get("ingredientId")
            if not ing_id:
                raise IngredientNotFoundForRecipeError("missing-id")
            ing = await self.ingredients.get(business_id=business_id, ingredient_id=ing_id)
            if not ing:
                raise IngredientNotFoundForRecipeError(ing_id)
