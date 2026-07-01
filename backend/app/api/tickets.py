from __future__ import annotations

from fastapi import APIRouter, status

from app.schemas.ticket import TicketAttachmentRequest, TicketAssignRequest, TicketCommentRequest, TicketCreateRequest, TicketStatusUpdateRequest, TicketUpdateRequest
from app.services.notification_service import NotificationService


router = APIRouter(prefix="/tickets", tags=["tickets"])
service = NotificationService()


@router.get("")
async def list_tickets():
    return await service.placeholder([], message="List tickets scaffold")


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_ticket(_: TicketCreateRequest):
    return await service.placeholder({}, message="Create ticket scaffold")


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str):
    return await service.placeholder({"ticketId": ticket_id}, message="Get ticket scaffold")


@router.put("/{ticket_id}")
async def update_ticket(ticket_id: str, _: TicketUpdateRequest):
    return await service.placeholder({"ticketId": ticket_id}, message="Update ticket scaffold")


@router.post("/{ticket_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment(ticket_id: str, _: TicketCommentRequest):
    return await service.placeholder({"ticketId": ticket_id}, message="Ticket comment scaffold")


@router.patch("/{ticket_id}/status")
async def change_status(ticket_id: str, _: TicketStatusUpdateRequest):
    return await service.placeholder({"ticketId": ticket_id}, message="Ticket status scaffold")


@router.patch("/{ticket_id}/assign")
async def assign_ticket(ticket_id: str, _: TicketAssignRequest):
    return await service.placeholder({"ticketId": ticket_id}, message="Assign ticket scaffold")


@router.post("/{ticket_id}/attachments", status_code=status.HTTP_201_CREATED)
async def add_attachments(ticket_id: str, _: TicketAttachmentRequest):
    return await service.placeholder({"ticketId": ticket_id}, message="Ticket attachments scaffold")
