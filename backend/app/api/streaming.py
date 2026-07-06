"""Server-Sent Events streaming variant of the AI chat endpoint.

The path is opt-in: when ``AI_STREAMING_ENABLED`` is false (default) the
router raises 404 so we don't expose a half-finished surface. When enabled
it mirrors ``POST /api/v1/ai/chat`` but pushes:

    event: meta          data: {"conversationId": "..."}
    event: tool_call     data: {"tool": "...", "input": {...}}
    event: tool_result   data: {"tool": "...", "result": {...}}
    event: token         data: {"content": "..."}    # streamed
    event: done          data: {"message": {...}}    # full assistant turn

The full assistant turn is persisted in Mongo at ``done`` so the rest of
the app keeps working exactly the same.
"""
from __future__ import annotations

import json
import logging
from typing import Annotated, Any, AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.ai.agent import (
    _build_model,
    _invoke_tool_cached,
    _safe_json,
)
from app.ai.guard import check_grounding
from app.ai.memory import (
    append_message,
    create_conversation,
    get_conversation,
    load_messages,
)
from app.ai.prompts import SYSTEM_PROMPT
from app.ai.tools import (
    build_employee_tools,
    build_inventory_tools,
    build_recipe_tools,
    build_sales_tools,
    build_store_tools,
)
from app.config import get_settings
from app.core.exceptions import ServiceUnavailableError
from app.database.client import get_database
from app.dependencies.auth import CurrentUser, get_current_user
from app.dependencies.rate_limit import rate_limit_ai_chat
from app.schemas.ai import AIChatRequest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai-stream"])


def _sse(event: str, data: Any) -> bytes:
    payload = json.dumps(data, default=str)
    return f"event: {event}\ndata: {payload}\n\n".encode("utf-8")


async def _stream_chat(
    *,
    db,
    business_id: str,
    user_id: str,
    role: str | None,
    message: str,
    conversation_id: str | None,
) -> AsyncIterator[bytes]:
    settings = get_settings()

    if conversation_id:
        conversation = await get_conversation(db, conversation_id=conversation_id, business_id=business_id, user_id=user_id)
        conversation_id = conversation["id"]
    else:
        conversation = await create_conversation(
            db,
            business_id=business_id,
            user_id=user_id,
            title=(message.strip()[:80] or "New conversation"),
        )
        conversation_id = conversation["id"]

    await append_message(db, conversation_id=conversation_id, business_id=business_id, role="user", content=message)
    yield _sse("meta", {"conversationId": conversation_id})

    tools = [
        *build_sales_tools(db, business_id),
        *build_inventory_tools(db, business_id),
        *build_recipe_tools(db, business_id),
        *build_employee_tools(db, business_id=business_id, current_user_id=user_id, current_user_role=role),
        *build_store_tools(db, business_id),
    ]
    tool_map = {tool.name: tool for tool in tools}

    try:
        model = _build_model().bind_tools(tools)
    except ServiceUnavailableError as exc:
        yield _sse("error", {"code": exc.code, "message": exc.message})
        return

    history = await load_messages(db, conversation_id=conversation_id, business_id=business_id, limit=20)

    messages: list[Any] = [SystemMessage(content=SYSTEM_PROMPT)]
    for item in history[-settings.ai_max_history_messages :]:
        role_name = (item.get("role") or "").lower()
        content = str(item.get("content") or "")
        if role_name == "assistant":
            messages.append(AIMessage(content=content))
        elif role_name == "user":
            messages.append(HumanMessage(content=content))
    messages.append(HumanMessage(content=message))

    tool_calls_payload: list[dict[str, Any]] = []
    tool_results_payload: list[dict[str, Any]] = []

    try:
        ai_response: AIMessage = await model.ainvoke(messages)
    except Exception as exc:
        logger.warning("LLM invoke failed: %s", exc)
        yield _sse("error", {"code": "AI_PROVIDER_ERROR", "message": "The assistant is unavailable right now."})
        return

    for _ in range(settings.ai_max_tool_rounds):
        if not ai_response.tool_calls:
            break
        messages.append(ai_response)
        for tool_call in ai_response.tool_calls:
            name = tool_call.get("name")
            args = tool_call.get("args") or {}
            call_id = tool_call.get("id")
            tool_calls_payload.append({"tool": name, "input": args})
            yield _sse("tool_call", {"tool": name, "input": args})
            tool = tool_map.get(name)
            if tool is None:
                result: dict[str, Any] = {"error": f"Unknown tool: {name}"}
            else:
                result = await _invoke_tool_cached(
                    tool,
                    args,
                    business_id=business_id,
                    ttl=settings.ai_cache_tool_ttl_seconds,
                )
            tool_results_payload.append({"tool": name, "result": result})
            yield _sse("tool_result", {"tool": name, "result": result})
            messages.append(ToolMessage(content=_safe_json(result), tool_call_id=call_id or name or "tool"))
        try:
            ai_response = await model.ainvoke(messages)
        except Exception as exc:
            logger.warning("LLM follow-up failed: %s", exc)
            yield _sse("error", {"code": "AI_PROVIDER_ERROR", "message": "The assistant lost its train of thought."})
            return

    # Stream final tokens (best-effort; the non-streaming fallback covers any
    # provider that does not support ``streaming=True``).
    final_chunks: list[str] = []
    try:
        async for chunk in model.astream(messages):
            piece = chunk.content if isinstance(chunk.content, str) else (
                "\n".join(str(item) for item in chunk.content) if isinstance(chunk.content, list) else ""
            )
            if piece:
                final_chunks.append(piece)
                yield _sse("token", {"content": piece})
    except Exception as exc:
        logger.debug("astream not supported or failed (%s); falling back to single chunk", exc)
        content = ai_response.content
        if isinstance(content, list):
            content = "\n".join(str(item) for item in content)
        text = str(content or "")
        if text:
            final_chunks.append(text)
            yield _sse("token", {"content": text})

    final_content = "".join(final_chunks) or str(ai_response.content or "I could not generate a response.")
    if isinstance(final_content, list):
        final_content = "\n".join(str(item) for item in final_content)

    grounding_issue = check_grounding(final_content, tool_calls_payload)
    if grounding_issue:
        final_content = grounding_issue
        yield _sse("token", {"content": "\n\n" + final_content})

    saved = await append_message(
        db,
        conversation_id=conversation_id,
        business_id=business_id,
        role="assistant",
        content=final_content,
        tool_calls=tool_calls_payload,
        tool_results=tool_results_payload,
    )
    yield _sse("done", {"conversationId": conversation_id, "message": saved})


@router.post("/chat/stream")
async def ai_chat_stream(
    payload: AIChatRequest,
    current_user: Annotated[CurrentUser, Depends(rate_limit_ai_chat)],
):
    settings = get_settings()
    if not settings.ai_streaming_enabled:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Streaming is not enabled")
    db = get_database()
    generator = _stream_chat(
        db=db,
        business_id=current_user.businessId or "",
        user_id=current_user.userId or "",
        role=current_user.role,
        message=payload.message,
        conversation_id=payload.conversationId,
    )
    return StreamingResponse(generator, media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
