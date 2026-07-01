from __future__ import annotations

from fastapi import APIRouter, status
from fastapi import Query

from app.schemas.sale import SaleBatchCreateRequest, SaleCreateRequest, SaleDailyCloseRequest, SaleRefundRequest
from app.services.sales_service import SalesService


router = APIRouter(prefix="/sales", tags=["sales"])
service = SalesService()


@router.post("", status_code=status.HTTP_201_CREATED)
async def record_sale(_: SaleCreateRequest):
    return await service.placeholder({}, message="Record sale scaffold")


@router.post("/batch", status_code=status.HTTP_201_CREATED)
async def batch_sales(_: SaleBatchCreateRequest):
    return await service.placeholder({}, message="Batch sales scaffold")


@router.get("")
async def list_sales(storeId: str | None = Query(default=None), from_: str | None = Query(default=None, alias="from"), to: str | None = Query(default=None, alias="to"), paymentMethod: str | None = Query(default=None)):
    return await service.placeholder([], message="List sales scaffold")


@router.get("/{sale_id}")
async def get_sale(sale_id: str):
    return await service.placeholder({"saleId": sale_id}, message="Get sale scaffold")


@router.post("/{sale_id}/refund", status_code=status.HTTP_201_CREATED)
async def refund_sale(sale_id: str, _: SaleRefundRequest):
    return await service.placeholder({"saleId": sale_id}, message="Refund sale scaffold")


@router.post("/daily-close", status_code=status.HTTP_201_CREATED)
async def daily_close(_: SaleDailyCloseRequest):
    return await service.placeholder({}, message="Daily close scaffold")


@router.get("/analytics")
async def analytics(groupBy: str = Query(default="day"), storeId: str | None = Query(default=None), from_: str | None = Query(default=None, alias="from"), to: str | None = Query(default=None, alias="to")):
    return await service.placeholder({"groupBy": groupBy, "storeId": storeId, "from": from_, "to": to}, message="Sales analytics scaffold")
