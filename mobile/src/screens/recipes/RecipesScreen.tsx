import { useCallback, useState } from 'react';
import { Text, View, StyleSheet, TextInput, FlatList, Pressable, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/Card';
import { listRecipes, getRecipe, type Recipe } from '@/api/endpoints/recipes';
import { colors } from '@/lib/colors';
import { scaleValue } from '@/lib/responsive';

export function RecipesScreen(): JSX.Element {
  const { width } = useWindowDimensions();
  const s = (n: number) => scaleValue(n, width);
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
      <View style={[styles.searchBar, { gap: s(6) }]}>
        <Text style={[styles.searchLabel, { fontSize: s(12) }]} numberOfLines={1}>
          Search
        </Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Find a recipe…"
          placeholderTextColor={colors.muted}
          style={[
            styles.searchInput,
            {
              borderRadius: s(16),
              paddingHorizontal: s(14),
              paddingVertical: s(12),
              fontSize: s(15),
            },
          ]}
        />
      </View>

      {recipesQuery.isLoading ? (
        <Card>
          <Text style={[styles.loading, { fontSize: s(13) }]}>Loading recipes…</Text>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <Text style={[styles.title, { fontSize: s(16) }]} numberOfLines={2}>
            No recipes available
          </Text>
          <Text style={[styles.body, { fontSize: s(13), lineHeight: s(20) }]} numberOfLines={3}>
            Ask your admin to link recipes to your store's menu items.
          </Text>
        </Card>
      ) : (
        <FlatList
          scrollEnabled={false}
          data={items}
          keyExtractor={(r) => r.id}
          ItemSeparatorComponent={() => <View style={{ height: s(10) }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => setOpenId(item.id === openId ? null : item.id)}>
              <Card>
                <View style={[styles.rowHeader, { gap: s(12) }]}>
                  <Text
                    style={[styles.rowTitle, { fontSize: s(16) }]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  <Text style={[styles.rowCount, { fontSize: s(12) }]} numberOfLines={1}>
                    {item.ingredients.length} ingredients
                  </Text>
                </View>
                {item.description ? (
                  <Text style={[styles.body, { fontSize: s(13), lineHeight: s(20) }]} numberOfLines={3}>
                    {item.description}
                  </Text>
                ) : null}
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
  const { width } = useWindowDimensions();
  const s = (n: number) => scaleValue(n, width);
  const detailQuery = useQuery({
    queryKey: ['recipe', recipe.id],
    queryFn: () => getRecipe(recipe.id),
    enabled: Boolean(recipe.id),
    staleTime: 5 * 60_000,
  });
  const full = detailQuery.data ?? recipe;
  const steps = (full.preparationSteps ?? []).filter((s) => s.trim().length > 0);

  return (
    <View style={{ gap: s(10), marginTop: s(8) }}>
      {full.servingSize ? (
        <Text style={[styles.metaText, { fontSize: s(12) }]} numberOfLines={2}>
          Serving size: {full.servingSize}
        </Text>
      ) : null}
      <View>
        <Text style={[styles.sectionLabel, { fontSize: s(12) }]} numberOfLines={1}>
          Ingredients
        </Text>
        {full.ingredients.length === 0 ? (
          <Text style={[styles.body, { fontSize: s(13) }]} numberOfLines={2}>
            No ingredients listed.
          </Text>
        ) : (
          full.ingredients.map((ing, idx) => (
            <Text
              key={`${ing.ingredientId}-${idx}`}
              style={[styles.listItem, { fontSize: s(13), lineHeight: s(22) }]}
              numberOfLines={3}
            >
              • {Number(ing.quantity).toFixed(2)}
              {ing.unit ? ` ${ing.unit}` : ''} — {ing.ingredientName ?? ing.ingredientId}
            </Text>
          ))
        )}
      </View>
      {steps.length > 0 ? (
        <View>
          <Text style={[styles.sectionLabel, { fontSize: s(12) }]} numberOfLines={1}>
            Preparation
          </Text>
          {steps.map((step, idx) => (
            <Text
              key={idx}
              style={[styles.body, { fontSize: s(13), lineHeight: s(20) }]}
              numberOfLines={6}
            >
              {idx + 1}. {step}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {},
  searchLabel: { fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  searchInput: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontWeight: '600',
  },
  loading: { color: colors.muted, fontWeight: '600' },
  title: { fontWeight: '800', color: colors.text },
  body: { color: colors.text },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { fontWeight: '800', color: colors.text, flex: 1 },
  rowCount: { color: colors.muted, fontWeight: '700' },
  metaText: { color: colors.muted, fontWeight: '600' },
  sectionLabel: { fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  listItem: { color: colors.text },
});