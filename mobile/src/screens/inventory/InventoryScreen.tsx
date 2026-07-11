import { memo, useCallback } from 'react';
import { FlatList, ListRenderItem, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatusChip } from '@/components/StatusChip';
import { Metric } from '@/components/Section';
import { useAuth } from '@/context/AuthContext';
import { getStoreInventory, type StoreInventoryRow } from '@/api/endpoints/storeInventory';
import { colors } from '@/lib/colors';
import { AppText } from '@/lib/typography';

interface InventoryScreenProps {
  onOpenTodaysAllocation?: () => void;
}

const IngredientRow = memo(function IngredientRow({
  row,
}: {
  row: StoreInventoryRow;
}): JSX.Element {
  const min = Number(row.minimumStock ?? 0);
  const qty = Number(row.quantity ?? 0);
  const low = min > 0 && qty <= min;
  const empty = qty <= 0;
  return (
    <Card>
      <View style={styles.rowSpread}>
        <AppText variant="heading" style={styles.rowTitle} numberOfLines={1}>
          {row.ingredientName ?? row.ingredientId}
        </AppText>
        <StatusChip tone={low || empty ? 'accent' : 'solid'} label={empty ? 'EMPTY' : low ? 'LOW' : 'OK'} />
      </View>
      <View style={styles.rowSpread}>
        <View>
          <AppText variant="overline" faint>In store</AppText>
          <AppText variant="heading">{qty.toFixed(2)} {row.unit ?? ''}</AppText>
        </View>
        <View>
          <AppText variant="overline" faint>Minimum</AppText>
          <AppText variant="heading">{min > 0 ? `${min.toFixed(2)} ${row.unit ?? ''}` : '—'}</AppText>
        </View>
      </View>
    </Card>
  );
});

function InventoryScreenImpl({
  onOpenTodaysAllocation,
}: InventoryScreenProps = {}): JSX.Element {
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

  const renderRow: ListRenderItem<StoreInventoryRow> = useCallback(
    ({ item }) => <IngredientRow row={item} />,
    [],
  );
  const keyExtractor = useCallback(
    (row: StoreInventoryRow) => `${row.storeId}-${row.ingredientId}`,
    [],
  );
  const separator = useCallback(() => <View style={styles.sep12} />, []);

  return (
    <AppScreen
      title="Store inventory"
      subtitle="Stock at your assigned store, updated live."
      onRefresh={onRefresh}
      refreshing={inventoryQuery.isFetching}
    >
      <Card>
        <View style={styles.rowSpread}>
          <Metric label="Ingredients" value={String(rows.length)} />
          <Metric label="Low stock" value={String(lowStockCount)} />
        </View>
        {lowStockCount > 0 ? (
          <StatusChip
            tone="accent"
            label={`${lowStockCount} ingredient(s) at or below threshold`}
          />
        ) : null}
      </Card>

      <PrimaryButton
        label="Today's allocation"
        caption="See what was allocated today, what you've used, what's left."
        onPress={onOpenTodaysAllocation ?? (() => undefined)}
      />

      {inventoryQuery.isLoading ? (
        <Card>
          <AppText variant="caption">Loading inventory…</AppText>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <AppText variant="heading">No stock at this store yet</AppText>
          <AppText variant="body" faint>
            Ask your manager to allocate ingredients to your store, or transfer stock from the master pool.
          </AppText>
        </Card>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={keyExtractor}
          renderItem={renderRow}
          ItemSeparatorComponent={separator}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          scrollEnabled={false}
        />
      )}
    </AppScreen>
  );
}

export const InventoryScreen = memo(InventoryScreenImpl);

const styles = StyleSheet.create({
  rowSpread: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowTitle: { flex: 1 },
  sep12: { height: 12 },
});
