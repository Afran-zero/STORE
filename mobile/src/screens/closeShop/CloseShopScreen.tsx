import { useCallback, useMemo } from 'react';
import { Alert, Text, View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatusChip } from '@/components/StatusChip';
import { useAuth } from '@/context/AuthContext';
import {
  clockOut,
  getAttendanceToday,
  type AttendanceRecord,
} from '@/api/endpoints/attendance';
import { listSales, type Sale } from '@/api/endpoints/sales';
import {
  getStoreAllocationSummary,
  type Allocation,
} from '@/api/endpoints/allocations';
import { getStoreLowStock, getStoreInventory } from '@/api/endpoints/storeInventory';
import { colors } from '@/lib/colors';
import { scaleValue, useSizeClass } from '@/lib/responsive';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmt(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function CloseShopScreen(): JSX.Element {
  const { user } = useAuth();
  const qc = useQueryClient();
  const storeId = user?.assignedStore ?? '';
  const today = useMemo(() => todayIso(), []);
  const { width, isCompact } = useSizeClass();
  const s = (n: number) => scaleValue(n, width);

  const attendanceQuery = useQuery({
    queryKey: ['attendance', 'today', user?.userId ?? ''],
    queryFn: getAttendanceToday,
  });

  const salesQuery = useQuery({
    queryKey: ['sales', 'store', storeId],
    queryFn: () => listSales(storeId || undefined),
    enabled: Boolean(storeId),
  });

  const allocationQuery = useQuery({
    queryKey: ['allocations', 'summary', storeId, today],
    queryFn: () => getStoreAllocationSummary(storeId, { start: today, end: today }),
    enabled: Boolean(storeId),
  });

  const inventoryQuery = useQuery({
    queryKey: ['store-inventory', storeId],
    queryFn: () => getStoreInventory(storeId),
    enabled: Boolean(storeId),
  });

  const lowStockQuery = useQuery({
    queryKey: ['store-low-stock', storeId],
    queryFn: () => getStoreLowStock(storeId),
    enabled: Boolean(storeId),
  });

  const todays: Sale[] = useMemo(
    () =>
      (salesQuery.data ?? []).filter((s) => {
        if (!s.createdAt) return false;
        try {
          return new Date(s.createdAt).toISOString().slice(0, 10) === today;
        } catch {
          return false;
        }
      }),
    [salesQuery.data, today],
  );

  const totalRevenue = todays.reduce((sum, s) => sum + Number(s.totalPrice ?? 0), 0);
  const totalProfit = todays.reduce((sum, s) => sum + Number(s.profit ?? 0), 0);
  const totalUnits = todays.reduce((sum, s) => sum + Number(s.quantity ?? 0), 0);
  const uniqueItems = new Set(todays.map((s) => s.foodItemId)).size;

  const allocations: Allocation[] = allocationQuery.data?.allocations ?? [];
  const remaining = allocations.reduce(
    (sum, a) => sum + Math.max(0, Number(a.remaining ?? 0)),
    0,
  );

  const attendance: AttendanceRecord | null = attendanceQuery.data?.status
    ? (attendanceQuery.data as AttendanceRecord)
    : null;
  const clockedIn = Boolean(attendance?.clockIn);
  const clockedOut = Boolean(attendance?.clockOut);

  const clockOutMut = useMutation({
    mutationFn: () => clockOut(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      Alert.alert('Shift closed', 'You are clocked out for the day.');
    },
  });

  const onRefresh = useCallback(() => {
    attendanceQuery.refetch();
    salesQuery.refetch();
    allocationQuery.refetch();
    inventoryQuery.refetch();
    lowStockQuery.refetch();
  }, [attendanceQuery, salesQuery, allocationQuery, inventoryQuery, lowStockQuery]);

  const isFetching =
    attendanceQuery.isFetching ||
    salesQuery.isFetching ||
    allocationQuery.isFetching ||
    inventoryQuery.isFetching ||
    lowStockQuery.isFetching;

  const inventoryRows = inventoryQuery.data ?? [];
  const lowStockList = lowStockQuery.data ?? [];

  // Stack shift times on narrow phones so the values never overflow.
  const shiftDirection: 'row' | 'column' = isCompact ? 'column' : 'row';
  // Stack stat tiles inside each Card on narrow phones (3 columns would clip
  // hard on a 360px-wide phone).
  const statDirection: 'row' | 'column' = isCompact ? 'column' : 'row';

  return (
    <AppScreen
      title="Close shop"
      subtitle={`End-of-day review for ${new Date().toDateString()}`}
      onRefresh={onRefresh}
      refreshing={isFetching}
      scrollable={false}
    >
      <ScrollView
        contentContainerStyle={{ gap: s(14), paddingBottom: s(24) }}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <Card accent={clockedOut ? 'green' : 'yellow'}>
          <Text style={[styles.sectionLabel, { fontSize: s(12) }]} numberOfLines={1}>
            Shift
          </Text>
          <View
            style={[
              styles.shiftRow,
              { flexDirection: shiftDirection, gap: s(12), marginTop: s(8) },
            ]}
          >
            <View style={{ flex: shiftDirection === 'row' ? 1 : undefined }}>
              <Text style={[styles.shiftLabel, { fontSize: s(11) }]} numberOfLines={1}>
                Clock in
              </Text>
              <Text style={[styles.shiftValue, { fontSize: s(22) }]} numberOfLines={1}>
                {fmt(attendance?.clockIn)}
              </Text>
            </View>
            <View style={{ flex: shiftDirection === 'row' ? 1 : undefined }}>
              <Text style={[styles.shiftLabel, { fontSize: s(11) }]} numberOfLines={1}>
                Clock out
              </Text>
              <Text style={[styles.shiftValue, { fontSize: s(22) }]} numberOfLines={1}>
                {fmt(attendance?.clockOut)}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: s(10) }}>
            <StatusChip
              label={clockedOut ? 'CLOSED' : clockedIn ? 'ON SHIFT' : 'NOT STARTED'}
              tone={clockedOut ? 'green' : clockedIn ? 'amber' : 'gray'}
            />
          </View>
          {clockedOut ? (
            <Text style={[styles.body, { fontSize: s(13) }]} numberOfLines={3}>
              You're already clocked out for the day.
            </Text>
          ) : (
            <View style={{ marginTop: s(12) }}>
              <PrimaryButton
                label={
                  clockOutMut.isPending
                    ? 'Closing…'
                    : clockedIn
                      ? 'Clock out & close shop'
                      : 'Clock in, then close (cannot close without a shift)'
                }
                onPress={() => clockOutMut.mutate()}
                disabled={clockOutMut.isPending || !clockedIn}
              />
              {!clockedIn ? (
                <Text
                  style={[
                    styles.warnText,
                    { fontSize: s(12), marginTop: s(8) },
                  ]}
                  numberOfLines={3}
                >
                  You need to clock in for the day before you can close the shop.
                </Text>
              ) : null}
            </View>
          )}
        </Card>

        <Card>
          <Text style={[styles.sectionLabel, { fontSize: s(12) }]} numberOfLines={1}>
            Today's sales
          </Text>
          <View
            style={[
              styles.statRow,
              { flexDirection: statDirection, gap: s(8), marginTop: s(6) },
            ]}
          >
            <Stat label="Sales" value={String(todays.length)} />
            <Stat label="Units" value={String(totalUnits)} />
            <Stat label="Items" value={String(uniqueItems)} />
          </View>
          <View
            style={[
              styles.statRow,
              { flexDirection: statDirection, gap: s(8), marginTop: s(12) },
            ]}
          >
            <Stat label="Revenue" value={`$${totalRevenue.toFixed(2)}`} accent />
            <Stat
              label="Profit"
              value={`${totalProfit >= 0 ? '+' : '-'}$${Math.abs(totalProfit).toFixed(2)}`}
              accent={totalProfit >= 0}
            />
          </View>
        </Card>

        <Card>
          <Text style={[styles.sectionLabel, { fontSize: s(12) }]} numberOfLines={1}>
            Allocations
          </Text>
          {allocations.length === 0 ? (
            <Text style={[styles.body, { fontSize: s(13) }]} numberOfLines={3}>
              No allocations recorded today. Ask your manager before wrapping up.
            </Text>
          ) : (
            <>
              <View
                style={[
                  styles.statRow,
                  { flexDirection: statDirection, gap: s(8), marginTop: s(6) },
                ]}
              >
                <Stat label="Batches" value={String(allocations.length)} />
                <Stat label="Units left" value={String(remaining)} />
              </View>
              <View style={{ marginTop: s(8), gap: s(4) }}>
                {allocations.slice(0, 6).map((a) => (
                  <Text
                    key={a.id}
                    style={[styles.body, { fontSize: s(13) }]}
                    numberOfLines={3}
                  >
                    • {a.foodName ?? a.foodItemId} — {Number(a.quantity ?? 0).toFixed(0)} units · sold{' '}
                    {Number(a.sold ?? 0).toFixed(0)} · remaining{' '}
                    {Number(a.remaining ?? 0).toFixed(0)}
                  </Text>
                ))}
              </View>
            </>
          )}
        </Card>

        <Card accent={lowStockList.length > 0 ? 'red' : 'green'}>
          <Text style={[styles.sectionLabel, { fontSize: s(12) }]} numberOfLines={1}>
            Stock check
          </Text>
          {inventoryRows.length === 0 ? (
            <Text style={[styles.body, { fontSize: s(13) }]} numberOfLines={3}>
              No ingredients stocked at this store.
            </Text>
          ) : (
            <View
              style={[
                styles.statRow,
                { flexDirection: statDirection, gap: s(8), marginTop: s(6) },
              ]}
            >
              <Stat label="Ingredients" value={String(inventoryRows.length)} />
              <Stat
                label="Low stock"
                value={String(lowStockList.length)}
                accent={lowStockList.length === 0}
              />
            </View>
          )}
          {lowStockList.length > 0 ? (
            <View style={{ marginTop: s(8) }}>
              <StatusChip tone="red" label={`${lowStockList.length} ingredient${lowStockList.length === 1 ? '' : 's'} low`} />
              {lowStockList.slice(0, 5).map((row) => (
                <Text
                  key={`${row.storeId}-${row.ingredientId}`}
                  style={[styles.body, { fontSize: s(13) }]}
                  numberOfLines={3}
                >
                  • {row.ingredientName ?? row.ingredientId}: {Number(row.quantity ?? 0).toFixed(2)}{' '}
                  {row.unit ?? ''} (min {Number(row.minimumStock ?? 0).toFixed(2)})
                </Text>
              ))}
            </View>
          ) : null}
        </Card>

        <Card>
          <Text style={[styles.sectionLabel, { fontSize: s(12) }]} numberOfLines={1}>
            Reminder
          </Text>
          <Text style={[styles.body, { fontSize: s(13) }]} numberOfLines={4}>
            Closing the shop only clocks you out — it does not delete any sales or
            allocations. Managers review the day using the web reports.
          </Text>
        </Card>
      </ScrollView>
    </AppScreen>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }): JSX.Element {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.statLabel, { fontSize: 11 }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.statValue, accent ? styles.statValueAccent : null, { fontSize: 22 }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontWeight: '900',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  shiftRow: { flexDirection: 'row' },
  shiftLabel: { fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  shiftValue: { fontWeight: '900', color: colors.text, marginTop: 4 },
  body: { color: colors.text, lineHeight: 20, marginTop: 4 },
  warnText: { color: colors.muted, fontWeight: '700' },
  statRow: { flexDirection: 'row' },
  statLabel: { fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  statValue: { fontWeight: '900', color: colors.text, marginTop: 2 },
  statValueAccent: { color: colors.success },
});