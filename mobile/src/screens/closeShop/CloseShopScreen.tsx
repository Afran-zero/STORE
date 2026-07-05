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

  return (
    <AppScreen
      title="Close shop"
      subtitle={`End-of-day review for ${new Date().toDateString()}`}
      onRefresh={onRefresh}
      refreshing={isFetching}
      scrollable={false}
    >
      <ScrollView
        contentContainerStyle={{ gap: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Card accent={clockedOut ? 'green' : 'yellow'}>
          <Text style={styles.sectionLabel}>Shift</Text>
          <View style={styles.shiftRow}>
            <View>
              <Text style={styles.shiftLabel}>Clock in</Text>
              <Text style={styles.shiftValue}>{fmt(attendance?.clockIn)}</Text>
            </View>
            <View>
              <Text style={styles.shiftLabel}>Clock out</Text>
              <Text style={styles.shiftValue}>{fmt(attendance?.clockOut)}</Text>
            </View>
          </View>
          <View style={{ marginTop: 10 }}>
            <StatusChip
              label={clockedOut ? 'CLOSED' : clockedIn ? 'ON SHIFT' : 'NOT STARTED'}
              tone={clockedOut ? 'green' : clockedIn ? 'amber' : 'gray'}
            />
          </View>
          {clockedOut ? (
            <Text style={styles.body}>You’re already clocked out for the day.</Text>
          ) : (
            <View style={{ marginTop: 12 }}>
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
                <Text style={styles.warnText}>
                  You need to clock in for the day before you can close the shop.
                </Text>
              ) : null}
            </View>
          )}
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>Today’s sales</Text>
          <View style={styles.statRow}>
            <Stat label="Sales" value={String(todays.length)} />
            <Stat label="Units" value={String(totalUnits)} />
            <Stat label="Items" value={String(uniqueItems)} />
          </View>
          <View style={[styles.statRow, { marginTop: 12 }]}>
            <Stat label="Revenue" value={`$${totalRevenue.toFixed(2)}`} accent />
            <Stat
              label="Profit"
              value={`${totalProfit >= 0 ? '+' : '-'}$${Math.abs(totalProfit).toFixed(2)}`}
              accent={totalProfit >= 0}
            />
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>Allocations</Text>
          {allocations.length === 0 ? (
            <Text style={styles.body}>
              No allocations recorded today. Ask your manager before wrapping up.
            </Text>
          ) : (
            <>
              <View style={styles.statRow}>
                <Stat label="Batches" value={String(allocations.length)} />
                <Stat label="Units left" value={String(remaining)} />
              </View>
              <View style={{ marginTop: 8, gap: 4 }}>
                {allocations.slice(0, 6).map((a) => (
                  <Text key={a.id} style={styles.body}>
                    • {a.foodName ?? a.foodItemId} — {Number(a.quantity ?? 0).toFixed(0)} units · sold {Number(a.sold ?? 0).toFixed(0)} · remaining {Number(a.remaining ?? 0).toFixed(0)}
                  </Text>
                ))}
              </View>
            </>
          )}
        </Card>

        <Card accent={lowStockList.length > 0 ? 'red' : 'green'}>
          <Text style={styles.sectionLabel}>Stock check</Text>
          {inventoryRows.length === 0 ? (
            <Text style={styles.body}>No ingredients stocked at this store.</Text>
          ) : (
            <View style={styles.statRow}>
              <Stat label="Ingredients" value={String(inventoryRows.length)} />
              <Stat
                label="Low stock"
                value={String(lowStockList.length)}
                accent={lowStockList.length === 0}
              />
            </View>
          )}
          {lowStockList.length > 0 ? (
            <View style={{ marginTop: 8 }}>
              <StatusChip tone="red" label={`${lowStockList.length} ingredient${lowStockList.length === 1 ? '' : 's'} low`} />
              {lowStockList.slice(0, 5).map((row) => (
                <Text key={`${row.storeId}-${row.ingredientId}`} style={styles.body}>
                  • {row.ingredientName ?? row.ingredientId}: {Number(row.quantity ?? 0).toFixed(2)} {row.unit ?? ''} (min {Number(row.minimumStock ?? 0).toFixed(2)})
                </Text>
              ))}
            </View>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.sectionLabel}>Reminder</Text>
          <Text style={styles.body}>
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
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? styles.statValueAccent : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 12, fontWeight: '900', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  shiftRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  shiftLabel: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  shiftValue: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 4 },
  body: { fontSize: 13, color: colors.text, lineHeight: 20, marginTop: 4 },
  warnText: { fontSize: 12, color: colors.muted, fontWeight: '700', marginTop: 8 },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 8 },
  statLabel: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  statValue: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 2 },
  statValueAccent: { color: colors.success },
});