import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  Database,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ApiException } from '@/types/api';
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useMcpManifest,
  useMcpStatus,
  useQuickPrompts,
  useSendMessage,
  useSendMessageStream,
} from '@/features/ai-assistant/hooks/use-ai';
import { mcpAggregate, mcpCount, mcpFind } from '@/api/endpoints/ai';
import type { AIConversationSummary, AIMessage } from '@/api/endpoints/ai';

type Tab = 'chat' | 'mcp';

const AI_STREAMING_ENABLED = import.meta.env.VITE_AI_STREAMING === 'true';

export function AiAssistantPage(): JSX.Element {
  const [tab, setTab] = useState<Tab>('chat');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState<{ id: string; content: string; tools: string[] } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const conversationsQuery = useConversations();
  const conversationQuery = useConversation(activeConversationId);
  const quickPromptsQuery = useQuickPrompts();
  const createConversation = useCreateConversation();
  const sendMutation = useSendMessage();
  const { stream, isStreaming, streamError, clearError } = useSendMessageStream();
  const deleteMutation = useDeleteConversation();

  const conversationItems = conversationsQuery.data?.items ?? [];
  const messages: AIMessage[] = useMemo(
    () => conversationQuery.data?.messages ?? [],
    [conversationQuery.data],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, conversationQuery.isFetching]);

  useEffect(() => {
    if (streamError?.retryAfter != null) {
      const handle = window.setTimeout(() => clearError(), (streamError.retryAfter + 1) * 1000);
      return () => window.clearTimeout(handle);
    }
    return undefined;
  }, [streamError?.retryAfter, clearError]);

  function startNewConversation(): void {
    setActiveConversationId(null);
    setDraft('');
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function pickConversation(item: AIConversationSummary): void {
    setActiveConversationId(item.id);
    setError(null);
  }

  async function handleSend(text?: string): Promise<void> {
    const message = (text ?? draft).trim();
    if (!message) return;
    setError(null);
    setDraft('');
    setLiveMessage(null);

    if (AI_STREAMING_ENABLED) {
      const tools: string[] = [];
      let buffered = '';
      const liveId = `live-${Date.now()}`;
      setLiveMessage({ id: liveId, content: '', tools });
      try {
        const response = await stream(
          { conversationId: activeConversationId ?? undefined, message },
          {
            onMeta: (conversationId) => setActiveConversationId(conversationId),
            onToolCall: (tool) => tools.push(tool),
            onToolResult: (tool) => tools.push(tool),
            onToken: (content) => {
              buffered += content;
              setLiveMessage({ id: liveId, content: buffered, tools: [...tools] });
            },
            onDone: (data) => {
              setLiveMessage(null);
              setActiveConversationId(data.conversationId);
            },
          },
        );
        setActiveConversationId(response.conversationId);
      } catch (err) {
        const friendly =
          err instanceof ApiException
            ? err.message
            : (err as Error)?.message ?? 'Failed to reach the assistant';
        setError(friendly);
        setLiveMessage(null);
        setDraft(message);
      }
      return;
    }

    try {
      const response = await sendMutation.mutateAsync({
        conversationId: activeConversationId ?? undefined,
        message,
      });
      setActiveConversationId(response.conversationId);
    } catch (err) {
      const message = err instanceof ApiException ? err.message : 'Failed to reach the assistant';
      setError(message);
      setDraft(message === draft ? draft : message);
    }
  }

  async function handleDelete(item: AIConversationSummary): Promise<void> {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      if (activeConversationId === item.id) startNewConversation();
    } catch (err) {
      const message = err instanceof ApiException ? err.message : 'Could not delete conversation';
      setError(message);
    }
  }

  const isSending = sendMutation.isPending || isStreaming;
  const retryAfterSeconds = streamError?.retryAfter ?? null;
  const titleForActive =
    activeConversationId == null
      ? 'New conversation'
      : conversationItems.find((c) => c.id === activeConversationId)?.title ??
        conversationQuery.data?.title ??
        'Conversation';

  return (
    <div className="grid h-[calc(100vh-160px)] grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="flex h-full flex-col gap-3 overflow-hidden p-4">
        <Button onClick={startNewConversation} className="w-full">
          <MessageSquarePlus className="mr-2 h-4 w-4" /> New chat
        </Button>

        <div className="flex items-center gap-2 rounded-2xl bg-zinc-100 p-1 text-xs">
          <TabButton active={tab === 'chat'} onClick={() => setTab('chat')} icon={<Sparkles className="h-3.5 w-3.5" />} label="Chat" />
          <TabButton active={tab === 'mcp'} onClick={() => setTab('mcp')} icon={<Database className="h-3.5 w-3.5" />} label="Data" />
        </div>

        {tab === 'chat' ? (
          <>
            <p className="px-2 pt-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              History
            </p>
            <div className="flex-1 overflow-auto pr-1">
              {conversationsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : conversationItems.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-zinc-500">
                  No conversations yet. Ask the assistant anything about your store data.
                </p>
              ) : (
                <ul className="space-y-1">
                  {conversationItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => pickConversation(item)}
                        className={cn(
                          'flex w-full items-start justify-between gap-2 rounded-2xl px-3 py-2 text-left text-sm transition',
                          activeConversationId === item.id
                            ? 'bg-zinc-950 text-white'
                            : 'text-zinc-700 hover:bg-zinc-100',
                        )}
                      >
                        <span className="line-clamp-2 font-medium">{item.title}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDelete(item);
                          }}
                          className={cn(
                            'rounded-full p-1 opacity-70 hover:opacity-100',
                            activeConversationId === item.id ? 'text-white' : 'text-zinc-500',
                          )}
                          aria-label="Delete conversation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <DataToolsRail />
        )}
      </Card>

      <Card className="flex h-full flex-col overflow-hidden p-0">
        {tab === 'chat' ? (
          <ChatPanel
            title={titleForActive}
            messages={messages}
            isLoadingHistory={conversationQuery.isFetching}
            quickPrompts={quickPromptsQuery.data?.items ?? []}
            isSending={isSending}
            error={error}
            draft={draft}
            onDraftChange={setDraft}
            onSend={() => void handleSend()}
            onQuickPrompt={(text) => void handleSend(text)}
            inputRef={inputRef}
            messagesEndRef={messagesEndRef}
            liveMessage={liveMessage}
            retryAfterSeconds={retryAfterSeconds}
            onDismissRetryAfter={() => clearError()}
          />
        ) : (
          <DataToolsPanel />
        )}
      </Card>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition',
        active ? 'bg-white text-zinc-950 shadow-soft' : 'text-zinc-500 hover:text-zinc-700',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ChatPanel({
  title,
  messages,
  isLoadingHistory,
  quickPrompts,
  isSending,
  error,
  draft,
  onDraftChange,
  onSend,
  onQuickPrompt,
  inputRef,
  messagesEndRef,
  liveMessage,
  retryAfterSeconds,
  onDismissRetryAfter,
}: {
  title: string;
  messages: AIMessage[];
  isLoadingHistory: boolean;
  quickPrompts: { id: string; label: string; prompt: string }[];
  isSending: boolean;
  error: string | null;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onQuickPrompt: (prompt: string) => void;
  inputRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.MutableRefObject<HTMLDivElement | null>;
  liveMessage: { id: string; content: string; tools: string[] } | null;
  retryAfterSeconds: number | null;
  onDismissRetryAfter: () => void;
}): JSX.Element {
  return (
    <>
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-950">{title}</h2>
          <p className="text-xs text-zinc-500">
            Grounded in your live store data — never guesses numbers.
          </p>
        </div>
        <Badge>Read-only</Badge>
      </div>

      <div className="flex-1 overflow-auto bg-zinc-50 px-6 py-6">
        {messages.length === 0 && !isLoadingHistory ? (
          <EmptyChat quickPrompts={quickPrompts} onQuickPrompt={onQuickPrompt} />
        ) : isLoadingHistory && messages.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {retryAfterSeconds != null ? (
              <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                <span>
                  You are sending messages too quickly. Try again in {retryAfterSeconds}s.
                </span>
                <Button
                  variant="ghost"
                  className="px-3 py-1 text-xs"
                  onClick={onDismissRetryAfter}
                >
                  Dismiss
                </Button>
              </div>
            ) : null}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {liveMessage ? (
              <MessageBubble
                key={liveMessage.id}
                message={{
                  id: liveMessage.id,
                  role: 'assistant',
                  content: liveMessage.content,
                  toolCalls: liveMessage.tools.map((tool) => ({ tool })),
                }}
              />
            ) : isSending ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Assistant is thinking…
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-zinc-300 bg-white shadow-soft">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder="Ask anything about your store — sales, stock, recipes, attendance…"
              rows={2}
              className="block w-full resize-none rounded-3xl bg-transparent px-5 pb-2 pt-4 text-sm focus:outline-none"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <p className="text-xs text-zinc-400">
                Press <kbd className="rounded border border-zinc-300 px-1 text-[10px]">Enter</kbd> to send · <kbd className="rounded border border-zinc-300 px-1 text-[10px]">Shift</kbd>+<kbd className="rounded border border-zinc-300 px-1 text-[10px]">Enter</kbd> for newline
              </p>
              <Button onClick={onSend} disabled={isSending || draft.trim().length === 0}>
                <Send className="mr-1.5 h-4 w-4" /> Send
              </Button>
            </div>
          </div>
          {error ? (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          ) : (
            <p className="mt-2 text-xs text-zinc-400">
              AI responses come from the configured OpenRouter model with read-only access to your business data.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function EmptyChat({
  quickPrompts,
  onQuickPrompt,
}: {
  quickPrompts: { id: string; label: string; prompt: string }[];
  onQuickPrompt: (prompt: string) => void;
}): JSX.Element {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center justify-center gap-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-zinc-950 text-white shadow-soft">
        <Sparkles className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-xl font-bold tracking-tight text-zinc-950">Ask STORE AI</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Tool-call-first assistant. It only answers from real queries against your MongoDB data.
        </p>
      </div>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {quickPrompts.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onQuickPrompt(p.prompt)}
            className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-800 transition hover:border-zinc-950 hover:bg-zinc-50"
          >
            {p.label ?? p.prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AIMessage }): JSX.Element {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const hasTools = (message.toolCalls?.length ?? 0) > 0;
  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-3xl px-4 py-3 text-sm shadow-soft',
          isUser ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-900',
          isTool && 'border border-dashed border-zinc-300 italic text-zinc-500',
        )}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        {hasTools ? (
          <div
            className={cn(
              'mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider',
              isUser ? 'text-white/70' : 'text-zinc-500',
            )}
          >
            <Wrench className="h-3 w-3" />
            <span>Tools:</span>
            {(message.toolCalls ?? []).map((tc, idx) => (
              <span
                key={`${tc.tool}-${idx}`}
                className={cn(
                  'rounded-full px-2 py-0.5',
                  isUser ? 'bg-white/10' : 'bg-zinc-100',
                )}
              >
                {tc.tool}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DataToolsRail(): JSX.Element {
  const manifest = useMcpManifest();
  const status = useMcpStatus();
  const collections = manifest.data?.collections ?? [];
  const blocked = manifest.data?.blockedOperators ?? [];
  const stages = manifest.data?.blockedStages ?? [];

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-auto pr-1">
      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">MongoDB MCP</p>
        <p className="mt-2 flex items-center gap-2 text-sm font-bold text-zinc-950">
          <span
            className={cn(
              'inline-flex h-2 w-2 rounded-full',
              status.data?.ok ? 'bg-emerald-500' : 'bg-amber-500',
            )}
          />
          {status.data?.ok ? 'Connected · read-only' : 'Checking connection…'}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Server version: {status.data?.version ?? 'unknown'} · scoped to your businessId.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Collections</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {collections.map((name) => (
            <span key={name} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-700">
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Blocked operators</p>
        <p className="mt-1 text-[11px] text-zinc-500">
          The bridge refuses these for safety — even if a model attempts them.
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {blocked.map((op) => (
            <span key={op} className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-mono text-red-700">
              {op}
            </span>
          ))}
          {stages.map((stage) => (
            <span key={stage} className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-mono text-red-700">
              {stage}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DataToolsPanel(): JSX.Element {
  const manifest = useMcpManifest();
  const collections = manifest.data?.collections ?? [];

  const [collection, setCollection] = useState<string>('sales');
  const [filterText, setFilterText] = useState('{"channel": "POS"}');
  const [limit, setLimit] = useState(20);
  const [result, setResult] = useState<{ docs: unknown[]; meta: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (collections.length > 0 && !collections.includes(collection)) {
      setCollection(collections[0]);
    }
  }, [collections, collection]);

  async function runFind(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const filter = filterText.trim() ? JSON.parse(filterText) : undefined;
      const docs = (await mcpFind({ collection, filter, limit })) as unknown[];
      setResult({ docs, meta: `${docs.length} document(s) from ${collection}` });
    } catch (err) {
      const message = err instanceof ApiException ? err.message : (err as Error).message;
      setError(message);
    } finally {
      setPending(false);
    }
  }

  async function runCount(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const filter = filterText.trim() ? JSON.parse(filterText) : undefined;
      const out = await mcpCount({ collection, filter });
      setResult({ docs: [out], meta: `count(${collection}) = ${out.count}` });
    } catch (err) {
      const message = err instanceof ApiException ? err.message : (err as Error).message;
      setError(message);
    } finally {
      setPending(false);
    }
  }

  async function runAggregate(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const pipeline = JSON.parse(filterText);
      if (!Array.isArray(pipeline)) throw new Error('Pipeline must be a JSON array');
      const docs = (await mcpAggregate({ collection, pipeline, limit })) as unknown[];
      setResult({ docs, meta: `${docs.length} result(s) from ${collection}` });
    } catch (err) {
      const message = err instanceof ApiException ? err.message : (err as Error).message;
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-zinc-950">Read-only data explorer</h2>
          <p className="text-xs text-zinc-500">
            Run safe MongoDB queries against your business data. Results are scoped automatically.
          </p>
        </div>
        <Badge>Scoped by businessId</Badge>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 overflow-auto border-r border-zinc-200 p-6">
          <div>
            <Label htmlFor="collection">Collection</Label>
            <select
              id="collection"
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              {collections.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="filter">
              {collection === 'sales' ? 'Filter (JSON object) — or pipeline (JSON array) for aggregate' : 'Filter or pipeline (JSON)'}
            </Label>
            <textarea
              id="filter"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-2xl border border-zinc-300 bg-white p-3 font-mono text-xs"
              spellCheck={false}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="limit" className="flex-1">Limit</Label>
            <Input id="limit" type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 50)} className="w-24" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={() => void runFind()} disabled={pending}>
              <ArrowUp className="mr-1.5 h-3.5 w-3.5 rotate-45" /> find
            </Button>
            <Button onClick={() => void runCount()} disabled={pending} variant="outline">
              count
            </Button>
            <Button onClick={() => void runAggregate()} disabled={pending} variant="outline">
              aggregate
            </Button>
          </div>
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <p className="font-semibold">Query failed</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          ) : null}
          <p className="mt-auto text-[11px] text-zinc-500">
            Operators like <code className="font-mono">$where</code>, <code className="font-mono">$out</code>, <code className="font-mono">$merge</code> are blocked. businessId is injected automatically.
          </p>
        </div>

        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 text-xs text-zinc-500">
            <span>{pending ? 'Running…' : result?.meta ?? 'Run a query to see results.'}</span>
            <Button
              variant="ghost"
              onClick={() => {
                setResult(null);
                setError(null);
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5 rotate-45" /> clear
            </Button>
          </div>
          <pre className="flex-1 overflow-auto bg-zinc-950 px-6 py-4 font-mono text-[11px] text-emerald-100">
            {result ? JSON.stringify(result.docs, null, 2) : '// no results yet'}
          </pre>
        </div>
      </div>
    </div>
  );
}