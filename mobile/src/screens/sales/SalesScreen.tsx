import { useCallback, useState } from 'react';
import { Text, View, StyleSheet, Modal, Pressable, TextInput, FlatList } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StatusChip } from '@/components/StatusChip';
import { BigButton } from '@/components/BigButton';
import { useAuth } from '@/context/AuthContext';
import {
  listSales,
  recordSale,
  type CreateSaleRequest,
  type Sale,
} from '@/api/endpoints/sales';
import { listFood, type FoodItem } from '@/api/endpoints/food';
import { ApiException } from '@/types/api';
import { colors } from '@/lib/colors';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function SalesScreen(): JSX.Element {
  const { user } = useAuth();
  const qc = useQueryClient();
  const storeId = user?.assignedStore ?? '';
  const [composerOpen, setComposerOpen] = useState(false);

  const salesQuery = useQuery({
    queryKey: ['sales', 'store', storeId],
    queryFn: () => listSales(storeId || undefined),
    enabled: Boolean(storeId),
  });

  const today = todayIso();
  const todays = (salesQuery.data ?? []).filter((s) => {
    if (!s.createdAt) return false;
    try {
      return new Date(s.createdAt).toISOString().slice(0, 10) === today;
    } catch {
      return false;
    }
  });

  const onRefresh = useCallback(() => {
    void salesQuery.refetch();
  }, [salesQuery]);

  return (
    <AppScreen
      title="Sales"
      subtitle={`${todays.length} sale(s) today`}
      onRefresh={onRefresh}
      refreshing={salesQuery.isFetching}
    >
      <BigButton
        label="+ New sale"
        caption="Tap to record one or many units of a food item"
        onPress={() => setComposerOpen(true)}
      />

      {salesQuery.isLoading ? (
        <Card>
          <Text style={styles.loading}>Loading today's sales…</Text>
        </Card>
      ) : todays.length === 0 ? (
        <Card>
          <Text style={styles.title}>No sales yet today</Text>
          <Text style={styles.body}>
            Tap “New sale” to record one. Stock deducts automatically.
          </Text>
        </Card>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={todays}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => <SaleRow sale={item} />}
        />
      )}

      <SaleComposer
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        storeId={storeId}
        onSubmitted={() => {
          qc.invalidateQueries({ queryKey: ['sales'] });
          qc.invalidateQueries({ queryKey: ['store-inventory'] });
          setComposerOpen(false);
        }}
      />
    </AppScreen>
  );
}

function SaleRow({ sale }: { sale: Sale }): JSX.Element {
  const profit = Number(sale.profit ?? 0);
  return (
    <Card>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{sale.foodName}</Text>
        <Text style={styles.rowPrice}>${Number(sale.totalPrice ?? 0).toFixed(2)}</Text>
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.metaText}>×{sale.quantity} · {sale.channel} · {fmtTime(sale.createdAt)}</Text>
        <StatusChip label={profit >= 0 ? `+$${profit.toFixed(2)} profit` : `-$${Math.abs(profit).toFixed(2)}`} tone={profit >= 0 ? 'green' : 'red'} />
      </View>
    </Card>
  );
}

interface SaleComposerProps {
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  storeId: string;
}

function SaleComposer({ visible, onClose, onSubmitted, storeId }: SaleComposerProps): JSX.Element {
  const foodQuery = useQuery({
    queryKey: ['food', 'all'],
    queryFn: listFood,
  });

  const items = (foodQuery.data ?? []).filter((f) => (f.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE');
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: CreateSaleRequest) => recordSale(input),
    onSuccess: () => {
      setSelected(null);
      setQuantity(1);
      onSubmitted();
    },
  });

  function submit(): void {
    if (!selected || !storeId) {
      setError('Pick a food item and ensure you are assigned to a store.');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity must be at least 1.');
      return;
    }
    setError(null);
    mutation.mutate({
      storeId,
      foodItemId: selected.id,
      quantity,
      channel: 'POS',
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>New sale</Text>
          <Text style={styles.sheetSubtitle}>Pick the food, set quantity, submit.</Text>

          {foodQuery.isLoading ? (
            <Text style={styles.loading}>Loading menu…</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(f) => f.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 10 }}
              contentContainerStyle={{ gap: 10 }}
              style={{ maxHeight: 280 }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelected(item)}
                  style={[
                    styles.foodCard,
                    selected?.id === item.id ? styles.foodCardSelected : null,
                  ]}
                >
                  <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.foodPrice}>${Number(item.price ?? 0).toFixed(2)}</Text>
                </Pressable>
              )}
            />
          )}

          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.qtyControls}>
              <Pressable
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </Pressable>
              <TextInput
                value={String(quantity)}
                onChangeText={(v) => {
                  const n = Number(v.replace(/[^0-9]/g, '') || 1);
                  setQuantity(Math.max(1, n));
                }}
                keyboardType="number-pad"
                style={styles.qtyInput}
              />
              <Pressable
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => q + 1)}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </Pressable>
            </View>
          </View>

          {selected ? (
            <Text style={styles.totalLine}>
              {quantity} × {selected.name} = ${(quantity * Number(selected.price ?? 0)).toFixed(2)}
            </Text>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {mutation.error instanceof ApiException ? (
            <Text style={styles.error}>{mutation.error.message}</Text>
          ) : null}

          <View style={styles.sheetActions}>
            <PrimaryButton label="Cancel" variant="outline" onPress={onClose} />
            <PrimaryButton
              label={mutation.isPending ? 'Submitting…' : 'Record sale'}
              onPress={submit}
              disabled={mutation.isPending || !selected}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loading: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: colors.text, flex: 1 },
  rowPrice: { fontSize: 16, fontWeight: '900', color: colors.text },
  rowMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  metaText: { fontSize: 12, color: colors.muted, fontWeight: '600' },

  // Sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    padding: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 12,
    borderTopWidth: 3,
    borderColor: colors.borderStrong,
  },
  sheetTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  sheetSubtitle: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  foodCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 4,
  },
  foodCardSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  foodName: { fontSize: 14, fontWeight: '800', color: colors.text },
  foodPrice: { fontSize: 14, fontWeight: '900', color: colors.text },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  qtyLabel: { fontSize: 13, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 22, fontWeight: '900', color: colors.text },
  qtyInput: {
    minWidth: 60,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 6,
    backgroundColor: colors.background,
  },
  totalLine: { fontSize: 14, color: colors.text, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});