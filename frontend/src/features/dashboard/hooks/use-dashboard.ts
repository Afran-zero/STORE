import { useQuery } from '@/lib/query-helpers';
import { getDashboard } from '@/api/endpoints/dashboard';
import { dashboardKeys } from '@/api/queryKeys';

export function useDashboard(storeId?: string) {
  return useQuery({
    queryKey: dashboardKeys.overview(storeId),
    queryFn: () => getDashboard(storeId),
    refetchInterval: 60_000,
  });
}