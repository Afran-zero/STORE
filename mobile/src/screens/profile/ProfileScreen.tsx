import { useCallback, useState } from 'react';
import { Alert, Text, View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
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
import { scaleValue } from '@/lib/responsive';

type Nav = NativeStackNavigationProp<Record<string, undefined>>;

export function ProfileScreen(): JSX.Element {
  const { user, logout } = useAuth();
  const nav = useNavigation<Nav>();
  const storeId = user?.assignedStore ?? '';
  const [busy, setBusy] = useState(false);
  const { width } = useWindowDimensions();
  const s = (n: number) => scaleValue(n, width);

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
              Alert.alert('Could not log out', err instanceof Error ? err.message : 'Please try again.');
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
        <Text style={[styles.name, { fontSize: s(22) }]} numberOfLines={2}>
          {user?.name ?? 'Worker'}
        </Text>
        <Text style={[styles.email, { fontSize: s(13) }]} numberOfLines={2}>
          {user?.email ?? 'No email on file'}
        </Text>
        <View style={[styles.chipRow, { gap: s(8), marginTop: s(8) }]}>
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
        <Text style={[styles.sectionLabel, { fontSize: s(12) }]} numberOfLines={1}>
          Assigned store
        </Text>
        {store ? (
          <View style={{ gap: s(4), marginTop: s(6) }}>
            <Text style={[styles.storeName, { fontSize: s(17) }]} numberOfLines={2}>
              {store.name}
            </Text>
            <Text style={[styles.body, { fontSize: s(13), lineHeight: s(20) }]} numberOfLines={3}>
              {store.address ?? 'No address on file'}
              {store.city ? `, ${store.city}` : ''}
            </Text>
            <Text style={[styles.body, { fontSize: s(13), lineHeight: s(20) }]} numberOfLines={2}>
              Code: {store.code ?? '—'}
            </Text>
            <Text style={[styles.body, { fontSize: s(13), lineHeight: s(20) }]} numberOfLines={2}>
              Hours: {store.openingTime ?? '—'} → {store.closingTime ?? '—'}
            </Text>
            <Text style={[styles.body, { fontSize: s(13), lineHeight: s(20) }]} numberOfLines={2}>
              Phone: {store.phone ?? '—'}
            </Text>
          </View>
        ) : (
          <Text style={[styles.body, { fontSize: s(13) }]} numberOfLines={3}>
            {storeId ? 'Loading store…' : 'You are not currently assigned to a store. Ask your manager.'}
          </Text>
        )}
      </Card>

      <Card>
        <Text style={[styles.sectionLabel, { fontSize: s(12) }]} numberOfLines={1}>
          Today
        </Text>
        <View
          style={[
            styles.statRow,
            { gap: s(12), marginTop: s(8), flexWrap: 'wrap' },
          ]}
        >
          <View style={{ minWidth: s(110), flexGrow: 1 }}>
            <Text style={[styles.statLabel, { fontSize: s(11) }]} numberOfLines={1}>
              Clocked in
            </Text>
            <Text style={[styles.statValue, { fontSize: s(18) }]} numberOfLines={1}>
              {attendance?.clockIn ? new Date(attendance.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
          </View>
          <View style={{ minWidth: s(110), flexGrow: 1 }}>
            <Text style={[styles.statLabel, { fontSize: s(11) }]} numberOfLines={1}>
              Clocked out
            </Text>
            <Text style={[styles.statValue, { fontSize: s(18) }]} numberOfLines={1}>
              {attendance?.clockOut ? new Date(attendance.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </Text>
          </View>
        </View>
      </Card>

      <View style={[styles.actions, { gap: s(10) }]}>
        <Pressable
          onPress={() => nav.navigate('Tickets')}
          style={({ pressed }) => [styles.tile, { padding: s(14), borderRadius: s(18), gap: s(4) }, pressed ? styles.pressed : null]}
        >
          <Text style={[styles.tileIcon, { fontSize: s(22) }]}>🎫</Text>
          <Text style={[styles.tileLabel, { fontSize: s(15) }]} numberOfLines={1}>
            My tickets
          </Text>
          <Text style={[styles.tileCaption, { fontSize: s(11) }]} numberOfLines={3}>
            Submit and follow up with admin.
          </Text>
        </Pressable>
        <Pressable
          onPress={() => nav.navigate('Recipes')}
          style={({ pressed }) => [styles.tile, { padding: s(14), borderRadius: s(18), gap: s(4) }, pressed ? styles.pressed : null]}
        >
          <Text style={[styles.tileIcon, { fontSize: s(22) }]}>📖</Text>
          <Text style={[styles.tileLabel, { fontSize: s(15) }]} numberOfLines={1}>
            Recipes
          </Text>
          <Text style={[styles.tileCaption, { fontSize: s(11) }]} numberOfLines={3}>
            Prep reference for every menu item.
          </Text>
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
  name: { fontWeight: '900', color: colors.text },
  email: { color: colors.muted, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  sectionLabel: { fontWeight: '900', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  storeName: { fontWeight: '900', color: colors.text },
  body: { color: colors.text },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  statValue: { fontWeight: '900', color: colors.text, marginTop: 2 },
  actions: { flexDirection: 'row' },
  tile: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  tileIcon: {},
  tileLabel: { fontWeight: '900', color: colors.text },
  tileCaption: { color: colors.muted, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});