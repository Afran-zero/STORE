import { useCallback } from 'react';
import { Text, View, StyleSheet, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatusChip } from '@/components/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { getStoreInventory, type StoreInventoryRow } from '@/api/endpoints/storeInventory';
import { colors } from '@/lib/colors';

interface InventoryScreenProps {
  onOpenTodaysAllocation?: () => void;
}

export function InventoryScreen({ onOpenTodaysAllocation }: InventoryScreenProps = {}): JSX.Element {
  const { user } = useAuth();
  const storeId = user?.assignedStore ?? '';

  const inventoryQuery = useQuery({
    queryKey: ['store-inventory', storeId],
    queryFn: () => getStoreInventory(storeId),
    enabled: Boolean(storeId),
  });

  const rows = inventoryQuery.data ?? [];

  const lowStockCount = rows.filter(
    (r) => Number(r.minimumStock ?? 0) > 0 && Number(r.quantity ?? 0) <= Number(r.minimumStock ?? 0),
  ).length;

  const onRefresh = useCallback(() => {
    void inventoryQuery.refetch();
  }, [inventoryQuery]);

  return (
    <AppScreen
      title="Store inventory"
      subtitle="Stock at your assigned store, updated live."
      onRefresh={onRefresh}
      refreshing={inventoryQuery.isFetching}
    >
      <Card>
        <View style={styles.summaryRow}>
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

      {inventoryQuery.isLoading ? (
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
        rows.map((row) => <IngredientRow key={`${row.storeId}-${row.ingredientId}`} row={row} />)
      )}
    </AppScreen>
  );
}

function IngredientRow({ row }: { row: StoreInventoryRow }): JSX.Element {
  const min = Number(row.minimumStock ?? 0);
  const qty = Number(row.quantity ?? 0);
  const isLow = min > 0 && qty <= min;
  const isEmpty = qty <= 0;
  return (
    <Card accent={isEmpty ? 'red' : isLow ? 'red' : 'yellow'}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{row.ingredientName ?? row.ingredientId}</Text>
        {isLow ? <StatusChip tone="amber" label={isEmpty ? 'EMPTY' : 'LOW'} /> : <StatusChip tone="green" label="OK" />}
      </View>
      <View style={styles.rowStats}>
        <View>
          <Text style={styles.statLabel}>In store</Text>
          <Text style={styles.statValue}>{qty.toFixed(2)} {row.unit ?? ''}</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Minimum</Text>
          <Text style={styles.statValue}>{min > 0 ? `${min.toFixed(2)} ${row.unit ?? ''}` : '—'}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryValue: { fontSize: 32, fontWeight: '900', color: colors.text, marginTop: 4 },
  warn: { color: colors.danger },
  loading: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitle: { fontSize: 16, fontWeight: '800', color: colors.text, flex: 1 },
  rowStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  statLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  statValue: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 2 },
});