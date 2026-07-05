import { useCallback, useState } from 'react';
import { Text, View, StyleSheet, TextInput, FlatList, Modal, Pressable } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatusChip } from '@/components/StatusChip';
import { useAuth } from '@/context/AuthContext';
import {
  createTicket,
  listTickets,
  type CreateTicketRequest,
  type Ticket,
} from '@/api/endpoints/tickets';
import { ApiException } from '@/types/api';
import { colors } from '@/lib/colors';

type Priority = CreateTicketRequest['priority'];

const PRIORITIES: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

function toneFor(status?: string): 'green' | 'amber' | 'red' | 'gray' {
  switch ((status ?? '').toUpperCase()) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'green';
    case 'IN_PROGRESS':
      return 'amber';
    case 'OPEN':
      return 'red';
    default:
      return 'gray';
  }
}

function toneForPriority(p?: string): 'amber' | 'red' | 'gray' | 'yellow' {
  switch ((p ?? '').toUpperCase()) {
    case 'URGENT':
      return 'red';
    case 'HIGH':
      return 'amber';
    case 'NORMAL':
      return 'yellow';
    default:
      return 'gray';
  }
}

export function TicketsScreen(): JSX.Element {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [composerOpen, setComposerOpen] = useState(false);

  const ticketsQuery = useQuery({
    queryKey: ['tickets', 'mine', user?.userId ?? ''],
    queryFn: listTickets,
    enabled: Boolean(user),
  });

  const onRefresh = useCallback(() => {
    void ticketsQuery.refetch();
  }, [ticketsQuery]);

  return (
    <AppScreen
      title="Tickets"
      subtitle={`${ticketsQuery.data?.length ?? 0} total`}
      onRefresh={onRefresh}
      refreshing={ticketsQuery.isFetching}
    >
      <PrimaryButton
        label="+ Submit ticket"
        caption="Tell admin about an issue — equipment, supply, schedule, etc."
        onPress={() => setComposerOpen(true)}
      />

      {ticketsQuery.isLoading ? (
        <Card>
          <Text style={styles.loading}>Loading tickets…</Text>
        </Card>
      ) : (ticketsQuery.data ?? []).length === 0 ? (
        <Card>
          <Text style={styles.title}>No tickets yet</Text>
          <Text style={styles.body}>
            Use “Submit ticket” to flag an issue. Tickets help admin prioritize fixes.
          </Text>
        </Card>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={ticketsQuery.data ?? []}
          keyExtractor={(t) => t.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => <TicketRow ticket={item} />}
        />
      )}

      <TicketComposer
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmitted={() => {
          qc.invalidateQueries({ queryKey: ['tickets'] });
          setComposerOpen(false);
        }}
        defaultStoreId={user?.assignedStore ?? ''}
      />
    </AppScreen>
  );
}

function TicketRow({ ticket }: { ticket: Ticket }): JSX.Element {
  return (
    <Card>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{ticket.title}</Text>
        <StatusChip label={ticket.priority ?? 'NORMAL'} tone={toneForPriority(ticket.priority)} />
      </View>
      {ticket.description ? <Text style={styles.body}>{ticket.description}</Text> : null}
      <View style={styles.rowFooter}>
        <StatusChip label={ticket.status ?? 'OPEN'} tone={toneFor(ticket.status)} />
        <Text style={styles.metaText}>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ''}</Text>
      </View>
    </Card>
  );
}

interface ComposerProps {
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  defaultStoreId: string;
}

function TicketComposer({ visible, onClose, onSubmitted, defaultStoreId }: ComposerProps): JSX.Element {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: CreateTicketRequest) => createTicket(input),
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setPriority('NORMAL');
      onSubmitted();
    },
  });

  function submit(): void {
    if (!title.trim()) {
      setError('Give the ticket a short title.');
      return;
    }
    setError(null);
    mutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      storeId: defaultStoreId || null,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Submit ticket</Text>
          <Text style={styles.sheetSubtitle}>Admin will see this and respond.</Text>

          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Freezer door won't close"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add details that help admin act on this…"
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, styles.textarea]}
          />

          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const selected = priority === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[styles.priorityChip, selected ? styles.priorityChipSelected : null]}
                >
                  <Text style={[styles.priorityChipText, selected ? styles.priorityChipTextSelected : null]}>
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {mutation.error instanceof ApiException ? (
            <Text style={styles.error}>{mutation.error.message}</Text>
          ) : null}

          <View style={styles.sheetActions}>
            <PrimaryButton label="Cancel" variant="outline" onPress={onClose} />
            <PrimaryButton
              label={mutation.isPending ? 'Submitting…' : 'Submit'}
              onPress={submit}
              disabled={mutation.isPending}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loading: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, color: colors.text, lineHeight: 20 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: colors.text, flex: 1 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaText: { fontSize: 12, color: colors.muted, fontWeight: '600' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    padding: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 10,
    borderTopWidth: 3,
    borderColor: colors.borderStrong,
  },
  sheetTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  sheetSubtitle: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  label: { fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  priorityChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  priorityChipText: { fontSize: 12, fontWeight: '800', color: colors.muted },
  priorityChipTextSelected: { color: colors.accentText },
  error: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});