import { apiClient } from '@/api/client';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RevenueBucket {
  key: string;
  revenue: number;
  sales: number;
  quantity: number;
}

export interface RevenueResponse {
  groupBy: 'day' | 'week' | 'month' | 'store' | 'food';
  start: string;
  end: string;
  buckets: RevenueBucket[];
  total: { revenue: number; sales: number; quantity: number };
}

export interface ProfitByStore {
  storeId: string;
  storeName: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  sales: number;
}

export interface ProfitResponse {
  start: string;
  end: string;
  total: { revenue: number; cost: number; profit: number; marginPct: number; sales: number };
  byStore: ProfitByStore[];
}

export interface InventoryRow {
  ingredientId: string;
  name: string;
  category?: string;
  currentStock: number;
  unit?: string;
  costPerUnit: number;
  valuation: number;
}

export interface InventoryResponse {
  start: string;
  end: string;
  summary: {
    valuation: number;
    turnoverRatio: number;
    wastePct: number;
    ingredientCount: number;
  };
  byIngredient: InventoryRow[];
}

export interface EmployeeRanking {
  userId: string;
  name: string;
  email?: string;
  role?: string;
  assignedStore?: string;
  sales: number;
  revenue: number;
  quantity: number;
}

export interface EmployeesResponse {
  start: string;
  end: string;
  ranking: EmployeeRanking[];
  note?: string;
}

export interface StoreComparison {
  storeId: string;
  name: string;
  type?: string;
  status?: string;
  isActive?: boolean;
  sales: number;
  revenue: number;
  quantity: number;
  lowStockItems: number;
  topFood: { foodItemId: string; name?: string; quantity: number }[];
}

export interface StoresComparisonResponse {
  start: string;
  end: string;
  stores: StoreComparison[];
}

export interface FoodPerformance {
  foodItemId: string;
  name: string;
  category?: string;
  quantity: number;
  revenue: number;
  sales: number;
}

export interface FoodResponse {
  start: string;
  end: string;
  topSellers: FoodPerformance[];
  lowPerformers: FoodPerformance[];
}

export interface StoreSummaryAllocation {
  id: string;
  foodId: string;
  foodName?: string;
  date: string;
  allocated: number;
  sold: number;
  remaining: number;
  unitPrice: number;
  revenue: number;
  profit: number;
  totalCost: number;
  status?: string;
}

export interface StoreSummaryEmployee {
  id: string;
  username?: string;
  name?: string;
  email?: string;
  role?: string;
  isActive?: boolean;
  lastLoginAt?: string | null;
}

export interface StoreSummaryTopFood {
  foodId: string;
  name?: string;
  quantity: number;
  revenue: number;
}

export interface StoreSummaryTotals {
  allocatedCount: number;
  activeEmployeesCount: number;
  lowStockItems: number;
}

export interface StoreSummaryResponse {
  store: Record<string, unknown>;
  today: { sales: number; revenue: number; orders: number };
  last7: { sales: number; revenue: number; orders: number };
  last30: { sales: number; revenue: number; orders: number };
  profit30d: { revenue: number; cost: number; profit: number; marginPct: number; sales: number };
  allocations: StoreSummaryAllocation[];
  employees: StoreSummaryEmployee[];
  topFood: StoreSummaryTopFood[];
  totals: StoreSummaryTotals;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Date range used by analytics endpoints. The backend expects query params
 * ``from`` and ``to`` as ISO date strings. ``storeId`` filters by store.
 */
export interface DateRange {
  from?: string;
  to?: string;
  storeId?: string;
}

function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    search.set(k, String(v));
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}

// -----------------------------------------------------------------------------
// API calls
// -----------------------------------------------------------------------------

export interface DashboardTotals {
  ingredients: number;
  activeStores: number;
  todaySales: number;
  todayRevenue: number;
  lowStockItems: number;
}

export interface DashboardResponse {
  totals: DashboardTotals;
  generatedAt: string;
}

export async function getDashboard(storeId?: string): Promise<DashboardResponse> {
  return apiClient.get(`/api/v1/analytics/dashboard${qs({ storeId })}`);
}

export async function getRevenue(
  range: DateRange = {},
  groupBy: 'day' | 'week' | 'month' | 'store' | 'food' = 'day',
): Promise<RevenueResponse> {
  return apiClient.get(`/api/v1/analytics/revenue${qs({ ...range, groupBy })}`);
}

export async function getProfit(range: DateRange = {}): Promise<ProfitResponse> {
  return apiClient.get(`/api/v1/analytics/profit${qs({ ...range })}`);
}

export async function getInventoryAnalytics(range: DateRange = {}): Promise<InventoryResponse> {
  return apiClient.get(`/api/v1/analytics/inventory${qs({ ...range })}`);
}

export async function getEmployeesAnalytics(range: DateRange = {}, limit = 25): Promise<EmployeesResponse> {
  return apiClient.get(`/api/v1/analytics/employees${qs({ ...range, limit })}`);
}

export async function getStoresComparison(range: DateRange = {}): Promise<StoresComparisonResponse> {
  return apiClient.get(`/api/v1/analytics/stores${qs({ ...range })}`);
}

export async function getFoodAnalytics(range: DateRange = {}, top = 10): Promise<FoodResponse> {
  return apiClient.get(`/api/v1/analytics/food${qs({ ...range, top })}`);
}

export async function getStoreSummary(storeId: string): Promise<StoreSummaryResponse> {
  return apiClient.get(`/api/v1/analytics/store-summary${qs({ storeId })}`);
}

/**
 * Download a CSV for a named report. Returns a Blob URL the caller can wrap
 * in an `<a download>` click.
 */
export async function downloadReportCsv(
  report: 'revenue' | 'profit' | 'inventory' | 'employees' | 'stores' | 'food',
  range: DateRange = {},
  groupBy: 'day' | 'week' | 'month' | 'store' | 'food' = 'day',
): Promise<{ blob: Blob; filename: string }> {
  const response = await apiClient.get(
    `/api/v1/analytics/export${qs({ type: 'csv', report, ...range, groupBy })}`,
    { responseType: 'blob' },
  );
  const blob = response.data as Blob;
  const cd = (response.headers as Record<string, string>)['content-disposition'] ?? '';
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `${report}.csv`;
  return { blob, filename };
}