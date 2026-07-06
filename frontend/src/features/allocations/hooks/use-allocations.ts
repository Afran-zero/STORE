import { useMutation, useQuery, useQueryClient } from '@/lib/query-helpers';

import {
  createAllocation,
  deleteAllocation,
  getAllocation,
  getStoreAllocationSummary,
  listAllocations,
  reclaimAllocation,
  updateAllocation,
  type Allocation,
  type AllocationCreateRequest,
  type AllocationUpdateRequest,
} from '@/api/endpoints/allocations';
import { allocationKeys } from '@/api/queryKeys';

interface AllocationListParams {
  storeId?: string;
  foodId?: string;
  start?: string;
  end?: string;
  status?: string;
  limit?: number;
}

export function useAllocations(params: AllocationListParams = {}) {
  return useQuery({
    queryKey: allocationKeys.list(params as Record<string, string | number | undefined>),
    queryFn: () => listAllocations(params),
  });
}

export function useAllocation(id: string | null) {
  return useQuery({
    queryKey: id ? allocationKeys.detail(id) : ['allocations', 'disabled'],
    queryFn: () => getAllocation(id as string),
    enabled: Boolean(id),
  });
}

export function useStoreAllocationSummary(
  storeId: string | null,
  range: { start?: string; end?: string } = {},
) {
  return useQuery({
    queryKey: storeId ? allocationKeys.storeSummary(storeId, range.start, range.end) : ['allocations', 'disabled'],
    queryFn: () => getStoreAllocationSummary(storeId as string, range),
    enabled: Boolean(storeId),
  });
}

export function useCreateAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AllocationCreateRequest) => createAllocation(input),
    onSuccess: (allocation: Allocation) => {
      // Force-refetch the list (and store-summary) so the new row appears immediately.
      // Use refetchQueries rather than invalidateQueries because some pages hold
      // filtered query keys that can miss the invalidate-and-then-render cycle.
      qc.refetchQueries({ queryKey: allocationKeys.all });
      qc.setQueryData(allocationKeys.detail(allocation.id), allocation);
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AllocationUpdateRequest }) => updateAllocation(id, input),
    onSuccess: (allocation: Allocation) => {
      qc.refetchQueries({ queryKey: allocationKeys.all });
      qc.setQueryData(allocationKeys.detail(allocation.id), allocation);
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useDeleteAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAllocation(id),
    onSuccess: (allocation: Allocation) => {
      qc.refetchQueries({ queryKey: allocationKeys.all });
      qc.setQueryData(allocationKeys.detail(allocation.id), allocation);
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useReclaimAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reclaimAllocation(id),
    onSuccess: (allocation: Allocation) => {
      qc.invalidateQueries({ queryKey: allocationKeys.all });
      qc.setQueryData(allocationKeys.detail(allocation.id), allocation);
      // Also invalidate inventory/analytics so the store-summary,
      // low-stock toasts, and ingredient stock numbers refresh.
      qc.invalidateQueries({ queryKey: ['inventory', 'ingredients'] });
      qc.invalidateQueries({ queryKey: ['store-inventory'] });
      qc.invalidateQueries({ queryKey: ['analytics', 'store-summary'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}