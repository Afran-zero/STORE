from __future__ import annotations

from fastapi import APIRouter, status
from fastapi import Query

from app.schemas.store import StoreCreateRequest, StoreOpenCloseRequest, StoreStatusUpdateRequest, StoreUpdateRequest
from app.services.inventory_service import InventoryService


router = APIRouter(prefix="/stores", tags=["stores"])
service = InventoryService()


@router.get("")
async def list_stores():
    return await service.placeholder([], message="List stores scaffold")


@router.get("/{store_id}")
async def get_store(store_id: str):
    return await service.placeholder({"storeId": store_id}, message="Get store scaffold")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_store(_: StoreCreateRequest):
    return await service.placeholder({}, message="Create store scaffold")


@router.put("/{store_id}")
async def update_store(store_id: str, _: StoreUpdateRequest):
    return await service.placeholder({"storeId": store_id}, message="Update store scaffold")


@router.patch("/{store_id}/status")
async def change_status(store_id: str, _: StoreStatusUpdateRequest):
    return await service.placeholder({"storeId": store_id}, message="Store status scaffold")


@router.get("/{store_id}/analytics")
async def analytics(store_id: str, from_: str | None = Query(default=None, alias="from"), to: str | None = Query(default=None, alias="to")):
    return await service.placeholder({"storeId": store_id, "from": from_, "to": to}, message="Store analytics scaffold")


@router.get("/{store_id}/performance")
async def performance(store_id: str):
    return await service.placeholder({"storeId": store_id}, message="Store performance scaffold")


@router.post("/{store_id}/open")
async def open_store(store_id: str, _: StoreOpenCloseRequest):
    return await service.placeholder({"storeId": store_id}, message="Open store scaffold")


@router.post("/{store_id}/close")
async def close_store(store_id: str, _: StoreOpenCloseRequest):
    return await service.placeholder({"storeId": store_id}, message="Close store scaffold")


@router.get("/{store_id}/daily-report")
async def daily_report(store_id: str, date: str | None = None):
    return await service.placeholder({"storeId": store_id, "date": date}, message="Daily report scaffold")
