import { useCallback, useMemo } from 'react';
import { Text, View, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatusChip } from '@/components/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { getStoreInventory, type StoreInventoryRow } from '@/api/endpoints/storeInventory';
import { getStoreAllocatedIngredients, type AllocatedIngredientItem } from '@/api/endpoints/allocations';
import { colors } from '@/lib/colors';
import { scaleValue, useSizeClass } from '@/lib/responsive';

interface InventoryScreenProps {
  onOpenTodaysAllocation?: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function InventoryScreen({ onOpenTodaysAllocation }: InventoryScreenProps = {}): JSX.Element {
  const { user } = useAuth();
  const storeId = user?.assignedStore ?? '';
  const today = todayIso();
  const { width, isCompact, isTablet } = useSizeClass();
  const s = (n: number) => scaleValue(n, width);

  const inventoryQuery = useQuery({
    queryKey: ['store-inventory', storeId],
    queryFn: () => getStoreInventory(storeId),
    enabled: Boolean(storeId),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const allocatedQuery = useQuery({
    queryKey: ['store-allocated-ingredients', storeId, today],
    queryFn: () =>
      getStoreAllocatedIngredients(storeId, {
        start: today,
        end: today,
        status: ['ACTIVE'],
      }),
    enabled: Boolean(storeId),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const shelfRows = inventoryQuery.data ?? [];
  const allocatedItems = allocatedQuery.data?.items ?? [];

  const allocatedById = useMemo(() => {
    const map = new Map<string, AllocatedIngredientItem>();
    for (const item of allocatedItems) {
      map.set(String(item.ingredientId), item);
    }
    return map;
  }, [allocatedItems]);

  const rows = useMemo(() => {
    const resolveName = (row: StoreInventoryRow, allocated?: AllocatedIngredientItem): string => {
      return (
        row.ingredientName ??
        row.ingredient?.name ??
        allocated?.ingredientName ??
        'Unnamed ingredient'
      );
    };
    const resolveUnit = (row: StoreInventoryRow, allocated?: AllocatedIngredientItem): string | null => {
      return row.unit ?? row.ingredient?.unit ?? allocated?.unit ?? null;
    };

    const map = new Map<string, ShelfRowView>();
    for (const row of shelfRows) {
      const id = String(row.ingredientId);
      const allocated = allocatedById.get(id);
      map.set(id, {
        id,
        name: resolveName(row, allocated),
        unit: resolveUnit(row, allocated),
        shelfQty: Number(row.quantity ?? 0),
        minimum: Number(row.minimumStock ?? 0),
        allocatedQty: allocated ? Number(allocated.allocated ?? 0) : 0,
        byFood: allocated?.byFood ?? [],
      });
    }
    for (const item of allocatedItems) {
      const id = String(item.ingredientId);
      if (map.has(id)) continue;
      map.set(id, {
        id,
        name: item.ingredientName ?? 'Unnamed ingredient',
        unit: item.unit ?? null,
        shelfQty: 0,
        minimum: 0,
        allocatedQty: Number(item.allocated ?? 0),
        byFood: item.byFood ?? [],
      });
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        Number(b.allocatedQty ?? 0) - Number(a.allocatedQty ?? 0) ||
        a.name.localeCompare(b.name),
    );
  }, [shelfRows, allocatedById, allocatedItems]);

  const allocatedCount = rows.filter((r) => r.allocatedQty > 0).length;
  const lowStockCount = rows.filter(
    (r) => r.minimum > 0 && r.shelfQty <= r.minimum,
  ).length;
  const isLoading = inventoryQuery.isLoading || allocatedQuery.isLoading;
  const isFetching = inventoryQuery.isFetching || allocatedQuery.isFetching;

  const onRefresh = useCallback(() => {
    void inventoryQuery.refetch();
    void allocatedQuery.refetch();
  }, [inventoryQuery, allocatedQuery]);

  const summaryDirection: 'row' | 'column' = isCompact ? 'column' : 'row';
  const summaryItemBase = isCompact ? undefined : '30%';

  return (
    <AppScreen
      title="Store inventory"
      subtitle="Stock at your assigned store, updated live."
      onRefresh={onRefresh}
      refreshing={isFetching}
    >
      <Card>
        <View style={[styles.summaryRow, { flexDirection: summaryDirection, gap: s(8) }]}>
          <View style={summaryItemBase ? { flexBasis: summaryItemBase, flexGrow: 1 } : undefined}>
            <Text style={[styles.summaryLabel, { fontSize: s(10) }]} numberOfLines={1}>
              Allocated today
            </Text>
            <Text style={[styles.summaryValue, { fontSize: s(22), marginTop: 2 }]}>{allocatedCount}</Text>
          </View>
          <View style={summaryItemBase ? { flexBasis: summaryItemBase, flexGrow: 1 } : undefined}>
            <Text style={[styles.summaryLabel, { fontSize: s(10) }]} numberOfLines={1}>
              Ingredients
            </Text>
            <Text style={[styles.summaryValue, { fontSize: s(22), marginTop: 2 }]}>{rows.length}</Text>
          </View>
          <View style={summaryItemBase ? { flexBasis: summaryItemBase, flexGrow: 1 } : undefined}>
            <Text style={[styles.summaryLabel, { fontSize: s(10) }]} numberOfLines={1}>
              Low stock
            </Text>
            <Text
              style={[
                styles.summaryValue,
                { fontSize: s(22), marginTop: 2 },
                lowStockCount > 0 ? styles.warn : null,
              ]}
            >
              {lowStockCount}
            </Text>
          </View>
        </View>
        {lowStockCount > 0 ? (
          <View style={{ marginTop: 4 }}>
            <StatusChip tone="amber" label={`${lowStockCount} ingredient(s) at or below threshold`} />
          </View>
        ) : null}
      </Card>

      <PrimaryButton
        label="Today's allocation"
        caption="See what was allocated today, what you've used, what's left."
        variant="soft"
        onPress={onOpenTodaysAllocation ?? (() => undefined)}
      />

      {isLoading ? (
        <Card>
          <Text style={[styles.loading, { fontSize: s(12) }]}>Loading inventory…</Text>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <Text style={[styles.title, { fontSize: s(15) }]}>No stock at this store yet</Text>
          <Text style={[styles.body, { fontSize: s(12) }]}>
            Ask your manager to allocate ingredients to your store, or transfer stock from the master pool.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: s(10) }}>
          {rows.map((row) => (
            <IngredientRow key={row.id} row={row} />
          ))}
        </View>
      )}
    </AppScreen>
  );
}

interface ShelfRowView {
  id: string;
  name: string;
  unit: string | null;
  shelfQty: number;
  minimum: number;
  allocatedQty: number;
  byFood: AllocatedIngredientItem['byFood'];
}

function IngredientRow({ row }: { row: ShelfRowView }): JSX.Element {
  const { width, isCompact } = useSizeClass();
  const s = (n: number) => scaleValue(n, width);
  const min = Number(row.minimum ?? 0);
  const shelf = Number(row.shelfQty ?? 0);
  const allocated = Number(row.allocatedQty ?? 0);
  const isLow = min > 0 && shelf <= min;
  const isEmpty = shelf <= 0 && allocated <= 0;
  const accent = allocated <= 0 ? 'red' : isLow ? 'yellow' : 'green';

  const statDirection: 'row' | 'column' = isCompact ? 'column' : 'row';

  return (
    <Card accent={accent}>
      <View style={[styles.rowHeader, { gap: 10 }]}>
        <Text style={[styles.rowTitle, { fontSize: s(15) }]} numberOfLines={2}>
          {row.name}
        </Text>
        {allocated <= 0 ? (
          <StatusChip tone="amber" label="NOT ALLOCATED" />
        ) : isLow ? (
          <StatusChip tone="amber" label="LOW" />
        ) : (
          <StatusChip tone="green" label="ALLOCATED" />
        )}
      </View>
      <View
        style={[
          styles.rowStats,
          {
            flexDirection: statDirection,
            gap: s(8),
            marginTop: s(6),
          },
        ]}
      >
        <View style={!isCompact ? { flex: 1 } : undefined}>
          <Text style={[styles.statLabel, { fontSize: s(10) }]}>Allocated today</Text>
          <Text
            style={[
              styles.statValue,
              { fontSize: s(16), marginTop: 2 },
              allocated > 0 ? styles.statValueAccent : styles.mutedText,
            ]}
            numberOfLines={1}
          >
            {allocated.toFixed(2)} {row.unit ?? ''}
          </Text>
        </View>
        <View style={!isCompact ? { flex: 1 } : undefined}>
          <Text style={[styles.statLabel, { fontSize: s(10) }]}>On shelf</Text>
          <Text style={[styles.statValue, { fontSize: s(16), marginTop: 2 }]} numberOfLines={1}>
            {shelf.toFixed(2)} {row.unit ?? ''}
          </Text>
        </View>
        <View style={!isCompact ? { flex: 1 } : undefined}>
          <Text style={[styles.statLabel, { fontSize: s(10) }]}>Minimum</Text>
          <Text style={[styles.statValue, { fontSize: s(16), marginTop: 2 }]} numberOfLines={1}>
            {min > 0 ? `${min.toFixed(2)} ${row.unit ?? ''}` : '—'}
          </Text>
        </View>
      </View>
      {row.byFood && row.byFood.length > 0 ? (
        <View style={[styles.breakdown, { marginTop: s(8), paddingTop: s(6) }]}>
          {row.byFood.map((bf, idx) => (
            <Text
              key={`${bf.foodItemId}-${idx}`}
              style={[styles.breakdownLine, { fontSize: s(11) }]}
              numberOfLines={2}
            >
              · {bf.foodName ?? 'Item'} → {Number(bf.quantity ?? 0).toFixed(2)} {row.unit ?? ''}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  summaryRow: { justifyContent: 'space-between' },
  summaryLabel: { fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryValue: { fontWeight: '900', color: colors.text },
  warn: { color: colors.danger },
  loading: { color: colors.muted, fontWeight: '600' },
  title: { fontWeight: '800', color: colors.text },
  body: { color: colors.muted, lineHeight: 20 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontWeight: '800', color: colors.text, flex: 1 },
  rowStats: { justifyContent: 'space-between' },
  statLabel: { fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  statValue: { fontWeight: '900', color: colors.text },
  statValueAccent: { color: colors.accent },
  mutedText: { color: colors.muted },
  breakdown: { borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  breakdownLine: { color: colors.muted, lineHeight: 18 },
});