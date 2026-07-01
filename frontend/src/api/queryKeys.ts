export const authKeys = {
  me: ['auth', 'me'] as const,
};

export const dashboardKeys = {
  overview: ['dashboard', 'overview'] as const,
};

export const storeKeys = {
  list: (filters: Record<string, string | number | boolean | null | undefined> = {}) => ['stores', 'list', filters] as const,
  detail: (id: string) => ['stores', 'detail', id] as const,
};

export const inventoryKeys = {
  list: (filters: Record<string, string | number | boolean | null | undefined> = {}) => ['inventory', 'ingredients', filters] as const,
  detail: (id: string) => ['inventory', 'ingredient', id] as const,
};

export const recipeKeys = {
  list: (filters: Record<string, string | number | boolean | null | undefined> = {}) => ['recipes', 'list', filters] as const,
  detail: (id: string) => ['recipes', 'detail', id] as const,
};

export const foodKeys = {
  list: (filters: Record<string, string | number | boolean | null | undefined> = {}) => ['food', 'list', filters] as const,
};
