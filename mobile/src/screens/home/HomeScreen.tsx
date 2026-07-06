import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Text, View, StyleSheet, ScrollView, RefreshControl, Pressable, useWindowDimensions } from 'react-native';
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
import { scaleValue, useSizeClass } from '@/lib/responsive';

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
  soldToday: number;
  totalAllocated: number;
}

export function HomeScreen(): JSX.Element {
  const { user } = useAuth();
  const nav = useNavigation<Nav>();
  const qc = useQueryClient();
  const storeId = user?.assignedStore ?? '';
  const today = useMemo(() => todayIso(), []);
  const { width, isCompact, isTablet } = useSizeClass();

  const s = (n: number) => scaleValue(n, width);
  const pad = s(16);
  const cardGap = s(12);
  const kpiGap = s(10);
  const kpiPad = s(14);
  const kpiRadius = s(20);
  const kpiValueSize = s(32);
  const kpiSubSize = s(16);
  const kpiLabelSize = s(11);
  const sectionLabelSize = s(12);
  const commitBarPad = s(12);

  const stepperBtn = s(54);
  const stepperGap = s(10);
  const itemGap = s(12);
  const actionTileBasis = isTablet ? '24%' : '47%';
  const kpiRowDirection: 'row' | 'column' = isCompact ? 'column' : 'row';

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
      (salesQuery.data ?? []).filter((s2) => {
        if (!s2.createdAt) return false;
        try {
          return new Date(s2.createdAt).toISOString().slice(0, 10) === today;
        } catch {
          return false;
        }
      }),
    [salesQuery.data, today],
  );

  const totalSoldToday = todays.reduce((sum, x) => sum + Number(x.quantity ?? 0), 0);
  const totalRevenueToday = todays.reduce((sum, x) => sum + Number(x.totalPrice ?? 0), 0);

  const totals = allocationQuery.data?.totals;
  const totalAllocated = totals?.allocated ?? 0;
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
    for (const x of todays) {
      map.set(x.foodItemId, (map.get(x.foodItemId) ?? 0) + Number(x.quantity ?? 0));
    }
    return map;
  }, [todays]);

  const [pending, setPending] = useState<Record<string, PendingLine>>({});

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
      const total = sales.reduce((sum, r) => sum + Number(r.quantity ?? 0), 0);
      const totalPrice = sales.reduce((sum, r) => sum + Number(r.totalPrice ?? 0), 0);
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['allocations'] });
      qc.invalidateQueries({ queryKey: ['store-inventory'] });
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
  const pendingUnits = pendingLines.reduce((sum, l) => sum + l.quantity, 0);
  const pendingTotal = pendingLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

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
        contentContainerStyle={{ gap: 14, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <OfflineBanner />

        <View style={{ flexDirection: kpiRowDirection, gap: kpiGap }}>
          <Pressable
            onPress={() => nav.navigate('Attendance')}
            style={({ pressed }) => [
              {
                padding: kpiPad,
                borderRadius: kpiRadius,
                gap: 6,
                borderWidth: 2,
              },
              styles.kpiTile,
              styles.kpiTileYellow,
              pressed ? styles.pressed : null,
              isCompact ? { width: '100%' } : { flex: 1 },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: kpiLabelSize }]}>Clock status</Text>
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
            <View style={[styles.kpiTimeRow, { marginTop: 10 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kpiSubLabel, { fontSize: s(9) }]}>In</Text>
                <Text style={[styles.kpiSubValue, { fontSize: kpiSubSize }]}>{fmtClock(attendance?.clockIn)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kpiSubLabel, { fontSize: s(9) }]}>Out</Text>
                <Text style={[styles.kpiSubValue, { fontSize: kpiSubSize }]}>{fmtClock(attendance?.clockOut)}</Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            onPress={() => nav.navigate('Inventory')}
            style={({ pressed }) => [
              {
                padding: kpiPad,
                borderRadius: kpiRadius,
                gap: 6,
                borderWidth: 2,
              },
              styles.kpiTile,
              styles.kpiTileSoft,
              pressed ? styles.pressed : null,
              isCompact ? { width: '100%' } : { flex: 1 },
            ]}
          >
            <Text style={[styles.kpiLabel, { fontSize: kpiLabelSize }]}>Today’s allocation</Text>
            <Text style={[styles.kpiValue, { fontSize: kpiValueSize }]}>{activeAllocated}</Text>
            <Text style={[styles.kpiCaption, { fontSize: s(11) }]}>units active · {activeAllocations.length} batch(es)</Text>
            <View style={[styles.kpiTimeRow, { marginTop: 10 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kpiSubLabel, { fontSize: s(9) }]}>Sold</Text>
                <Text style={[styles.kpiSubValue, { fontSize: kpiSubSize }]}>{soldFromSummary || totalSoldToday}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kpiSubLabel, { fontSize: s(9) }]}>Left</Text>
                <Text style={[styles.kpiSubValue, { fontSize: kpiSubSize }]}>{remaining}</Text>
              </View>
            </View>
            {(reclaimedAllocated > 0 || reversedAllocated > 0) ? (
              <Text style={[styles.kpiBreakdown, { fontSize: s(10) }]} numberOfLines={2}>
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
          <Text style={[styles.sectionLabel, { fontSize: sectionLabelSize }]}>Next step</Text>
          <Text style={[styles.nextAction, { fontSize: s(18) }]}>{nextAction}</Text>
          {clockedIn && !clockedOut && activeAllocations.length > 0 ? (
            <Text style={[styles.helpText, { fontSize: s(11) }]}>
              Tap a +1 chip to queue a sale, then hit “Commit sales” below to record them all at once.
            </Text>
          ) : null}
        </Card>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { fontSize: sectionLabelSize, flex: 1 }]} numberOfLines={1}>
            Sell · today’s allocated items
          </Text>
          <Pressable onPress={() => nav.navigate('Sales')} hitSlop={8}>
            <Text style={[styles.linkText, { fontSize: s(11) }]}>More sales →</Text>
          </Pressable>
        </View>

        {allocationQuery.isLoading ? (
          <Card>
            <Text style={[styles.loadingText, { fontSize: s(12) }]}>Loading today’s allocation…</Text>
          </Card>
        ) : activeAllocations.length === 0 ? (
          <Card>
            <Text style={[styles.emptyTitle, { fontSize: s(15) }]}>Nothing to sell yet</Text>
            <Text style={[styles.emptyBody, { fontSize: s(12) }]}>
              Your admin hasn’t allocated anything for today. Once they do, each menu item will
              appear here with its own +/− stepper.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: cardGap }}>
            {activeAllocations.map((alloc) => {
              const id = alloc.foodItemId;
              const line = pending[id];
              const sold = line?.soldToday ?? 0;
              const total = line?.totalAllocated ?? 0;
              const left = Math.max(total - sold, 0);
              const queued = line?.quantity ?? 0;
              return (
                <Card key={alloc.id}>
                  <View style={[styles.itemHeader, { gap: itemGap, marginBottom: s(10) }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { fontSize: s(17) }]} numberOfLines={2}>
                        {alloc.foodName ?? 'Item'}
                      </Text>
                      <Text style={[styles.itemMeta, { fontSize: s(11) }]} numberOfLines={2}>
                        ${Number(alloc.unitPrice ?? 0).toFixed(2)} · {sold}/{total} sold · {left} left
                      </Text>
                    </View>
                    {queued > 0 ? (
                      <StatusChip tone="amber" label={`Queued ${queued}`} />
                    ) : null}
                  </View>

                  <View style={[styles.stepperRow, { gap: stepperGap, marginTop: 4 }]}>
                    <Pressable
                      onPress={() => incLine(id, -1)}
                      style={({ pressed }) => [
                        styles.stepperBtn,
                        styles.stepperBtnMinus,
                        queued === 0 ? styles.stepperDisabled : null,
                        pressed ? styles.pressed : null,
                        { width: stepperBtn, height: stepperBtn, borderRadius: s(16) },
                      ]}
                      disabled={queued === 0}
                    >
                      <Text style={[styles.stepperBtnText, { fontSize: s(24) }]}>−</Text>
                    </Pressable>
                    <View style={[styles.stepperDisplay, { borderRadius: s(14), paddingVertical: s(6) }]}>
                      <Text style={[styles.stepperNumber, { fontSize: s(24) }]}>{queued}</Text>
                      <Text style={[styles.stepperCaption, { fontSize: s(10) }]} numberOfLines={1}>
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
                        { width: stepperBtn, height: stepperBtn, borderRadius: s(16) },
                      ]}
                      disabled={queued >= left}
                    >
                      <Text style={[styles.stepperBtnText, styles.stepperBtnTextAccent, { fontSize: s(24) }]}>+</Text>
                    </Pressable>
                  </View>

                  <View style={[styles.itemFooter, { marginTop: s(12) }]}>
                    <Pressable onPress={() => setLine(id, Math.min(left, left))} hitSlop={6}>
                      <Text style={[styles.linkText, { fontSize: s(11) }]}>Max ({left})</Text>
                    </Pressable>
                    <Pressable onPress={() => setLine(id, 0)} hitSlop={6}>
                      <Text style={[styles.linkText, { fontSize: s(11) }]}>Clear</Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { fontSize: sectionLabelSize }]}>Quick actions</Text>
        </View>
        <View style={[styles.actionsRow, { gap: s(10) }]}>
          <Pressable
            onPress={() => nav.navigate('Attendance')}
            style={({ pressed }) => [
              styles.actionTile,
              { padding: s(14), borderRadius: s(18), gap: 4, flexBasis: actionTileBasis },
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.actionIcon, { fontSize: s(24) }]}>⏱</Text>
            <Text style={[styles.actionLabel, { fontSize: s(15) }]} numberOfLines={1}>Attendance</Text>
            <Text style={[styles.actionCaption, { fontSize: s(10) }]} numberOfLines={2}>Clock in / out</Text>
          </Pressable>
          <Pressable
            onPress={() => nav.navigate('Inventory')}
            style={({ pressed }) => [
              styles.actionTile,
              { padding: s(14), borderRadius: s(18), gap: 4, flexBasis: actionTileBasis },
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.actionIcon, { fontSize: s(24) }]}>📦</Text>
            <Text style={[styles.actionLabel, { fontSize: s(15) }]} numberOfLines={1}>Stock</Text>
            <Text style={[styles.actionCaption, { fontSize: s(10) }]} numberOfLines={2}>Per-store inventory</Text>
          </Pressable>
          <Pressable
            onPress={() => nav.navigate('Recipes')}
            style={({ pressed }) => [
              styles.actionTile,
              { padding: s(14), borderRadius: s(18), gap: 4, flexBasis: actionTileBasis },
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.actionIcon, { fontSize: s(24) }]}>📖</Text>
            <Text style={[styles.actionLabel, { fontSize: s(15) }]} numberOfLines={1}>Recipes</Text>
            <Text style={[styles.actionCaption, { fontSize: s(10) }]} numberOfLines={2}>Prep reference</Text>
          </Pressable>
          <Pressable
            onPress={() => nav.navigate('Tickets')}
            style={({ pressed }) => [
              styles.actionTile,
              { padding: s(14), borderRadius: s(18), gap: 4, flexBasis: actionTileBasis },
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.actionIcon, { fontSize: s(24) }]}>🎫</Text>
            <Text style={[styles.actionLabel, { fontSize: s(15) }]} numberOfLines={1}>Tickets</Text>
            <Text style={[styles.actionCaption, { fontSize: s(10) }]} numberOfLines={2}>Tell admin</Text>
          </Pressable>
        </View>

        <Card>
          <Text style={[styles.sectionLabel, { fontSize: sectionLabelSize }]}>Today so far</Text>
          <View
            style={[
              styles.statRow,
              { marginTop: 10, flexWrap: 'wrap', gap: s(10) },
            ]}
          >
            <View style={{ flexBasis: '30%', flexGrow: 1 }}>
              <Text style={[styles.statLabel, { fontSize: s(10) }]}>Sales</Text>
              <Text style={[styles.statValue, { fontSize: s(20), marginTop: 2 }]}>{todays.length}</Text>
            </View>
            <View style={{ flexBasis: '30%', flexGrow: 1 }}>
              <Text style={[styles.statLabel, { fontSize: s(10) }]}>Units sold</Text>
              <Text style={[styles.statValue, { fontSize: s(20), marginTop: 2 }]}>{totalSoldToday}</Text>
            </View>
            <View style={{ flexBasis: '30%', flexGrow: 1 }}>
              <Text style={[styles.statLabel, { fontSize: s(10) }]}>Revenue</Text>
              <Text style={[styles.statValue, { fontSize: s(20), marginTop: 2 }]} numberOfLines={1}>
                ${totalRevenueToday.toFixed(2)}
              </Text>
            </View>
          </View>
        </Card>

        <Pressable
          onPress={() => nav.navigate('CloseShop')}
          style={({ pressed }) => [
            {
              padding: s(18),
              borderRadius: s(22),
              borderWidth: 2,
              gap: 6,
            },
            styles.closeCta,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={[styles.closeCtaLabel, { fontSize: s(16) }]}>Close shop for the day</Text>
          <Text style={[styles.closeCtaCaption, { fontSize: s(11) }]} numberOfLines={3}>
            End your shift, confirm totals, and review what’s left.
          </Text>
        </Pressable>
      </ScrollView>

      {pendingUnits > 0 ? (
        <View
          style={[
            styles.commitBar,
            {
              padding: commitBarPad,
              paddingBottom: commitBarPad + s(8),
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={[styles.commitBarInner, { gap: s(10) }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.commitTotal, { fontSize: s(14) }]} numberOfLines={1}>
                {pendingUnits} pending sale(s)
              </Text>
              <Text style={[styles.commitTotalCaption, { fontSize: s(11), marginTop: 2 }]} numberOfLines={1}>
                ${pendingTotal.toFixed(2)} · ready to commit
              </Text>
            </View>
            <PrimaryButton
              label={commitMutation.isPending ? 'Saving…' : 'Commit sales'}
              onPress={commit}
              disabled={commitMutation.isPending || !clockedIn}
              style={{ minWidth: s(120) }}
            />
          </View>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  kpiTile: {},
  kpiTileYellow: { backgroundColor: colors.accent, borderColor: colors.accent },
  kpiTileSoft: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  kpiLabel: { fontWeight: '900', color: colors.text, textTransform: 'uppercase', letterSpacing: 0.6 },
  kpiValue: { fontWeight: '900', color: colors.text, marginTop: 4 },
  kpiCaption: { fontWeight: '700', color: colors.muted },
  kpiTimeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  kpiSubLabel: { fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  kpiSubValue: { fontWeight: '900', color: colors.text, marginTop: 4 },
  kpiBreakdown: { fontWeight: '800', color: colors.muted, marginTop: 8 },

  sectionLabel: { fontWeight: '900', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  linkText: {
    fontWeight: '800',
    color: colors.accentText,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  nextAction: { fontWeight: '900', color: colors.text, marginTop: 6 },
  helpText: { color: colors.muted, marginTop: 6, fontWeight: '600' },

  loadingText: { color: colors.muted, fontWeight: '700' },
  emptyTitle: { fontWeight: '900', color: colors.text },
  emptyBody: { color: colors.muted, marginTop: 6 },

  itemHeader: { flexDirection: 'row', alignItems: 'center' },
  itemName: { fontWeight: '900', color: colors.text },
  itemMeta: { fontWeight: '700', color: colors.muted, marginTop: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center' },
  stepperBtn: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepperBtnMinus: { backgroundColor: colors.background, borderColor: colors.borderStrong },
  stepperBtnPlus: { backgroundColor: colors.accent, borderColor: colors.accent },
  stepperBtnText: { fontWeight: '900', color: colors.text },
  stepperBtnTextAccent: { color: colors.accentText },
  stepperDisabled: { opacity: 0.4 },
  stepperDisplay: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  stepperNumber: { fontWeight: '900', color: colors.text },
  stepperCaption: { fontWeight: '800', color: colors.muted },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  actionTile: {
    flexGrow: 1,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    alignItems: 'flex-start',
  },
  actionIcon: { fontWeight: '900', color: colors.text },
  actionLabel: { fontWeight: '900', color: colors.text },
  actionCaption: { fontWeight: '700', color: colors.muted },

  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { fontWeight: '800', color: colors.muted, textTransform: 'uppercase' },
  statValue: { fontWeight: '900', color: colors.text },

  closeCta: { borderColor: colors.borderStrong, backgroundColor: colors.background },
  closeCtaLabel: { fontWeight: '900', color: colors.text },
  closeCtaCaption: { color: colors.muted, fontWeight: '600' },

  commitBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopWidth: 2,
    borderTopColor: colors.borderStrong,
  },
  commitBarInner: { flexDirection: 'row', alignItems: 'center' },
  commitTotal: { fontWeight: '900', color: colors.text },
  commitTotalCaption: { fontWeight: '700', color: colors.muted },
});