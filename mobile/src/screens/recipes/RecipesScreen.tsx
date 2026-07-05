import { useCallback, useState } from 'react';
import { Text, View, StyleSheet, TextInput, FlatList, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { PrimaryButton } from '@/components/PrimaryButton';
import { listRecipes, getRecipe, type Recipe } from '@/api/endpoints/recipes';
import { colors } from '@/lib/colors';

export function RecipesScreen(): JSX.Element {
  const recipesQuery = useQuery({
    queryKey: ['recipes', 'all'],
    queryFn: listRecipes,
    staleTime: 5 * 60_000,
  });
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const items = (recipesQuery.data ?? []).filter((r) =>
    (r.name ?? '').toLowerCase().includes(search.toLowerCase()),
  );
  const open = items.find((r) => r.id === openId) ?? null;

  const onRefresh = useCallback(() => {
    void recipesQuery.refetch();
  }, [recipesQuery]);

  return (
    <AppScreen
      title="Recipes"
      subtitle="Read-only recipe reference for prep."
      onRefresh={onRefresh}
      refreshing={recipesQuery.isFetching}
    >
      <View style={styles.searchBar}>
        <Text style={styles.searchLabel}>Search</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Find a recipe…"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>

      {recipesQuery.isLoading ? (
        <Card>
          <Text style={styles.loading}>Loading recipes…</Text>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <Text style={styles.title}>No recipes available</Text>
          <Text style={styles.body}>
            Ask your admin to link recipes to your store's menu items.
          </Text>
        </Card>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={items}
          keyExtractor={(r) => r.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => setOpenId(item.id === openId ? null : item.id)}>
              <Card>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowCount}>{item.ingredients.length} ingredients</Text>
                </View>
                {item.description ? <Text style={styles.body}>{item.description}</Text> : null}
                {open?.id === item.id ? <RecipeDetail recipe={item} /> : null}
              </Card>
            </Pressable>
          )}
        />
      )}
    </AppScreen>
  );
}

function RecipeDetail({ recipe }: { recipe: Recipe }): JSX.Element {
  // Refresh the detail with the canonical recipe endpoint on first open
  const detailQuery = useQuery({
    queryKey: ['recipe', recipe.id],
    queryFn: () => getRecipe(recipe.id),
    enabled: Boolean(recipe.id),
    staleTime: 5 * 60_000,
  });
  const full = detailQuery.data ?? recipe;
  const steps = (full.preparationSteps ?? []).filter((s) => s.trim().length > 0);

  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      {full.servingSize ? (
        <Text style={styles.metaText}>Serving size: {full.servingSize}</Text>
      ) : null}
      <View>
        <Text style={styles.sectionLabel}>Ingredients</Text>
        {full.ingredients.length === 0 ? (
          <Text style={styles.body}>No ingredients listed.</Text>
        ) : (
          full.ingredients.map((ing, idx) => (
            <Text key={`${ing.ingredientId}-${idx}`} style={styles.listItem}>
              • {Number(ing.quantity).toFixed(2)}
              {ing.unit ? ` ${ing.unit}` : ''} — {ing.ingredientName ?? ing.ingredientId}
            </Text>
          ))
        )}
      </View>
      {steps.length > 0 ? (
        <View>
          <Text style={styles.sectionLabel}>Preparation</Text>
          {steps.map((step, idx) => (
            <Text key={idx} style={styles.body}>
              {idx + 1}. {step}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: { gap: 6 },
  searchLabel: { fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  searchInput: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  loading: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  body: { fontSize: 13, color: colors.text, lineHeight: 20 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitle: { fontSize: 16, fontWeight: '800', color: colors.text, flex: 1 },
  rowCount: { fontSize: 12, color: colors.muted, fontWeight: '700' },
  metaText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  listItem: { fontSize: 13, color: colors.text, lineHeight: 22 },
});