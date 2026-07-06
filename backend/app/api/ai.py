from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.response import success_payload
from app.dependencies.auth import CurrentUser, get_current_user
from app.dependencies.rate_limit import rate_limit_ai_chat
from app.schemas.ai import AIChatRequest, AIConversationCreateRequest
from app.services.ai_service import AIService


router = APIRouter(prefix="/ai", tags=["ai"])
service = AIService()


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
async def create_ai_conversation(
    payload: AIConversationCreateRequest,
    current_user: Annotated[CurrentUser, Depends(rate_limit_ai_chat)],
):
    conversation = await service.create_conversation(
        business_id=current_user.businessId or "",
        user_id=current_user.userId or "",
        initial_message=payload.initialMessage,
    )
    return success_payload(conversation, message="Conversation created")


@router.get("/conversations")
async def list_ai_conversations(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
):
    result = await service.list_conversations(
        business_id=current_user.businessId or "",
        user_id=current_user.userId or "",
        page=page,
        limit=limit,
    )
    return success_payload(result["items"], meta=result["meta"])


@router.get("/conversations/{conversation_id}")
async def get_ai_conversation(conversation_id: str, current_user: CurrentUser = Depends(get_current_user)):
    data = await service.get_conversation(
        conversation_id=conversation_id,
        business_id=current_user.businessId or "",
        user_id=current_user.userId or "",
    )
    return success_payload(data)


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_200_OK)
async def delete_ai_conversation(conversation_id: str, current_user: CurrentUser = Depends(get_current_user)):
    await service.delete_conversation(
        conversation_id=conversation_id,
        business_id=current_user.businessId or "",
        user_id=current_user.userId or "",
    )
    return success_payload({}, message="Conversation deleted")


@router.post("/chat")
async def ai_chat(
    payload: AIChatRequest,
    current_user: Annotated[CurrentUser, Depends(rate_limit_ai_chat)],
):
    data = await service.chat(
        business_id=current_user.businessId or "",
        user_id=current_user.userId or "",
        role=current_user.role,
        message=payload.message,
        conversation_id=payload.conversationId,
    )
    return success_payload(data)


@router.get("/quick-prompts")
async def get_quick_prompts(_: CurrentUser = Depends(get_current_user)):
    data = await service.quick_prompts()
    return success_payload(data)
