import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createConversation,
  deleteConversation,
  getConversation,
  getMcpManifest,
  getMcpStatus,
  getQuickPrompts,
  listConversations,
  sendMessage,
  streamMessage,
  StreamChatError,
  type AIConversation,
  type AIConversationSummary,
  type AIChatResponse,
  type QuickPrompt,
} from '@/api/endpoints/ai';

export const aiKeys = {
  all: ['ai'] as const,
  conversations: () => [...aiKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...aiKeys.all, 'conversation', id] as const,
  quickPrompts: () => [...aiKeys.all, 'quickPrompts'] as const,
  mcpManifest: () => [...aiKeys.all, 'mcp-manifest'] as const,
  mcpStatus: () => [...aiKeys.all, 'mcp-status'] as const,
};

export function useConversations() {
  return useQuery<{ items: AIConversationSummary[]; meta?: { page: number; limit: number; total: number } }>({
    queryKey: aiKeys.conversations(),
    queryFn: () => listConversations(),
    staleTime: 30_000,
  });
}

export function useConversation(id: string | null) {
  return useQuery<AIConversation>({
    queryKey: id ? aiKeys.conversation(id) : aiKeys.conversation('none'),
    queryFn: () => getConversation(id as string),
    enabled: Boolean(id),
    staleTime: 5_000,
  });
}

export function useQuickPrompts() {
  return useQuery<{ items: QuickPrompt[] }>({
    queryKey: aiKeys.quickPrompts(),
    queryFn: getQuickPrompts,
    staleTime: 60 * 60_000,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (initialMessage?: string) => createConversation(initialMessage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiKeys.conversations() });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiKeys.conversations() });
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { conversationId?: string; message: string }) => sendMessage(input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: aiKeys.conversations() });
      if (data.conversationId) {
        qc.invalidateQueries({ queryKey: aiKeys.conversation(data.conversationId) });
      }
    },
  });
}

export function useMcpManifest() {
  return useQuery({
    queryKey: aiKeys.mcpManifest(),
    queryFn: getMcpManifest,
    staleTime: 60 * 60_000,
  });
}

export function useMcpStatus() {
  return useQuery({
    queryKey: aiKeys.mcpStatus(),
    queryFn: getMcpStatus,
    refetchInterval: 30_000,
  });
}

export function useSendMessageStream() {
  const qc = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<{ message: string; retryAfter: number | null } | null>(null);

  const stream = useCallback(
    async (
      input: { conversationId?: string; message: string },
      hooks: {
        onToken: (content: string) => void;
        onMeta?: (conversationId: string) => void;
        onDone?: (data: AIChatResponse) => void;
        onToolCall?: (tool: string) => void;
        onToolResult?: (tool: string) => void;
      },
    ): Promise<AIChatResponse> => {
      setIsStreaming(true);
      setStreamError(null);
      try {
        const response = await streamMessage(input, {
          onToken: ({ content }) => hooks.onToken(content),
          onMeta: ({ conversationId }) => hooks.onMeta?.(conversationId),
          onToolCall: ({ tool }) => hooks.onToolCall?.(tool),
          onToolResult: ({ tool }) => hooks.onToolResult?.(tool),
          onRetryAfter: (seconds) => setStreamError({ message: 'Rate limited', retryAfter: seconds }),
          onDone: (data) => {
            hooks.onDone?.(data);
            qc.invalidateQueries({ queryKey: aiKeys.conversations() });
            qc.invalidateQueries({ queryKey: aiKeys.conversation(data.conversationId) });
          },
        });
        return response;
      } catch (err) {
        if (err instanceof StreamChatError) {
          setStreamError({ message: err.message, retryAfter: err.retryAfter });
        } else {
          setStreamError({ message: (err as Error).message ?? 'Assistant error', retryAfter: null });
        }
        throw err;
      } finally {
        setIsStreaming(false);
      }
    },
    [qc],
  );

  return { stream, isStreaming, streamError, clearError: () => setStreamError(null) };
}