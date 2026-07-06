# MODULE 4 — AI Integration (LangChain)

> **Context for the coding agent:** You are building the AI Assistant feature for **STORE**. The backend (Module 1), web dashboard (Module 2), and mobile app (Module 3) are already built or in progress. This module adds a chat-based AI assistant, accessible from the web dashboard's "AI Assistant" sidebar page, that answers operational questions by querying the live MongoDB data — things like "what were today's sales?" or "how much of ingredient X should I stock tomorrow?". **The AI must be strictly grounded in real data via tool calls — it must not hallucinate numbers.** This is a data-querying assistant, not a general chatbot.

---

## 0. Tech Stack

- LangChain (Python) for orchestration, tool-calling, and conversation memory
- Model access via **OpenRouter** (`OPENROUTER_API_KEY` already provisioned in backend `.env` per Module 1)
- Tools execute as MongoDB aggregation queries through the **existing `services/` and `repositories/` layer from Module 1** — the AI must reuse those, not write parallel raw Mongo queries that could drift from business logic (e.g. the AI's "today's sales" tool must use the same `sales_repository` logic as the Analytics module, so numbers always match what's shown on the dashboard).
- Conversation persistence: `ai_conversations` and `ai_messages` collections (already defined in Module 1's schema — do not redefine).

---

## 1. Product Behavior (what this feature actually is)

From the project owner's original notes: a sidebar page called **AI Helper** opens a chat interface. Left side panel lists previous conversations (like ChatGPT). A row of quick-prompt buttons sits above the input for common questions (e.g. "What were today's sales?", "How much of each ingredient should I stock tomorrow?"). The assistant is connected to the business's data and **must answer strictly using real queries against MongoDB** — it should not provide generic advice disconnected from the business's actual numbers, and it should not invent figures.

**Core principle: tool-call-first, narrate-second.** For any question involving numbers, dates, inventory, sales, or store data, the assistant must call a tool to fetch real data before answering. If no tool can answer the question, it should say so rather than guessing.

---

## 2. Scope Boundary

**In scope for v1:**
- Read-only operational Q&A: sales figures, inventory levels, restock suggestions, recipe costs, employee performance, store comparisons — all backed by tool calls into existing services.
- Conversation history (multi-turn, persisted, resumable).
- Simple restock forecasting (basic heuristic, not full ML forecasting — see Section 5.3).

**Explicitly out of scope for v1 (do not build, do not let the AI attempt):**
- The AI taking write actions (creating sales, adjusting inventory, editing recipes) — even though Module 1 exposes those as callable services, **do not expose write-capable tools to the LLM in v1**. This avoids a model hallucinating a destructive action. If the project owner wants this later, it should be a deliberate, explicitly-confirmed-by-user addition, not default behavior.
- Cross-business data access (the AI must always be scoped to the requesting user's `businessId`, exactly like every other backend endpoint).
- General chit-chat unrelated to the business — keep the system prompt focused; it can be polite and conversational in tone, but it should redirect off-topic requests back to what it can actually help with.

---

## 3. Architecture

```
Frontend (AI Assistant page, Module 2)
        │  POST /api/v1/ai/chat  { conversationId?, message }
        ▼
ai.py (router)
        │
        ▼
ai_service.py
        │  builds LangChain agent with:
        │    - system prompt (Section 4)
        │    - conversation history (loaded from ai_messages)
        │    - tool set (Section 5, calling Module 1 services)
        │    - OpenRouter-backed chat model
        ▼
LangChain agent executes tool calls as needed
        │
        ▼
Response persisted to ai_messages (including tool_calls/tool_results for transparency),
ai_conversations.updatedAt bumped, response returned to frontend
```

### 3.1 Backend additions (extends Module 1's structure, does not replace it)
```
backend/app/ai/
├── agent.py            # LangChain agent construction, system prompt, model config
├── tools/               # one file per tool domain
│   ├── sales_tools.py
│   ├── inventory_tools.py
│   ├── recipe_tools.py
│   ├── employee_tools.py
│   └── store_tools.py
├── memory.py             # loads/saves conversation history to ai_messages
└── prompts.py             # system prompt + quick-prompt button definitions
```
`api/ai.py` and `services/ai_service.py` already exist as stubs from Module 1 (the router was a `501` placeholder) — implement them fully now rather than creating duplicate files.

---

## 4. System Prompt (baseline — refine wording but keep these constraints)

The agent's system prompt must enforce:
1. It is an operational assistant for a specific business's STORE ERP data, scoped to `businessId` from the authenticated session — never reference or imply access to other businesses.
2. It must use tools to answer any question involving numbers, dates, or current state. It must never fabricate a sales figure, stock level, or any other data point.
3. If a tool returns no data or an error, it tells the user plainly rather than guessing a plausible-sounding number.
4. It does not take write actions. If asked to "add stock" or "record a sale" via chat, it explains that it can only answer questions in v1 and directs the user to the relevant dashboard page.
5. Keep responses concise and operational — this is a working tool for store owners/managers, not a conversational companion. Numbers should be presented clearly (tables or short lists where helpful), not buried in prose.

---

## 5. Tools (LangChain tool definitions — each wraps an existing Module 1 service call)

Each tool below must validate/inject `businessId` and (where relevant) `storeId` from the authenticated session context — the LLM should never be able to pass an arbitrary `businessId` as a parameter; it's bound server-side per request, not exposed as an LLM-controllable argument.

### 5.1 Sales Tools (`sales_tools.py`)
- `get_sales_summary(date_range, store_id=None)` → wraps `sales_service`/`analytics_service` revenue and profit aggregation. Powers "What were today's sales?", "How did Store X do this week?".
- `get_top_selling_items(date_range, store_id=None, limit=5)` → wraps food/sales analytics.
- `get_sales_by_payment_method(date_range, store_id=None)`.

### 5.2 Inventory Tools (`inventory_tools.py`)
- `get_current_stock(ingredient_name=None, store_id=None)` → wraps `inventory_service`, returns current stock levels, flags anything at/below minimum.
- `get_low_stock_items(store_id=None)` → wraps the same low-stock query used by the backend's scheduled checker (Module 1, Section 7) and the dashboard's low-stock widget — reuse, don't reimplement.
- `get_stock_history(ingredient_name, date_range, store_id=None)` → wraps `inventory_repository` ledger queries.

### 5.3 Restock Suggestion Tool (`inventory_tools.py`)
- `suggest_restock_quantities(store_id=None, days_ahead=1)` — this answers "How much should I stock tomorrow?"
- **v1 heuristic (explicit, documented, not a black box):** average daily consumption for each ingredient over the trailing 7 (or 14, configurable) days, derived from `inventory_logs` entries with `action: SALE` and `action: ALLOCATION`, projected forward by `days_ahead`, compared against `minimumStock`/`maximumStock` bounds to produce a suggested purchase/allocation quantity. Clamp suggestions to reasonable bounds (never suggest restocking below zero or absurdly above `maximumStock` without flagging it).
- This is intentionally simple for v1. Document in code comments that this is a heuristic, not a trained forecasting model, so the AI's response should frame it as an estimate ("based on the last 7 days, you used about X — consider stocking around Y"), not as certain fact.

### 5.4 Recipe Tools (`recipe_tools.py`)
- `get_recipe_cost(recipe_name_or_id)` → wraps `recipe_service.get_cost`.
- `get_recipe_ingredients(recipe_name_or_id)`.

### 5.4b Food Menu Tools (`food_tools.py`)
- `list_food_menu(category=None, status=None, limit=50)` → returns every menu item for the current business with name, category, price (BDT), cost, estimated profit, status, and a `categories` breakdown. Use this for "what's on the menu?", "what do you sell?", "show me the burger menu", "how many menu items?", etc.
- `get_food_item(name_or_id)` → returns a single menu item by name (case-insensitive) or `_id`, including price, cost, estimated profit, and `recipeId` so follow-up recipe questions stay grounded.
- Both tools are scoped to the requesting `businessId` and return compact projections (no raw `_id`, no timestamps).

### 5.5 Employee Tools (`employee_tools.py`)
- `get_employee_performance(employee_name_or_id, date_range)` → wraps employee performance service. OWNER/MANAGER scope only — if a worker somehow reaches this endpoint, restrict to their own data only (defense in depth, even though the AI Assistant page is primarily an OWNER/MANAGER tool per Module 2's sidebar structure).
- `list_employees(role?, status?, store_id?, search?, limit≤200)` → returns the Members-page roster (name, email, role, store **name** resolved via `stores.name`, status, joinedAt) plus a `roleCounts` breakdown. Password material is stripped at the projection level (`passwordHash`, `password`, `refreshToken*`). Use this whenever the user asks for a list of workers / staff / team members / "general details about employees".

### 5.6 Store Tools (`store_tools.py`)
- `compare_store_performance(date_range)` → wraps `stores_service`/analytics comparison logic.
- `get_store_status(store_id=None)` → open/closed status, today's summary.

### 5.7 MCP Query Tools (`mcp_query_tools.py`) — generic read-only escape hatch

Every tool group above covers the "happy path" questions (sales, inventory, food menu, etc.). For long-tail operational questions that don't have a dedicated typed tool — *"how many open tickets do I have?"*, *"show me the last 5 inventory adjustments"*, *"group sales by channel"* — the agent needs a generic escape hatch that still respects the read-only contract.

The dedicated HTTP bridge at `/api/v1/mcp/*` already provides that (it's what the **Data** tab uses). Rather than re-implement the same allowlist, operator-scrubbing, stage-filtering, and `businessId` injection logic, **`mcp_query_tools.py` wraps `McpService` in-process**. The HTTP route and the LangChain tool share one code path, so the bridge's safety guarantees cannot drift apart from the agent's.

Three tools are exposed:

| Tool | Purpose | Args |
|---|---|---|
| `mcp_find` | Read documents from an allowlisted collection | `collection`, `filter?`, `projection?`, `sort?`, `limit≤200` |
| `mcp_count` | Count documents matching a filter | `collection`, `filter?` |
| `mcp_aggregate` | Run a read-only aggregation pipeline | `collection`, `pipeline`, `limit≤500` |

**Safety guarantees — inherited automatically from `McpService`:**

- **Collection allowlist.** Only collections the backend actually owns (`food_items`, `sales`, `inventory_logs`, `tickets`, etc. — see `ALLOWED_COLLECTIONS` in `mcp_service.py`). Any other name raises `MCP_COLLECTION_NOT_ALLOWED`.
- **Operator scrubbing.** `$where`, `$expr`, `$function`, `$accumulator`, `$jsonSchema` are stripped silently from filters and from inside pipeline expressions.
- **Stage allowlist + denylist.** Allowed: `$match`, `$project`, `$sort`, `$limit`, `$skip`, `$count`, `$group`, `$unwind`, `$lookup`, `$addFields`, `$set`, `$replaceRoot`, `$bucket`, `$facet`, … Forbidden (raises `MCP_FORBIDDEN_STAGE`): `$out`, `$merge`, `$indexStats`, `$listSessions`, `$currentOp`, `$killCursors`.
- **`businessId` injection.** A `{ businessId: <jwt> }` `$match` is **always** prepended (or `$and`'d into the caller's first `$match`). Callers cannot read across businesses.
- **Result capping.** `find` capped at `MAX_LIMIT = 200`; `aggregate` capped at `MAX_AGGREGATION_RESULTS = 500`.
- **Redis caching.** Results cached under the `mcp` scope (`ai_cache_mcp_ttl_seconds`, default 30 s) so repeated questions don't re-hit Mongo.

**Response shape from each tool:**

```json
{ "count": <int>, "documents": [ { ... } ] }
```

`_id` and `businessId` are stripped from each returned document to save tokens — the agent never needs the Mongo internal id, and echoing `businessId` would just confirm what it already knows from the JWT.

**Why the **in-process** wrap and not an HTTP hop?**

- Zero serialization overhead — the tool calls `svc.aggregate(...)` directly on the same `motor` client the rest of the backend uses.
- No `httpx.AsyncClient` lifecycle to manage inside the LangChain agent.
- **The allowlist / scrubbing / injection logic lives in exactly one place** (`McpService`). The Data tab's HTTP route and the agent's tool wrapper are two views onto the same function.

> **Implementation note — circular import.** Importing `McpService` at module top of `mcp_query_tools.py` creates a cycle: `app.services → app.ai.agent → app.ai.tools → app.services`. The tool module defers the import with a `_service(db)` helper (line 10) so the cycle only resolves at tool-build time, not import time. This is the same pattern used by other lazy-loaded services in this codebase.

**When to use it (and when *not* to):**

- ✅ *"How many active employees do I have?"* → `mcp_count({collection: "employees", filter: {status: "active"}})`
- ✅ *"Show me the top 5 sales last week"* → `mcp_aggregate` with `$match` → `$sort` → `$limit`
- ❌ *"What's today's sales total?"* → use `get_sales_summary(date_range="today")` (typed tool, returns structured summary, cheaper tokens)
- ❌ *"What's the recipe for the Margherita pizza?"* → use `get_recipe_by_name` (typed tool)

The 8th Tool Selection Guide bullet in `prompts.py` instructs the model to prefer typed tools when one exists, and fall back to `mcp_*` only for questions without a typed counterpart.

---

## 6. API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/ai/conversations` | Create a new conversation (optionally with an initial message) |
| `GET` | `/api/v1/ai/conversations` | List conversations for current user (paginated, most recent first) |
| `GET` | `/api/v1/ai/conversations/{id}` | Get a conversation with its full message history |
| `DELETE` | `/api/v1/ai/conversations/{id}` | Delete a conversation |
| `POST` | `/api/v1/ai/chat` | Send a message; body `{ conversationId?, message }`; if `conversationId` omitted, creates a new conversation. Returns the assistant's response (and persists both messages). |
| `GET` | `/api/v1/ai/quick-prompts` | Returns the configured list of quick-prompt buttons (so the frontend doesn't hardcode them — defined in `prompts.py`) |

All routes require authentication; `businessId` and `userId` come from the JWT, never from the request body.

**Response shape for `POST /ai/chat`** (fits the standard envelope from Module 1):
```json
{
  "success": true,
  "data": {
    "conversationId": "...",
    "message": {
      "role": "assistant",
      "content": "Today's total revenue across all stores was ৳45,200, up 8% from yesterday...",
      "toolCalls": [
        { "tool": "get_sales_summary", "input": { "date_range": "today" } }
      ],
      "createdAt": "..."
    }
  }
}
```
Exposing `toolCalls` in the response (even minimally) gives the frontend the option to show "what the AI checked" for transparency — Module 2's chat UI can use this for a small "sources" indicator if desired, but it's not required to render it in v1.

### 6.1 Streaming (optional, recommended if time permits)

If implementing streaming, use Server-Sent Events on a separate `POST /api/v1/ai/chat/stream` endpoint rather than changing the contract of the non-streaming one, so Module 2's frontend can fall back to the simple request/response version if streaming isn't ready yet. Document clearly which one is actually implemented so the frontend agent doesn't build against a streaming contract that doesn't exist.

**Implementation status:** The streaming endpoint is **implemented and gated behind `AI_STREAMING_ENABLED`**.

- `POST /api/v1/ai/chat/stream` returns `text/event-stream` and emits the
  following events:
  - `event: meta` — `{ conversationId }` right after the conversation is
    resolved (new or existing).
  - `event: tool_call` — `{ tool, input }` whenever the agent invokes a tool.
  - `event: tool_result` — `{ tool, result }` when the tool returns.
  - `event: token` — `{ content }` for each streamed text fragment. Token
    chunks are produced by `model.astream` on the final response after the
    tool loop settles. If `astream` is unavailable for a given provider the
    endpoint falls back to a single `token` event containing the full reply.
  - `event: error` — `{ code, message }` if the assistant failed mid-run.
  - `event: done` — `{ conversationId, message }` with the persisted
    assistant turn, identical in shape to the non-streaming response.
- The full assistant turn (with `toolCalls` + `toolResults`) is persisted in
  `ai_messages` at the `done` event, so the rest of the app reads history
  exactly as it does on the non-streaming path.
- When `AI_STREAMING_ENABLED=false` the endpoint returns `404` so the frontend
  must opt in by setting both the backend and `VITE_AI_STREAMING=true` env
  var.
- Rate limiting, business scoping, and the grounding guard all apply on the
  streaming path. A `429` response on the initial POST returns
  `Retry-After` so the frontend can show a friendly banner.

---

## 7. Quick Prompts (configurable, not hardcoded in frontend)

Define in `prompts.py` as a simple list, returned via `GET /ai/quick-prompts`:
```python
QUICK_PROMPTS = [
    "What were today's total sales?",
    "Which ingredients are running low?",
    "How much should I restock tomorrow?",
    "What's my top selling item this week?",
    "How are my stores performing compared to each other?",
]
```
Keep this list short (4–6 items) and operational — these map directly to the tools in Section 5.

---

## 8. Conversation Memory Strategy

- Each `POST /ai/chat` call loads the last N messages (e.g. last 20, or trimmed to fit a token budget) from `ai_messages` for the given `conversationId`, in order, and passes them to LangChain as conversation history alongside the new user message.
- After the agent responds, persist both the user message and assistant message (with `toolCalls`/`toolResults` if present) to `ai_messages`, and bump `ai_conversations.updatedAt`.
- Auto-generate a conversation `title` from the first user message (simple truncation, or a cheap follow-up LLM call to summarize — truncation is fine for v1).

---

## 9. Guardrails & Error Handling

- If the LLM attempts to call a tool with a `businessId`/`storeId` it shouldn't have access to, the tool implementation rejects it server-side — this must never rely on the LLM "behaving" correctly, since prompt injection or model error is always possible.
- If a tool call fails (DB error, bad input), return a clear error to the agent so it can tell the user something went wrong, rather than the request silently failing.
- Rate-limit `/ai/chat` per user (reuse the Redis-based limiter pattern from Module 1's auth endpoints) to control OpenRouter API costs.
- Log token usage per request (store on the `ai_messages` document or a separate lightweight `ai_usage_logs` collection) so the business owner can be shown usage/cost data later if needed — not required to surface in UI for v1, but cheap to log now.

### 9.1 Data grounding

The assistant must answer with real numbers, never invented ones. Three
layers enforce this:

1. **System prompt** — `SYSTEM_PROMPT` in `app/ai/prompts.py` requires the
   agent to call a tool first and forbids fabricating figures.
2. **Tool call first** — every factual question goes through one of the
   Section 5 tools, which always scope by `businessId`.
3. **Grounding guard** — `app/ai/guard.py` runs `check_grounding()` on the
   final assistant turn. If the reply mentions numbers, dates, percentages,
   or currency **and** the agent did not invoke any tool in the same turn,
   the reply is replaced with a clarification asking the user to rephrase.

### 9.2 Caching and rate limiting (Redis)

- **Cache** — `app/services/cache.py` provides `cached(scope, businessId,
  params, ttl, producer)` used by:
  - `_invoke_tool_cached()` in `app/ai/agent.py` for LangChain tool calls
    (scope `aitool`, TTL `AI_CACHE_TOOL_TTL_SECONDS`, default 60s).
  - `McpService.find/count/aggregate` for the read-only MCP bridge
    (scope `mcp`, TTL `AI_CACHE_MCP_TTL_SECONDS`, default 30s).
  Cache keys are `ai:{scope}:{businessId}:sha1(json.dumps(params, sort_keys=True))`
  so two tenants with the same logical query never collide. When Redis is
  down, `cached()` falls back to running the producer directly.
- **Rate limit** — `app/dependencies/rate_limit.py` runs a sliding-window
  Lua script (`ZREMRANGEBYSCORE` + `ZCARD` + `ZADD`) per
  `(scope, userId)`. The default budget is
  `AI_RATE_LIMIT_PER_MINUTE + AI_RATE_LIMIT_BURST` (20 + 5 = 25 requests per
  60s window). When the limit is hit the endpoint returns `429` with a
  `Retry-After` header set from the script's oldest-entry timestamp.

### 9.3 Endpoint map

| Endpoint                          | Guard                          |
| --------------------------------- | ------------------------------ |
| `POST /api/v1/ai/conversations`   | `rate_limit_ai_chat`           |
| `POST /api/v1/ai/chat`            | `rate_limit_ai_chat`           |
| `POST /api/v1/ai/chat/stream`     | `rate_limit_ai_chat` (gated)   |
| `POST /api/v1/mcp/find`           | `rate_limit_mcp`               |
| `POST /api/v1/mcp/count`          | `rate_limit_mcp`               |
| `POST /api/v1/mcp/aggregate`      | `rate_limit_mcp`               |

---

## 10. Build Order

1. Implement `ai/agent.py` with a minimal LangChain agent (no tools yet) wired to OpenRouter, confirm a basic chat round-trip works end-to-end through `POST /ai/chat`.
2. Build conversation persistence (`memory.py`, `ai_conversations`/`ai_messages` CRUD) and the conversation list/detail/delete endpoints.
3. Implement Sales Tools first (highest-value, most-requested per the product notes), wire into the agent, test against real seeded data.
4. Implement Inventory Tools, including the restock heuristic.
5. Implement Recipe, Employee, and Store tools.
6. Implement `GET /ai/quick-prompts`.
7. Add guardrails: rate limiting, businessId enforcement tests, tool error handling.
8. (Optional) Streaming endpoint.
9. Confirm with Module 2 that the AI Assistant page's chat UI (built earlier as a shell) now works against the real endpoints — this is the integration point where Module 2 and Module 4 must agree precisely on the `POST /ai/chat` request/response shape from Section 6.

**Final integration check across all four modules:** run a full scenario — log in via web (Module 2), record a sale via mobile (Module 3) while offline, reconnect and confirm it syncs (Module 3 → Module 1), confirm it shows up in the web dashboard's sales list and analytics (Module 2 → Module 1), then ask the AI Assistant "what were today's sales?" and confirm the figure matches exactly (Module 4 → Module 1 → Module 2's displayed number). Any mismatch means a module drifted from the shared contracts in these documents — fix the drift, don't paper over it in the UI.

---

## 11. Environment Variables (Module 4 additions)

These are read by `app/config.py` and consumed by the agent, cache, rate
limiter, and streaming endpoint.

| Variable | Default | Used by | Notes |
| -------- | ------- | ------- | ----- |
| `REDIS_URL` | `redis://localhost:6379/0` | Cache + rate limit | Required for the cache and rate limit to actually take effect. Both gracefully degrade when Redis is down. |
| `OPENROUTER_API_KEY` | `""` | Agent | Must be set; the agent refuses to start without it. |
| `OPENROUTER_MODEL` | `openai/gpt-4o-mini` | Agent | Any OpenRouter model id. |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Agent | Override only if proxying. |
| `AI_TEMPERATURE` | `0.1` | Agent | Low temperature favours deterministic tool use. |
| `AI_MAX_HISTORY_MESSAGES` | `20` | Agent memory | How many prior turns to load. |
| `AI_MAX_TOOL_ROUNDS` | `4` | Agent | Hard cap on tool-loop iterations per turn. |
| `AI_CACHE_TOOL_TTL_SECONDS` | `60` | `cached()` (scope `aitool`) | Per-tool TTL. |
| `AI_CACHE_MCP_TTL_SECONDS` | `30` | `cached()` (scope `mcp`) | Per-MCP-read TTL. |
| `AI_RATE_LIMIT_PER_MINUTE` | `20` | Rate limiter | Sustained budget. |
| `AI_RATE_LIMIT_BURST` | `5` | Rate limiter | Allowed on top of the per-minute budget. |
| `AI_STREAMING_ENABLED` | `false` | `/ai/chat/stream` | Set to `true` to expose the SSE endpoint. Pair with `VITE_AI_STREAMING=true` on the frontend. |

Frontend side (set in `frontend/.env`):

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Existing — unchanged. |
| `VITE_AI_STREAMING` | `false` | Set to `true` to use the streaming path in the AI Assistant page. |
