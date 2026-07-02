import { useQuery } from '@/lib/query-helpers';
import { getDailyForecast } from '@/api/endpoints/forecast';
import { forecastKeys } from '@/api/queryKeys';

export function useDailyForecast(days = 7) {
  return useQuery({
    queryKey: forecastKeys.daily(days),
    queryFn: () => getDailyForecast(days),
  });
}