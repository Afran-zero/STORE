from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies.auth import get_current_user
from app.services.analytics_service import AnalyticsService
from app.database.client import get_database

router = APIRouter()


def _bid(user) -> str:
    return getattr(user, "businessId", None) or "business-default"


@router.get("/dashboard")
async def dashboard(storeId: str | None = Query(default=None), current_user=Depends(get_current_user), db=Depends(get_database)):
    service = AnalyticsService(db)
    return {"success": True, "data": await service.dashboard(business_id=_bid(current_user), store_id=storeId)}
