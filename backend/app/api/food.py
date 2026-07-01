from __future__ import annotations

from fastapi import APIRouter, status

from app.schemas.food import FoodAvailabilityRequest, FoodCategoryCreateRequest, FoodCreateRequest, FoodRecalculateCostRequest, FoodUpdateRequest
from app.services.analytics_service import AnalyticsService


router = APIRouter(prefix="/food", tags=["food"])
service = AnalyticsService()


@router.get("")
async def list_food():
    return await service.placeholder([], message="List food scaffold")


@router.get("/{food_id}")
async def get_food(food_id: str):
    return await service.placeholder({"foodId": food_id}, message="Get food scaffold")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_food(_: FoodCreateRequest):
    return await service.placeholder({}, message="Create food scaffold")


@router.put("/{food_id}")
async def update_food(food_id: str, _: FoodUpdateRequest):
    return await service.placeholder({"foodId": food_id}, message="Update food scaffold")


@router.patch("/{food_id}/availability")
async def change_availability(food_id: str, _: FoodAvailabilityRequest):
    return await service.placeholder({"foodId": food_id}, message="Food availability scaffold")


@router.get("/categories")
async def categories():
    return await service.placeholder([], message="Food categories scaffold")


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(_: FoodCategoryCreateRequest):
    return await service.placeholder({}, message="Create food category scaffold")


@router.post("/{food_id}/recalculate-cost")
async def recalculate_cost(food_id: str, _: FoodRecalculateCostRequest | None = None):
    return await service.placeholder({"foodId": food_id}, message="Recalculate food cost scaffold")
