import { useCallback, useMemo } from 'react';
import { Text, View, StyleSheet, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatusChip } from '@/components/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { getStoreInventory, type StoreInventoryRow } from '@/api/endpoints/storeInventory';
import { getStoreAllocatedIngredients, type AllocatedIngredientItem } from '@/api/endpoints/allocations';
import { colors } from '@/lib/colors';

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

  const inventoryQuery = useQuery({
    queryKey: ['store-inventory', storeId],
    queryFn: () => getStoreInventory(storeId),
    enabled: Boolean(storeId),
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
  });

  const shelfRows = inventoryQuery.data ?? [];
  const allocatedItems = allocatedQuery.data?.items ?? [];

  // Build a per-ingredient map of today's allocation quantities.
  const allocatedById = useMemo(() => {
    const map = new Map<string, AllocatedIngredientItem>();
    for (const item of allocatedItems) {
      map.set(String(item.ingredientId), item);
    }
    return map;
  }, [allocatedItems]);

  // Merge shelf rows with allocated quantities (allocated is the headline number
  // the worker cares about; shelf row is the secondary view).
  const rows = useMemo(() => {
    const map = new Map<string, ShelfRowView>();
    for (const row of shelfRows) {
      const id = String(row.ingredientId);
      const allocated = allocatedById.get(id);
      map.set(id, {
        id,
        name: row.ingredientName ?? row.ingredientId,
        unit: row.unit ?? allocated?.unit ?? null,
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
        name: item.ingredientName ?? id,
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

  return (
    <AppScreen
      title="Store inventory"
      subtitle="Stock at your assigned store, updated live."
      onRefresh={onRefresh}
      refreshing={isFetching}
    >
      <Card>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Allocated today</Text>
            <Text style={styles.summaryValue}>{allocatedCount}</Text>
          </View>
          <View>
            <Text style={styles.summaryLabel}>Ingredients</Text>
            <Text style={styles.summaryValue}>{rows.length}</Text>
          </View>
          <View>
            <Text style={styles.summaryLabel}>Low stock</Text>
            <Text style={[styles.summaryValue, lowStockCount > 0 ? styles.warn : null]}>{lowStockCount}</Text>
          </View>
        </View>
        {lowStockCount > 0 ? (
          <StatusChip tone="amber" label={`${lowStockCount} ingredient(s) at or below threshold`} />
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
          <Text style={styles.loading}>Loading inventory…</Text>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <Text style={styles.title}>No stock at this store yet</Text>
          <Text style={styles.body}>
            Ask your manager to allocate ingredients to your store, or transfer stock from the master pool.
          </Text>
        </Card>
      ) : (
        rows.map((row) => (
          <IngredientRow
            key={row.id}
            row={row}
          />
        ))
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
  const min = Number(row.minimum ?? 0);
  const shelf = Number(row.shelfQty ?? 0);
  const allocated = Number(row.allocatedQty ?? 0);
  const isLow = min > 0 && shelf <= min;
  const isEmpty = shelf <= 0 && allocated <= 0;
  const accent = allocated <= 0 ? 'red' : isLow ? 'yellow' : 'green';
  return (
    <Card accent={accent}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{row.name}</Text>
        {allocated <= 0 ? (
          <StatusChip tone="amber" label="NOT ALLOCATED" />
        ) : isLow ? (
          <StatusChip tone="amber" label="LOW" />
        ) : (
          <StatusChip tone="green" label="ALLOCATED" />
        )}
      </View>
      <View style={styles.rowStats}>
        <View>
          <Text style={styles.statLabel}>Allocated today</Text>
          <Text style={[styles.statValue, allocated > 0 ? styles.statValueAccent : styles.mutedText]}>
            {allocated.toFixed(2)} {row.unit ?? ''}
          </Text>
        </View>
        <View>
          <Text style={styles.statLabel}>On shelf</Text>
          <Text style={styles.statValue}>{shelf.toFixed(2)} {row.unit ?? ''}</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Minimum</Text>
          <Text style={styles.statValue}>{min > 0 ? `${min.toFixed(2)} ${row.unit ?? ''}` : '—'}</Text>
        </View>
      </View>
      {row.byFood && row.byFood.length > 0 ? (
        <View style={styles.breakdown}>
          {row.byFood.map((bf, idx) => (
            <Text key={`${bf.foodItemId}-${idx}`} style={styles.breakdownLine}>
              · {bf.foodName ?? 'Item'} → {Number(bf.quantity ?? 0).toFixed(2)} {row.unit ?? ''}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryValue: { fontSize: 26, fontWeight: '900', color: colors.text, marginTop: 4 },
  warn: { color: colors.danger },
  loading: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitle: { fontSize: 16, fontWeight: '800', color: colors.text, flex: 1 },
  rowStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 12 },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 2 },
  statValueAccent: { color: colors.accent },
  mutedText: { color: colors.muted },
  breakdown: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border ?? '#e5e7eb' },
  breakdownLine: { fontSize: 12, color: colors.muted, lineHeight: 18 },
});