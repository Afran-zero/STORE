from __future__ import annotations

from fastapi import APIRouter, status

from app.schemas.ingredient import AdjustmentRequest, AllocationRequest, IngredientCreateRequest, IngredientUpdateRequest, PurchaseRequest, ReturnRequest, SupplierCreateRequest, SupplierUpdateRequest, TransferRequest
from app.services.inventory_service import InventoryService


router = APIRouter(prefix="/inventory", tags=["inventory"])
service = InventoryService()


@router.get("/ingredients")
async def list_ingredients(storeId: str | None = None, category: str | None = None, lowStock: bool | None = None):
    return await service.placeholder([], message="List ingredients scaffold")


@router.post("/ingredients", status_code=status.HTTP_201_CREATED)
async def create_ingredient(_: IngredientCreateRequest):
    return await service.placeholder({}, message="Create ingredient scaffold")


@router.put("/ingredients/{ingredient_id}")
async def update_ingredient(ingredient_id: str, _: IngredientUpdateRequest):
    return await service.placeholder({"ingredientId": ingredient_id}, message="Update ingredient scaffold")


@router.post("/purchase", status_code=status.HTTP_201_CREATED)
async def purchase(_: PurchaseRequest):
    return await service.placeholder({}, message="Purchase scaffold")


@router.post("/adjust", status_code=status.HTTP_201_CREATED)
async def adjust(_: AdjustmentRequest):
    return await service.placeholder({}, message="Adjustment scaffold")


@router.post("/transfer", status_code=status.HTTP_201_CREATED)
async def transfer(_: TransferRequest):
    return await service.placeholder({}, message="Transfer scaffold")


@router.post("/allocate", status_code=status.HTTP_201_CREATED)
async def allocate(_: AllocationRequest):
    return await service.placeholder({}, message="Allocation scaffold")


@router.post("/return", status_code=status.HTTP_201_CREATED)
async def return_stock(_: ReturnRequest):
    return await service.placeholder({}, message="Return scaffold")


@router.get("/history/{ingredient_id}")
async def history(ingredient_id: str, page: int = 1, limit: int = 20):
    return await service.placeholder({"ingredientId": ingredient_id, "page": page, "limit": limit}, message="History scaffold")


@router.get("/low-stock")
async def low_stock():
    return await service.placeholder([], message="Low stock scaffold")


@router.get("/variance-report")
async def variance_report(storeId: str | None = None, date: str | None = None):
    return await service.placeholder({"storeId": storeId, "date": date}, message="Variance report scaffold")


@router.get("/suppliers")
async def list_suppliers():
    return await service.placeholder([], message="List suppliers scaffold")


@router.post("/suppliers", status_code=status.HTTP_201_CREATED)
async def create_supplier(_: SupplierCreateRequest):
    return await service.placeholder({}, message="Create supplier scaffold")


@router.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, _: SupplierUpdateRequest):
    return await service.placeholder({"supplierId": supplier_id}, message="Update supplier scaffold")


@router.get("/suppliers/{supplier_id}/purchase-history")
async def supplier_purchase_history(supplier_id: str):
    return await service.placeholder({"supplierId": supplier_id}, message="Supplier purchase history scaffold")


@router.get("/valuation")
async def valuation():
    return await service.placeholder({}, message="Valuation scaffold")
