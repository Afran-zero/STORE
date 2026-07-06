import { useCallback, useState } from 'react';
import { Text, View, StyleSheet, TextInput, FlatList, Modal, Pressable, useWindowDimensions } from 'react-native';
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
import { scaleValue } from '@/lib/responsive';

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
  const { width } = useWindowDimensions();
  const s = (n: number) => scaleValue(n, width);
  return (
    <Card>
      <View style={[styles.rowHeader, { gap: 10 }]}>
        <Text style={[styles.rowTitle, { fontSize: s(15) }]} numberOfLines={2}>
          {ticket.title}
        </Text>
        <StatusChip label={ticket.priority ?? 'NORMAL'} tone={toneForPriority(ticket.priority)} />
      </View>
      {ticket.description ? (
        <Text style={[styles.body, { fontSize: s(12) }]} numberOfLines={4}>
          {ticket.description}
        </Text>
      ) : null}
      <View style={[styles.rowFooter, { flexWrap: 'wrap', gap: 6, marginTop: 6 }]}>
        <StatusChip label={ticket.status ?? 'OPEN'} tone={toneFor(ticket.status)} />
        <Text style={[styles.metaText, { fontSize: s(11) }]} numberOfLines={1}>
          {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : ''}
        </Text>
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
  const { width } = useWindowDimensions();
  const s = (n: number) => scaleValue(n, width);
  const sheetPad = s(16);
  const chipPadV = s(8);
  const chipPadH = s(10);
  const chipSize = s(11);
  const titleSize = s(20);

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
        <View
          style={[
            styles.sheet,
            {
              padding: sheetPad,
              paddingBottom: sheetPad + s(12),
              borderTopLeftRadius: s(24),
              borderTopRightRadius: s(24),
              borderTopWidth: 3,
              gap: s(10),
            },
          ]}
        >
          <Text style={[styles.sheetTitle, { fontSize: titleSize }]} numberOfLines={2}>
            Submit ticket
          </Text>
          <Text style={[styles.sheetSubtitle, { fontSize: s(12) }]} numberOfLines={2}>
            Admin will see this and respond.
          </Text>

          <Text style={[styles.label, { fontSize: s(11) }]}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Freezer door won't close"
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                borderRadius: s(14),
                paddingHorizontal: s(14),
                paddingVertical: s(12),
                fontSize: s(14),
              },
            ]}
          />

          <Text style={[styles.label, { fontSize: s(11) }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add details that help admin act on this…"
            placeholderTextColor={colors.muted}
            multiline
            style={[
              styles.input,
              styles.textarea,
              {
                borderRadius: s(14),
                paddingHorizontal: s(14),
                paddingVertical: s(12),
                fontSize: s(14),
                minHeight: s(90),
              },
            ]}
          />

          <Text style={[styles.label, { fontSize: s(11) }]}>Priority</Text>
          <View style={[styles.priorityRow, { gap: 6 }]}>
            {PRIORITIES.map((p) => {
              const selected = priority === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[
                    styles.priorityChip,
                    {
                      paddingHorizontal: chipPadH,
                      paddingVertical: chipPadV,
                      borderRadius: 999,
                      flexGrow: 1,
                    },
                    selected ? styles.priorityChipSelected : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      { fontSize: chipSize },
                      selected ? styles.priorityChipTextSelected : null,
                    ]}
                    numberOfLines={1}
                  >
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

          <View style={[styles.sheetActions, { gap: s(10), marginTop: s(4) }]}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Cancel" variant="outline" onPress={onClose} />
            </View>
            <View style={{ flex: 1.6 }}>
              <PrimaryButton
                label={mutation.isPending ? 'Submitting…' : 'Submit'}
                onPress={submit}
                disabled={mutation.isPending}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loading: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { color: colors.text, lineHeight: 20 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontWeight: '800', color: colors.text, flex: 1 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaText: { color: colors.muted, fontWeight: '600' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
  },
  sheetTitle: { fontWeight: '900', color: colors.text },
  sheetSubtitle: { color: colors.muted, fontWeight: '600' },
  sheetActions: { flexDirection: 'row' },
  label: { fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontWeight: '600',
  },
  textarea: { textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row' },
  priorityChip: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  priorityChipText: { fontWeight: '800', color: colors.muted },
  priorityChipTextSelected: { color: colors.accentText },
  error: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});