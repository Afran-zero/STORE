from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.guard import check_grounding
from app.ai.prompts import SYSTEM_PROMPT
from app.ai.tools import (
    build_employee_tools,
    build_food_tools,
    build_inventory_tools,
    build_mcp_query_tools,
    build_recipe_tools,
    build_sales_tools,
    build_store_tools,
)
from app.config import get_settings
from app.core.exceptions import ServiceUnavailableError
from app.services.cache import cached


def _safe_json(value: Any) -> str:
    try:
        return json.dumps(value, default=str)
    except Exception:
        return json.dumps({"error": "Failed to serialize tool result"})


def _build_model() -> ChatOpenAI:
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise ServiceUnavailableError(
            code="AI_PROVIDER_NOT_CONFIGURED",
            message="OPENROUTER_API_KEY is not configured",
        )
    return ChatOpenAI(
        model=settings.openrouter_model,
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
        temperature=settings.ai_temperature,
        default_headers={
            "HTTP-Referer": "https://store.local",
            "X-Title": "STORE ERP",
        },
    )


async def _invoke_tool_cached(tool, args: dict[str, Any], *, business_id: str, ttl: int) -> dict[str, Any]:
    """Run a LangChain tool, caching the result for ``ttl`` seconds.

    The cache key is derived from ``(businessId, tool name, args)`` so the
    same query from the same business returns the same doc across turns.
    """

    async def producer() -> dict[str, Any]:
        try:
            return await tool.ainvoke(args)
        except Exception as exc:
            return {"error": str(exc)}

    result = await cached(
        scope="aitool",
        business_id=business_id,
        params={"tool": tool.name, "args": args},
        ttl=ttl,
        producer=producer,
    )
    return result if isinstance(result, dict) else {"result": result}


async def run_ai_agent(
    db: AsyncIOMotorDatabase,
    *,
    business_id: str,
    user_id: str,
    role: str | None,
    history: list[dict[str, Any]],
    user_message: str,
) -> dict[str, Any]:
    settings = get_settings()
    tools = [
        *build_sales_tools(db, business_id),
        *build_inventory_tools(db, business_id),
        *build_food_tools(db, business_id),
        *build_recipe_tools(db, business_id),
        *build_employee_tools(db, business_id=business_id, current_user_id=user_id, current_user_role=role),
        *build_store_tools(db, business_id),
        *build_mcp_query_tools(db, business_id),
    ]
    tool_map = {tool.name: tool for tool in tools}

    model = _build_model().bind_tools(tools)

    messages: list[Any] = [SystemMessage(content=SYSTEM_PROMPT)]
    for item in history[-settings.ai_max_history_messages :]:
        role_name = (item.get("role") or "").lower()
        content = str(item.get("content") or "")
        if role_name == "assistant":
            messages.append(AIMessage(content=content))
        elif role_name == "user":
            messages.append(HumanMessage(content=content))
    messages.append(HumanMessage(content=user_message))

    tool_calls_payload: list[dict[str, Any]] = []
    tool_results_payload: list[dict[str, Any]] = []
    usage_payload: dict[str, Any] = {}

    ai_response: AIMessage = await model.ainvoke(messages)
    if getattr(ai_response, "response_metadata", None):
        usage_payload = ai_response.response_metadata.get("token_usage", {}) or {}

    for _ in range(settings.ai_max_tool_rounds):
        if not ai_response.tool_calls:
            break
        messages.append(ai_response)
        for tool_call in ai_response.tool_calls:
            name = tool_call.get("name")
            args = tool_call.get("args") or {}
            call_id = tool_call.get("id")
            tool_calls_payload.append({"tool": name, "input": args})
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
            messages.append(ToolMessage(content=_safe_json(result), tool_call_id=call_id or name or "tool"))
        ai_response = await model.ainvoke(messages)
        if getattr(ai_response, "response_metadata", None):
            usage_payload = ai_response.response_metadata.get("token_usage", usage_payload) or usage_payload

    content = ai_response.content
    if isinstance(content, list):
        content = "\n".join(str(item) for item in content)

    final_content = str(content or "I could not generate a response.")

    grounding_issue = check_grounding(final_content, tool_calls_payload)
    if grounding_issue:
        # Replace the ungrounded reply with a clearer message; the tool calls
        # and tool results are still persisted so the user can see what we tried.
        final_content = grounding_issue

    return {
        "content": final_content,
        "toolCalls": tool_calls_payload,
        "toolResults": tool_results_payload,
        "usage": usage_payload,
    }
