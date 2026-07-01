from __future__ import annotations

from fastapi import APIRouter
from fastapi import Query

from app.services.analytics_service import AnalyticsService


router = APIRouter(prefix="/analytics", tags=["analytics"])
service = AnalyticsService()


@router.get("/revenue")
async def revenue(storeId: str | None = Query(default=None), from_: str | None = Query(default=None, alias="from"), to: str | None = Query(default=None, alias="to"), groupBy: str | None = Query(default=None)):
    return await service.placeholder({"storeId": storeId, "from": from_, "to": to, "groupBy": groupBy}, message="Revenue analytics scaffold")


@router.get("/profit")
async def profit(storeId: str | None = Query(default=None), from_: str | None = Query(default=None, alias="from"), to: str | None = Query(default=None, alias="to")):
    return await service.placeholder({"storeId": storeId, "from": from_, "to": to}, message="Profit analytics scaffold")


@router.get("/inventory")
async def inventory():
    return await service.placeholder({}, message="Inventory analytics scaffold")


@router.get("/employees")
async def employees():
    return await service.placeholder({}, message="Employee analytics scaffold")


@router.get("/stores")
async def stores():
    return await service.placeholder({}, message="Store analytics scaffold")


@router.get("/food")
async def food():
    return await service.placeholder({}, message="Food analytics scaffold")


@router.get("/export")
async def export(type: str = "csv", report: str = "revenue"):
    return await service.placeholder({"type": type, "report": report}, message="Export analytics scaffold")
