import { useCallback, useState } from 'react';
import { Alert, Text, View, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatusChip } from '@/components/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { getStore, type Store } from '@/api/endpoints/stores';
import { getAttendanceToday, type AttendanceRecord } from '@/api/endpoints/attendance';
import { listTickets } from '@/api/endpoints/tickets';
import { colors } from '@/lib/colors';

type Nav = NativeStackNavigationProp<Record<string, undefined>>;

export function ProfileScreen(): JSX.Element {
  const { user, logout } = useAuth();
  const nav = useNavigation<Nav>();
  const storeId = user?.assignedStore ?? '';
  const [busy, setBusy] = useState(false);

  const storeQuery = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => getStore(storeId),
    enabled: Boolean(storeId),
  });

  const attendanceQuery = useQuery({
    queryKey: ['attendance', 'today', user?.userId ?? ''],
    queryFn: getAttendanceToday,
  });

  const ticketsQuery = useQuery({
    queryKey: ['tickets', 'mine', user?.userId ?? ''],
    queryFn: listTickets,
    enabled: Boolean(user),
  });

  const onRefresh = useCallback(() => {
    storeQuery.refetch();
    attendanceQuery.refetch();
    ticketsQuery.refetch();
  }, [storeQuery, attendanceQuery, ticketsQuery]);

  const onLogout = (): void => {
    Alert.alert(
      'Log out',
      'You will need to log in again next time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await logout();
            } catch (err) {
              Alert.alert(
                'Could not log out',
                err instanceof Error ? err.message : 'Please try again.',
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const store: Store | null = storeQuery.data ?? null;
  const attendance: AttendanceRecord | null = attendanceQuery.data?.status
    ? (attendanceQuery.data as AttendanceRecord)
    : null;
  const openTickets = (ticketsQuery.data ?? []).filter(
    (t) => (t.status ?? '').toUpperCase() === 'OPEN',
  ).length;

  return (
    <AppScreen
      title="Profile"
      subtitle="Account and assigned store details."
      onRefresh={onRefresh}
      refreshing={storeQuery.isFetching || attendanceQuery.isFetching || ticketsQuery.isFetching}
    >
      <Card accent="yellow">
        <Text style={styles.name}>{user?.name ?? 'Worker'}</Text>
        <Text style={styles.email}>{user?.email ?? 'No email on file'}</Text>
        <View style={styles.chipRow}>
          <StatusChip label={(user?.role ?? 'WORKER').toUpperCase()} tone="amber" />
          <StatusChip
            label={attendance ? (attendance.status ?? 'PRESENT') : 'OFFLINE'}
            tone={attendance ? 'green' : 'gray'}
          />
          {openTickets > 0 ? (
            <StatusChip tone="red" label={`${openTickets} open ticket${openTickets === 1 ? '' : 's'}`} />
          ) : null}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionLabel}>Assigned store</Text>
        {store ? (
          <View style={{ gap: 4, marginTop: 6 }}>
            <Text style={styles.storeName}>{store.name}</Text>
            <Text style={styles.body}>
              {store.address ?? 'No address on file'}
              {store.city ? `, ${store.city}` : ''}
            </Text>
            <Text style={styles.body}>Code: {store.code ?? '—'}</Text>
            <Text style={styles.body}>
              Hours: {store.openingTime ?? '—'} → {store.closingTime ?? '—'}
            </Text>
            <Text style={styles.body}>Phone: {store.phone ?? '—'}</Text>
          </View>
        ) : (
          <Text style={styles.body}>
            {storeId ? 'Loading store…' : 'You are not currently assigned to a store. Ask your manager.'}
          </Text>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionLabel}>Today</Text>
        <View style={styles.statRow}>
          <View>
            <Text style={styles.statLabel}>Clocked in</Text>
            <Text style={styles.statValue}>
              {attendance?.clockIn ? new Date(attendance.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
          </View>
          <View>
            <Text style={styles.statLabel}>Clocked out</Text>
            <Text style={styles.statValue}>
              {attendance?.clockOut ? new Date(attendance.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.actions}>
        <Pressable
          onPress={() => nav.navigate('Tickets')}
          style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
        >
          <Text style={styles.tileIcon}>🎫</Text>
          <Text style={styles.tileLabel}>My tickets</Text>
          <Text style={styles.tileCaption}>Submit and follow up with admin.</Text>
        </Pressable>
        <Pressable
          onPress={() => nav.navigate('Recipes')}
          style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
        >
          <Text style={styles.tileIcon}>📖</Text>
          <Text style={styles.tileLabel}>Recipes</Text>
          <Text style={styles.tileCaption}>Prep reference for every menu item.</Text>
        </Pressable>
      </View>

      <PrimaryButton
        label={busy ? 'Logging out…' : 'Log out'}
        variant="outline"
        onPress={onLogout}
        disabled={busy}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: '900', color: colors.text },
  email: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  sectionLabel: { fontSize: 12, fontWeight: '900', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  storeName: { fontSize: 17, fontWeight: '900', color: colors.text },
  body: { fontSize: 13, color: colors.text, lineHeight: 20 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  statLabel: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 12 },
  tile: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    gap: 4,
  },
  tileIcon: { fontSize: 22 },
  tileLabel: { fontSize: 15, fontWeight: '900', color: colors.text },
  tileCaption: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});