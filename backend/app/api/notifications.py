from __future__ import annotations

from fastapi import APIRouter

from app.services.notification_service import NotificationService


router = APIRouter(prefix="/notifications", tags=["notifications"])
service = NotificationService()


@router.get("")
async def list_notifications(page: int = 1, limit: int = 20):
    return await service.placeholder([], message="Notifications scaffold")


@router.patch("/{notification_id}/read")
async def mark_read(notification_id: str):
    return await service.placeholder({"notificationId": notification_id}, message="Mark notification read scaffold")


@router.patch("/mark-all-read")
async def mark_all_read():
    return await service.placeholder({}, message="Mark all notifications read scaffold")
