import { apiClient } from '@/api/client';

export interface StoreInventoryRow {
  id?: string;
  storeId: string;
  ingredientId: string;
  ingredientName?: string | null;
  quantity: number;
  minimumStock?: number;
  unit?: string;
}

export async function getStoreInventory(storeId: string): Promise<StoreInventoryRow[]> {
  return apiClient.get(`/api/v1/store-inventory?storeId=${encodeURIComponent(storeId)}`);
}

export async function getStoreLowStock(storeId: string): Promise<StoreInventoryRow[]> {
  return apiClient.get(`/api/v1/store-inventory/low-stock?storeId=${encodeURIComponent(storeId)}`);
}