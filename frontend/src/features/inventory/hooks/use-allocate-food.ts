import { useMutation, useQueryClient } from '@/lib/query-helpers';
import { allocateFood, type FoodAllocationRequest, type FoodAllocationResult } from '@/api/endpoints/inventory';
import { storeInventoryKeys } from '@/api/queryKeys';
import { inventoryKeys } from '@/api/queryKeys';

export function useAllocateFood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FoodAllocationRequest) => allocateFood(input),
    onSuccess: (result: FoodAllocationResult) => {
      // Invalidate store-inventory + ingredient stock views for the affected store
      qc.invalidateQueries({ queryKey: storeInventoryKeys.list(result.storeId) });
      qc.invalidateQueries({ queryKey: storeInventoryKeys.lowStock(result.storeId) });
      qc.invalidateQueries({ queryKey: inventoryKeys.lowStock() });
      qc.invalidateQueries({ queryKey: ['analytics', 'dashboard'] });
    },
  });
}