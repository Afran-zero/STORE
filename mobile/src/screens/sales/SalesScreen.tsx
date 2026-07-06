import { useCallback, useState } from 'react';
import { Text, View, StyleSheet, Modal, Pressable, TextInput, FlatList, useWindowDimensions, ScrollView } from 'react-native';
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
import { scaleValue, useSizeClass } from '@/lib/responsive';

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
        <View style={{ gap: 10 }}>
          {todays.map((s) => (
            <SaleRow key={s.id} sale={s} />
          ))}
        </View>
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
  const { width } = useWindowDimensions();
  const s = (n: number) => scaleValue(n, width);
  const profit = Number(sale.profit ?? 0);
  return (
    <Card>
      <View style={[styles.rowHeader, { gap: 10 }]}>
        <Text style={[styles.rowTitle, { fontSize: s(14) }]} numberOfLines={2}>
          {sale.foodName}
        </Text>
        <Text style={[styles.rowPrice, { fontSize: s(15) }]} numberOfLines={1}>
          ${Number(sale.totalPrice ?? 0).toFixed(2)}
        </Text>
      </View>
      <View style={[styles.rowMeta, { gap: 8, flexWrap: 'wrap', marginTop: 4 }]}>
        <Text style={[styles.metaText, { fontSize: s(11) }]} numberOfLines={1}>
          ×{sale.quantity} · {sale.channel} · {fmtTime(sale.createdAt)}
        </Text>
        <StatusChip
          label={
            profit >= 0
              ? `+$${profit.toFixed(2)} profit`
              : `-$${Math.abs(profit).toFixed(2)}`
          }
          tone={profit >= 0 ? 'green' : 'red'}
        />
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
  const { width, isCompact, isTablet } = useSizeClass();
  const s = (n: number) => scaleValue(n, width);
  const sheetPad = s(16);
  const sheetBottom = s(28);
  const sheetRadius = s(24);
  const sheetGap = s(12);
  const sheetTitleSize = s(20);

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

  const foodColumns = isCompact ? 1 : isTablet ? 3 : 2;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View
          style={[
            styles.sheet,
            {
              padding: sheetPad,
              paddingBottom: sheetBottom,
              borderTopLeftRadius: sheetRadius,
              borderTopRightRadius: sheetRadius,
              borderTopWidth: 3,
              gap: sheetGap,
              maxHeight: '92%',
            },
          ]}
        >
          <Text style={[styles.sheetTitle, { fontSize: sheetTitleSize }]} numberOfLines={2}>
            New sale
          </Text>
          <Text style={[styles.sheetSubtitle, { fontSize: s(12) }]} numberOfLines={2}>
            Pick the food, set quantity, submit.
          </Text>

          {foodQuery.isLoading ? (
            <Text style={[styles.loading, { fontSize: s(12) }]}>Loading menu…</Text>
          ) : (
            <ScrollView
              style={{ maxHeight: s(280) }}
              contentContainerStyle={{ gap: s(8) }}
              showsVerticalScrollIndicator={false}
            >
              {chunkFood(items, foodColumns).map((row, rowIdx) => (
                <View key={rowIdx} style={{ flexDirection: 'row', gap: s(8) }}>
                  {row.map((item) => {
                    const isSelected = selected?.id === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setSelected(item)}
                        style={[
                          styles.foodCard,
                          {
                            padding: s(12),
                            borderRadius: s(14),
                            flex: 1,
                            gap: 2,
                          },
                          isSelected ? styles.foodCardSelected : null,
                        ]}
                      >
                        <Text
                          style={[styles.foodName, { fontSize: s(13) }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text
                          style={[styles.foodPrice, { fontSize: s(13) }]}
                          numberOfLines={1}
                        >
                          ${Number(item.price ?? 0).toFixed(2)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {row.length < foodColumns
                    ? Array.from({ length: foodColumns - row.length }).map((_, i) => (
                        <View key={`pad-${i}`} style={{ flex: 1 }} />
                      ))
                    : null}
                </View>
              ))}
            </ScrollView>
          )}

          <View style={[styles.qtyRow, { marginTop: s(4) }]}>
            <Text style={[styles.qtyLabel, { fontSize: s(11) }]}>Quantity</Text>
            <View style={[styles.qtyControls, { gap: s(8) }]}>
              <Pressable
                style={[
                  styles.qtyBtn,
                  { width: s(40), height: s(40), borderRadius: s(12) },
                ]}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Text style={[styles.qtyBtnText, { fontSize: s(18) }]}>−</Text>
              </Pressable>
              <TextInput
                value={String(quantity)}
                onChangeText={(v) => {
                  const n = Number(v.replace(/[^0-9]/g, '') || 1);
                  setQuantity(Math.max(1, n));
                }}
                keyboardType="number-pad"
                style={[
                  styles.qtyInput,
                  {
                    minWidth: s(56),
                    fontSize: s(16),
                    borderRadius: s(10),
                    paddingVertical: s(4),
                  },
                ]}
              />
              <Pressable
                style={[
                  styles.qtyBtn,
                  { width: s(40), height: s(40), borderRadius: s(12) },
                ]}
                onPress={() => setQuantity((q) => q + 1)}
              >
                <Text style={[styles.qtyBtnText, { fontSize: s(18) }]}>+</Text>
              </Pressable>
            </View>
          </View>

          {selected ? (
            <Text style={[styles.totalLine, { fontSize: s(13) }]} numberOfLines={2}>
              {quantity} × {selected.name} = ${(quantity * Number(selected.price ?? 0)).toFixed(2)}
            </Text>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {mutation.error instanceof ApiException ? (
            <Text style={styles.error}>{mutation.error.message}</Text>
          ) : null}

          <View style={[styles.sheetActions, { gap: s(10), marginTop: s(4) }]}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Cancel" variant="outline" onPress={onClose} />
            </View>
            <View style={{ flex: 1.8 }}>
              <PrimaryButton
                label={mutation.isPending ? 'Submitting…' : 'Record sale'}
                onPress={submit}
                disabled={mutation.isPending || !selected}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Split an array into fixed-size rows so we render a variable number of
 * columns in the food picker without using FlatList (which complicates the
 * multi-column-with-padded-trailing-cell layout).
 */
function chunkFood<T>(items: T[], cols: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return rows;
}

const styles = StyleSheet.create({
  loading: { color: colors.muted, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { color: colors.muted, lineHeight: 20 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontWeight: '800', color: colors.text, flex: 1 },
  rowPrice: { fontWeight: '900', color: colors.text },
  rowMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaText: { color: colors.muted, fontWeight: '600' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderColor: colors.borderStrong,
  },
  sheetTitle: { fontWeight: '900', color: colors.text },
  sheetSubtitle: { color: colors.muted, fontWeight: '600' },
  sheetActions: { flexDirection: 'row' },
  foodCard: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  foodCardSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  foodName: { fontWeight: '800', color: colors.text },
  foodPrice: { fontWeight: '900', color: colors.text },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyLabel: { fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  qtyControls: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: {
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: { fontWeight: '900', color: colors.text },
  qtyInput: {
    textAlign: 'center',
    fontWeight: '900',
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  totalLine: { color: colors.text, fontWeight: '800' },
  error: { color: colors.danger, fontSize: 13, fontWeight: '700' },
});