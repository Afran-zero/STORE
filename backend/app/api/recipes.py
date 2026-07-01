from __future__ import annotations

from fastapi import APIRouter, status

from app.schemas.recipe import RecipeApproveRequest, RecipeCreateRequest, RecipeDraftAiRequest, RecipeDuplicateRequest, RecipeUpdateRequest
from app.services.recipe_service import RecipeService


router = APIRouter(prefix="/recipes", tags=["recipes"])
service = RecipeService()


@router.get("")
async def list_recipes():
    return await service.placeholder([], message="List recipes scaffold")


@router.get("/{recipe_id}")
async def get_recipe(recipe_id: str):
    return await service.placeholder({"recipeId": recipe_id}, message="Get recipe scaffold")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_recipe(_: RecipeCreateRequest):
    return await service.placeholder({}, message="Create recipe scaffold")


@router.put("/{recipe_id}")
async def update_recipe(recipe_id: str, _: RecipeUpdateRequest):
    return await service.placeholder({"recipeId": recipe_id}, message="Update recipe scaffold")


@router.post("/{recipe_id}/duplicate", status_code=status.HTTP_201_CREATED)
async def duplicate_recipe(recipe_id: str, _: RecipeDuplicateRequest | None = None):
    return await service.placeholder({"recipeId": recipe_id}, message="Duplicate recipe scaffold")


@router.post("/{recipe_id}/images", status_code=status.HTTP_201_CREATED)
async def upload_images(recipe_id: str):
    return await service.placeholder({"recipeId": recipe_id}, message="Recipe image upload scaffold")


@router.get("/{recipe_id}/cost")
async def recipe_cost(recipe_id: str):
    return await service.placeholder({"recipeId": recipe_id, "cost": 0}, message="Recipe cost scaffold")


@router.post("/draft-ai")
async def draft_ai(_: RecipeDraftAiRequest):
    return await service.placeholder({}, message="Recipe draft AI scaffold")


@router.patch("/{recipe_id}/approve")
async def approve(recipe_id: str, _: RecipeApproveRequest):
    return await service.placeholder({"recipeId": recipe_id}, message="Approve recipe scaffold")
