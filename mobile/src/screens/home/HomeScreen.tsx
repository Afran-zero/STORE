import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, View, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatusChip } from '@/components/StatusChip';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useAuth } from '@/context/AuthContext';
import { getAttendanceToday, type AttendanceRecord } from '@/api/endpoints/attendance';
import {
  getStoreAllocationSummary,
  type Allocation,
} from '@/api/endpoints/allocations';
import { getStore, type Store } from '@/api/endpoints/stores';
import { listSales, recordSale, type Sale } from '@/api/endpoints/sales';
import { ApiException } from '@/types/api';
import { colors } from '@/lib/colors';

type Nav = NativeStackNavigationProp<Record<string, undefined>>;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtClock(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

interface PendingLine {
  foodItemId: string;
  foodName: string;
  unitPrice: number;
  quantity: number;
  /** How many of this item the worker has already sold today — used to derive "remaining". */
  soldToday: number;
  /** How many were ever allocated to this batch (for "remaining" math). */
  totalAllocated: number;
}

export function HomeScreen(): JSX.Element {
  const { user } = useAuth();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const storeId = user?.assignedStore ?? '';
  const today = useMemo(() => todayIso(), []);

  const attendanceQuery = useQuery({
    queryKey: ['attendance', 'today', user?.userId ?? ''],
    queryFn: getAttendanceToday,
    refetchInterval: 60_000,
  });

  const storeQuery = useQuery({
    queryKey: ['store', storeId],
    queryFn: () => getStore(storeId),
    enabled: Boolean(storeId),
  });

  const allocationQuery = useQuery({
    queryKey: ['allocations', 'summary', storeId, today],
    queryFn: () => getStoreAllocationSummary(storeId, { start: today, end: today }),
    enabled: Boolean(storeId),
  });

  const salesQuery = useQuery({
    queryKey: ['sales', 'store', storeId],
    queryFn: () => listSales(storeId || undefined),
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

  const totalSoldToday = todays.reduce((sum, s) => sum + Number(s.quantity ?? 0), 0);
  const totalRevenueToday = todays.reduce(
    (sum, s) => sum + Number(s.totalPrice ?? 0),
    0,
  );

  const totals = allocationQuery.data?.totals;
  // Lifetime allocated (sum of all statuses). Used as the "full breakdown" headline.
  const totalAllocated = totals?.allocated ?? 0;
  // The ACTIVE-only total — what a worker should treat as "what I can sell today".
  const activeAllocated = totals?.activeAllocated ?? 0;
  const reclaimedAllocated = totals?.reclaimedAllocated ?? 0;
  const reversedAllocated = totals?.reversedAllocated ?? 0;
  const remaining = totals?.remaining ?? 0;
  const soldFromSummary = totals?.sold ?? 0;
  const revenue = totals?.revenue ?? totalRevenueToday;

  const attendance: AttendanceRecord | null = attendanceQuery.data?.status
    ? (attendanceQuery.data as AttendanceRecord)
    : null;
  const clockedIn = Boolean(attendance?.clockIn);
  const clockedOut = Boolean(attendance?.clockOut);

  const activeAllocations: Allocation[] = useMemo(
    () => (allocationQuery.data?.allocations ?? []).filter((a) => (a.status ?? '').toUpperCase() === 'ACTIVE'),
    [allocationQuery.data],
  );

  const soldByFoodIdToday = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of todays) {
      map.set(s.foodItemId, (map.get(s.foodItemId) ?? 0) + Number(s.quantity ?? 0));
    }
    return map;
  }, [todays]);

  const [pending, setPending] = useState<Record<string, PendingLine>>({});

  // Reset pending whenever the underlying allocations or sales change in a way
  // that would invalidate the in-flight counters (e.g. after refresh).
  useEffect(() => {
    setPending((current) => {
      const next: Record<string, PendingLine> = {};
      for (const alloc of activeAllocations) {
        const id = alloc.foodItemId;
        const sold = soldByFoodIdToday.get(id) ?? Number(alloc.sold ?? 0);
        const total = Number(alloc.quantity ?? 0);
        const previous = current[id];
        next[id] = {
          foodItemId: id,
          foodName: alloc.foodName ?? 'Item',
          unitPrice: Number(alloc.unitPrice ?? 0),
          quantity: previous?.quantity ?? 0,
          soldToday: sold,
          totalAllocated: total,
        };
      }
      return next;
    });
  }, [activeAllocations, soldByFoodIdToday]);

  const commitMutation = useMutation({
    mutationFn: async (lines: PendingLine[]) => {
      const results: Sale[] = [];
      for (const line of lines) {
        if (line.quantity <= 0) continue;
        const sale = await recordSale({
          storeId,
          foodItemId: line.foodItemId,
          quantity: line.quantity,
          channel: 'POS',
        });
        results.push(sale);
      }
      return results;
    },
    onSuccess: (sales) => {
      const total = sales.reduce((s, r) => s + Number(r.quantity ?? 0), 0);
      const totalPrice = sales.reduce((s, r) => s + Number(r.totalPrice ?? 0), 0);
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['allocations'] });
      qc.invalidateQueries({ queryKey: ['store-inventory'] });
      // Reset pending counters
      setPending((current) => {
        const next: Record<string, PendingLine> = {};
        for (const id of Object.keys(current)) {
          next[id] = { ...current[id], quantity: 0 };
        }
        return next;
      });
      Alert.alert('Sales recorded', `${total} unit(s) · $${totalPrice.toFixed(2)}`);
    },
    onError: (err) => {
      const message = err instanceof ApiException ? err.message : 'Could not record sales';
      Alert.alert('Failed', message);
    },
  });

  function incLine(id: string, by = 1): void {
    setPending((current) => {
      const line = current[id];
      if (!line) return current;
      const next = line.quantity + by;
      // Cap at remaining stock so a worker can't queue more than was allocated.
      const remainingForItem = Math.max(line.totalAllocated - line.soldToday, 0);
      if (next < 0) return current;
      if (next > remainingForItem) {
        Alert.alert('No more stock', `Only ${remainingForItem} of "${line.foodName}" left today.`);
        return current;
      }
      return { ...current, [id]: { ...line, quantity: next } };
    });
  }

  function setLine(id: string, qty: number): void {
    setPending((current) => {
      const line = current[id];
      if (!line) return current;
      const safe = Math.max(0, Math.min(qty, Math.max(line.totalAllocated - line.soldToday, 0)));
      return { ...current, [id]: { ...line, quantity: safe } };
    });
  }

  const pendingLines = Object.values(pending).filter((l) => l.quantity > 0);
  const pendingUnits = pendingLines.reduce((s, l) => s + l.quantity, 0);
  const pendingTotal = pendingLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  function commit(): void {
    if (pendingLines.length === 0) return;
    if (!clockedIn) {
      Alert.alert('Clock in first', 'You need to clock in before recording sales.');
      nav.navigate('Attendance');
      return;
    }
    commitMutation.mutate(pendingLines);
  }

  const onRefresh = useCallback(() => {
    attendanceQuery.refetch();
    storeQuery.refetch();
    allocationQuery.refetch();
    salesQuery.refetch();
  }, [attendanceQuery, storeQuery, allocationQuery, salesQuery]);

  const isFetching =
    attendanceQuery.isFetching ||
    storeQuery.isFetching ||
    allocationQuery.isFetching ||
    salesQuery.isFetching;

  const greetHour = new Date().getHours();
  const greeting =
    greetHour < 12 ? 'Good morning' : greetHour < 18 ? 'Good afternoon' : 'Good evening';

  const nextAction =
    !clockedIn
      ? 'Clock in to start your shift'
      : clockedOut
        ? 'Shift done — review today'
        : activeAllocated === 0
          ? 'No active allocation today'
          : `Sell ${activeAllocations[0]?.foodName ?? 'an item'} +`;

  return (
    <AppScreen
      title={`${greeting}, ${user?.name?.split(' ')[0] ?? 'there'}`}
      subtitle={`${new Date().toDateString()} · ${storeQuery.data?.name ?? 'Your store'}`}
      onRefresh={onRefresh}
      refreshing={isFetching}
      scrollable={false}
    >
      <ScrollView
        contentContainerStyle={{ gap: 18, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <OfflineBanner />

        <View style={styles.kpiRow}>
          <Pressable
            onPress={() => nav.navigate('Attendance')}
            style={({ pressed }) => [
              styles.kpiTile,
              styles.kpiTileYellow,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.kpiLabel}>Clock status</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <StatusChip
                label={
                  !attendance
                    ? 'NOT STARTED'
                    : clockedOut
                      ? 'DONE'
                      : clockedIn
                        ? 'ON SHIFT'
                        : (attendance.status ?? 'PRESENT')
                }
                tone={!attendance ? 'gray' : clockedOut ? 'green' : clockedIn ? 'amber' : 'gray'}
              />
            </View>
            <View style={styles.kpiTimeRow}>
              <View>
                <Text style={styles.kpiSubLabel}>In</Text>
                <Text style={styles.kpiSubValue}>{fmtClock(attendance?.clockIn)}</Text>
              </View>
              <View>
                <Text style={styles.kpiSubLabel}>Out</Text>
                <Text style={styles.kpiSubValue}>{fmtClock(attendance?.clockOut)}</Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            onPress={() => nav.navigate('Inventory')}
            style={({ pressed }) => [
              styles.kpiTile,
              styles.kpiTileSoft,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.kpiLabel}>Today’s allocation</Text>
            <Text style={styles.kpiValue}>{activeAllocated}</Text>
            <Text style={styles.kpiCaption}>units active · {activeAllocations.length} batch(es)</Text>
            <View style={styles.kpiTimeRow}>
              <View>
                <Text style={styles.kpiSubLabel}>Sold</Text>
                <Text style={styles.kpiSubValue}>{soldFromSummary || totalSoldToday}</Text>
              </View>
              <View>
                <Text style={styles.kpiSubLabel}>Left</Text>
                <Text style={styles.kpiSubValue}>{remaining}</Text>
              </View>
            </View>
            {(reclaimedAllocated > 0 || reversedAllocated > 0) ? (
              <Text style={styles.kpiBreakdown}>
                {reclaimedAllocated > 0 ? `${reclaimedAllocated} reclaimed` : ''}
                {reclaimedAllocated > 0 && reversedAllocated > 0 ? ' · ' : ''}
                {reversedAllocated > 0 ? `${reversedAllocated} reversed` : ''}
                {' · '}
                {totalAllocated} lifetime
              </Text>
            ) : null}
          </Pressable>
        </View>

        <Card>
          <Text style={styles.sectionLabel}>Next step</Text>
          <Text style={styles.nextAction}>{nextAction}</Text>
          {clockedIn && !clockedOut && activeAllocations.length > 0 ? (
            <Text style={styles.helpText}>
              Tap a +1 chip to queue a sale, then hit “Commit sales” below to record them all at once.
            </Text>
          ) : null}
        </Card>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Sell · today’s allocated items</Text>
          <Pressable onPress={() => nav.navigate('Sales')} hitSlop={8}>
            <Text style={styles.linkText}>More sales →</Text>
          </Pressable>
        </View>

        {allocationQuery.isLoading ? (
          <Card>
            <Text style={styles.loadingText}>Loading today’s allocation…</Text>
          </Card>
        ) : activeAllocations.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>Nothing to sell yet</Text>
            <Text style={styles.emptyBody}>
              Your admin hasn’t allocated anything for today. Once they do, each menu item will
              appear here with its own +/− stepper.
            </Text>
          </Card>
        ) : (
          <View style={styles.itemList}>
            {activeAllocations.map((alloc) => {
              const id = alloc.foodItemId;
              const line = pending[id];
              const sold = line?.soldToday ?? 0;
              const total = line?.totalAllocated ?? 0;
              const left = Math.max(total - sold, 0);
              const queued = line?.quantity ?? 0;
              return (
                <Card key={alloc.id}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{alloc.foodName ?? 'Item'}</Text>
                      <Text style={styles.itemMeta}>
                        ${Number(alloc.unitPrice ?? 0).toFixed(2)} · {sold}/{total} sold · {left} left
                      </Text>
                    </View>
                    {queued > 0 ? (
                      <StatusChip tone="amber" label={`Queued ${queued}`} />
                    ) : null}
                  </View>

                  <View style={styles.stepperRow}>
                    <Pressable
                      onPress={() => incLine(id, -1)}
                      style={({ pressed }) => [
                        styles.stepperBtn,
                        styles.stepperBtnMinus,
                        queued === 0 ? styles.stepperDisabled : null,
                        pressed ? styles.pressed : null,
                      ]}
                      disabled={queued === 0}
                    >
                      <Text style={styles.stepperBtnText}>−</Text>
                    </Pressable>
                    <View style={styles.stepperDisplay}>
                      <Text style={styles.stepperNumber}>{queued}</Text>
                      <Text style={styles.stepperCaption}>
                        ${(queued * Number(alloc.unitPrice ?? 0)).toFixed(2)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => incLine(id, 1)}
                      style={({ pressed }) => [
                        styles.stepperBtn,
                        styles.stepperBtnPlus,
                        queued >= left ? styles.stepperDisabled : null,
                        pressed ? styles.pressed : null,
                      ]}
                      disabled={queued >= left}
                    >
                      <Text style={[styles.stepperBtnText, styles.stepperBtnTextAccent]}>+</Text>
                    </Pressable>
                  </View>

                  <View style={styles.itemFooter}>
                    <Pressable onPress={() => setLine(id, Math.min(left, left))} hitSlop={6}>
                      <Text style={styles.linkText}>Max ({left})</Text>
                    </Pressable>
                    <Pressable onPress={() => setLine(id, 0)} hitSlop={6}>
                      <Text style={styles.linkText}>Clear</Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Quick actions</Text>
        </View>
        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => nav.navigate('Attendance')}
            style={({ pressed }) => [styles.actionTile, pressed ? styles.pressed : null]}
          >
            <Text style={styles.actionIcon}>⏱</Text>
            <Text style={styles.actionLabel}>Attendance</Text>
            <Text style={styles.actionCaption}>Clock in / out</Text>
          </Pressable>
          <Pressable
            onPress={() => nav.navigate('Inventory')}
            style={({ pressed }) => [styles.actionTile, pressed ? styles.pressed : null]}
          >
            <Text style={styles.actionIcon}>📦</Text>
            <Text style={styles.actionLabel}>Stock</Text>
            <Text style={styles.actionCaption}>Per-store inventory</Text>
          </Pressable>
          <Pressable
            onPress={() => nav.navigate('Recipes')}
            style={({ pressed }) => [styles.actionTile, pressed ? styles.pressed : null]}
          >
            <Text style={styles.actionIcon}>📖</Text>
            <Text style={styles.actionLabel}>Recipes</Text>
            <Text style={styles.actionCaption}>Prep reference</Text>
          </Pressable>
          <Pressable
            onPress={() => nav.navigate('Tickets')}
            style={({ pressed }) => [styles.actionTile, pressed ? styles.pressed : null]}
          >
            <Text style={styles.actionIcon}>🎫</Text>
            <Text style={styles.actionLabel}>Tickets</Text>
            <Text style={styles.actionCaption}>Tell admin</Text>
          </Pressable>
        </View>

        <Card>
          <Text style={styles.sectionLabel}>Today so far</Text>
          <View style={styles.statRow}>
            <View>
              <Text style={styles.statLabel}>Sales</Text>
              <Text style={styles.statValue}>{todays.length}</Text>
            </View>
            <View>
              <Text style={styles.statLabel}>Units sold</Text>
              <Text style={styles.statValue}>{totalSoldToday}</Text>
            </View>
            <View>
              <Text style={styles.statLabel}>Revenue</Text>
              <Text style={styles.statValue}>${totalRevenueToday.toFixed(2)}</Text>
            </View>
          </View>
        </Card>

        <Pressable
          onPress={() => nav.navigate('CloseShop')}
          style={({ pressed }) => [styles.closeCta, pressed ? styles.pressed : null]}
        >
          <Text style={styles.closeCtaLabel}>Close shop for the day</Text>
          <Text style={styles.closeCtaCaption}>
            End your shift, confirm totals, and review what’s left.
          </Text>
        </Pressable>
      </ScrollView>

      {pendingUnits > 0 ? (
        <View style={styles.commitBar} pointerEvents="box-none">
          <View style={styles.commitBarInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.commitTotal}>{pendingUnits} pending sale(s)</Text>
              <Text style={styles.commitTotalCaption}>${pendingTotal.toFixed(2)} · ready to commit</Text>
            </View>
            <PrimaryButton
              label={commitMutation.isPending ? 'Saving…' : 'Commit sales'}
              onPress={commit}
              disabled={commitMutation.isPending || !clockedIn}
            />
          </View>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: 14 },
  kpiTile: {
    flex: 1,
    padding: 18,
    borderRadius: 24,
    borderWidth: 2,
    gap: 6,
  },
  kpiTileYellow: { backgroundColor: colors.accent, borderColor: colors.accent },
  kpiTileSoft: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  kpiLabel: { fontSize: 12, fontWeight: '900', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.6 },
  kpiValue: { fontSize: 38, fontWeight: '900', color: colors.text, marginTop: 4 },
  kpiCaption: { fontSize: 12, fontWeight: '700', color: colors.muted },
  kpiTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  kpiSubLabel: { fontSize: 10, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  kpiSubValue: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 4 },
  kpiBreakdown: { fontSize: 11, fontWeight: '800', color: colors.muted, marginTop: 8 },
  pressed: { opacity: 0.85 },

  sectionLabel: { fontSize: 12, fontWeight: '900', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  linkText: { fontSize: 12, fontWeight: '800', color: colors.accentText, backgroundColor: colors.accentSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
  nextAction: { fontSize: 20, fontWeight: '900', color: colors.text, marginTop: 6 },
  helpText: { fontSize: 12, color: colors.muted, marginTop: 6, fontWeight: '600', lineHeight: 18 },

  loadingText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  emptyBody: { fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 20 },

  itemList: { gap: 14 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  itemName: { fontSize: 18, fontWeight: '900', color: colors.text },
  itemMeta: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  stepperBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnMinus: { backgroundColor: colors.background, borderColor: colors.borderStrong },
  stepperBtnPlus: { backgroundColor: colors.accent, borderColor: colors.accent },
  stepperBtnText: { fontSize: 28, fontWeight: '900', color: colors.text },
  stepperBtnTextAccent: { color: colors.accentText },
  stepperDisabled: { opacity: 0.4 },
  stepperDisplay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  stepperNumber: { fontSize: 28, fontWeight: '900', color: colors.text },
  stepperCaption: { fontSize: 11, fontWeight: '800', color: colors.muted, marginTop: 2 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionTile: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 18,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    alignItems: 'flex-start',
    gap: 6,
  },
  actionIcon: { fontSize: 28, fontWeight: '900', color: colors.text },
  actionLabel: { fontSize: 16, fontWeight: '900', color: colors.text },
  actionCaption: { fontSize: 11, fontWeight: '700', color: colors.muted },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  statLabel: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  statValue: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 4 },

  closeCta: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    gap: 6,
  },
  closeCtaLabel: { fontSize: 17, fontWeight: '900', color: colors.text },
  closeCtaCaption: { fontSize: 12, color: colors.muted, fontWeight: '600' },

  commitBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: colors.background,
    borderTopWidth: 2,
    borderTopColor: colors.borderStrong,
  },
  commitBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  commitTotal: { fontSize: 16, fontWeight: '900', color: colors.text },
  commitTotalCaption: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 2 },
});