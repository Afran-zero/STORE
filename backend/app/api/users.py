from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.core.response import success_payload
from app.dependencies.rbac import require_role
from app.schemas.user import UserAssignStoreRequest, UserCreateRequest, UserResetPasswordRequest, UserStatusUpdateRequest, UserUpdateRequest
from app.services.inventory_service import InventoryService


router = APIRouter(prefix="/users", tags=["users"])
service = InventoryService()


@router.get("")
async def list_users(_: dict = Depends(require_role(["OWNER", "MANAGER"]))):
    return await service.placeholder([], message="List users scaffold")


@router.get("/{user_id}")
async def get_user(user_id: str):
    return await service.placeholder({"userId": user_id}, message="Get user scaffold")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(_: UserCreateRequest, __: dict = Depends(require_role(["OWNER", "MANAGER"]))):
    return await service.placeholder({}, message="Create user scaffold")


@router.put("/{user_id}")
async def update_user(user_id: str, _: UserUpdateRequest):
    return await service.placeholder({"userId": user_id}, message="Update user scaffold")


@router.patch("/{user_id}/status")
async def change_status(user_id: str, _: UserStatusUpdateRequest):
    return await service.placeholder({"userId": user_id}, message="Status update scaffold")


@router.patch("/{user_id}/assign-store")
async def assign_store(user_id: str, _: UserAssignStoreRequest):
    return await service.placeholder({"userId": user_id}, message="Assign store scaffold")


@router.post("/{user_id}/reset-password")
async def reset_password(user_id: str, _: UserResetPasswordRequest):
    return await service.placeholder({"userId": user_id}, message="Reset password scaffold")
