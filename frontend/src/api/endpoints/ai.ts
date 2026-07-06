import { apiClient } from '@/api/client';
import { getAccessToken } from '@/lib/tokenStore';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt?: string;
  toolCalls?: Array<{ tool: string; input?: Record<string, unknown> }>;
  toolResults?: Array<Record<string, unknown>>;
}

export interface AIConversation {
  id: string;
  title: string;
  updatedAt?: string;
  createdAt?: string;
  messages?: AIMessage[];
}

export interface AIConversationSummary {
  id: string;
  title: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
}

export interface AIChatResponse {
  conversationId: string;
  message: AIMessage;
}

export async function listConversations(page = 1, limit = 30): Promise<{ items: AIConversationSummary[]; meta?: { page: number; limit: number; total: number } }> {
  return apiClient.get(`/api/v1/ai/conversations?page=${page}&limit=${limit}`);
}

export async function getConversation(id: string): Promise<AIConversation> {
  return apiClient.get(`/api/v1/ai/conversations/${id}`);
}

export async function createConversation(initialMessage?: string): Promise<AIConversation> {
  return apiClient.post('/api/v1/ai/conversations', { initialMessage });
}

export async function deleteConversation(id: string): Promise<{ deleted?: boolean }> {
  return apiClient.delete(`/api/v1/ai/conversations/${id}`);
}

export async function sendMessage(input: { conversationId?: string; message: string }): Promise<AIChatResponse> {
  return apiClient.post('/api/v1/ai/chat', input);
}

export type StreamEvent =
  | { type: 'meta'; conversationId: string }
  | { type: 'tool_call'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; result: Record<string, unknown> }
  | { type: 'token'; content: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'done'; conversationId: string; message: AIMessage };

export class StreamChatError extends Error {
  readonly status: number;
  readonly retryAfter: number | null;
  readonly code: string;
  constructor(message: string, status: number, code: string, retryAfter: number | null = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export interface StreamChatHandlers {
  onMeta?: (data: { conversationId: string }) => void;
  onToolCall?: (data: { tool: string; input: Record<string, unknown> }) => void;
  onToolResult?: (data: { tool: string; result: Record<string, unknown> }) => void;
  onToken?: (data: { content: string }) => void;
  onError?: (data: { code: string; message: string }) => void;
  onDone?: (data: { conversationId: string; message: AIMessage }) => void;
  onRetryAfter?: (seconds: number) => void;
}

const STREAM_TIMEOUT_MS = 60_000;

export async function streamMessage(
  input: { conversationId?: string; message: string },
  handlers: StreamChatHandlers = {},
): Promise<AIChatResponse> {
  const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
  const accessToken = getAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${baseURL}/api/v1/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ conversationId: input.conversationId, message: input.message }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    throw new StreamChatError((err as Error).message ?? 'Network error', 0, 'NETWORK_ERROR');
  }

  if (!response.ok) {
    const retryAfterHeader = response.headers.get('Retry-After');
    const retryAfter = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : null;
    let body: { error?: { code?: string; message?: string; details?: { retry_after?: number } } } = {};
    try {
      body = await response.json();
    } catch {
      // ignore
    }
    const code = body.error?.code ?? 'STREAM_ERROR';
    const message = body.error?.message ?? `Assistant request failed (${response.status})`;
    const detailsRetry = body.error?.details?.retry_after;
    clearTimeout(timeout);
    if (typeof detailsRetry === 'number') handlers.onRetryAfter?.(detailsRetry);
    else if (retryAfter != null && !Number.isNaN(retryAfter)) handlers.onRetryAfter?.(retryAfter);
    throw new StreamChatError(message, response.status, code, detailsRetry ?? retryAfter);
  }

  if (!response.body) {
    clearTimeout(timeout);
    throw new StreamChatError('Streaming is not supported by this browser', 0, 'NO_BODY');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let lastMeta: { conversationId?: string } = {};
  let lastDone: { conversationId: string; message: AIMessage } | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex = buffer.indexOf('\n\n');
    while (sepIndex !== -1) {
      const chunk = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      sepIndex = buffer.indexOf('\n\n');

      let event = 'message';
      const dataLines: string[] = [];
      for (const rawLine of chunk.split('\n')) {
        const line = rawLine.trimEnd();
        if (!line || line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      const dataRaw = dataLines.join('\n');
      if (!dataRaw) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(dataRaw);
      } catch {
        continue;
      }

      switch (event) {
        case 'meta':
          handlers.onMeta?.(parsed as { conversationId: string });
          lastMeta = parsed as { conversationId: string };
          break;
        case 'tool_call':
          handlers.onToolCall?.(parsed as { tool: string; input: Record<string, unknown> });
          break;
        case 'tool_result':
          handlers.onToolResult?.(parsed as { tool: string; result: Record<string, unknown> });
          break;
        case 'token':
          handlers.onToken?.(parsed as { content: string });
          break;
        case 'error':
          handlers.onError?.(parsed as { code: string; message: string });
          break;
        case 'done':
          lastDone = parsed as { conversationId: string; message: AIMessage };
          handlers.onDone?.(lastDone);
          break;
        default:
          break;
      }
    }
  }

  clearTimeout(timeout);

  if (!lastDone) {
    throw new StreamChatError('Assistant closed the stream unexpectedly', 0, 'STREAM_CLOSED');
  }
  return { conversationId: lastDone.conversationId, message: lastDone.message };
}

export async function getQuickPrompts(): Promise<{ items: QuickPrompt[] }> {
  return apiClient.get('/api/v1/ai/quick-prompts');
}

export interface McpManifest {
  name: string;
  version: string;
  description: string;
  transport: string[];
  tools: string[];
  collections: string[];
  limits: { maxLimit: number; maxPipelineStages: number; maxAggregationResults: number };
  blockedOperators: string[];
  blockedStages: string[];
}

export async function getMcpManifest(): Promise<McpManifest> {
  return apiClient.get('/api/v1/mcp/manifest');
}

export async function getMcpStatus(): Promise<{ ok: boolean; version?: string; readOnly: boolean; scopedBy: string }> {
  return apiClient.get('/api/v1/mcp/status');
}

export async function mcpFind(payload: {
  collection: string;
  filter?: Record<string, unknown>;
  projection?: Record<string, unknown>;
  sort?: Array<Record<string, number>>;
  limit?: number;
}): Promise<unknown[]> {
  return apiClient.post('/api/v1/mcp/find', payload);
}

export async function mcpAggregate(payload: {
  collection: string;
  pipeline: Array<Record<string, unknown>>;
  limit?: number;
}): Promise<unknown[]> {
  return apiClient.post('/api/v1/mcp/aggregate', payload);
}

export async function mcpCount(payload: { collection: string; filter?: Record<string, unknown> }): Promise<{ count: number }> {
  return apiClient.post('/api/v1/mcp/count', payload);
}