import { apiClient } from '@/api/client';

export interface ForecastEntry {
  foodItemId: string;
  name: string;
  category?: string;
  averageQuantity: number;
  predictedQuantity: number;
  totalRevenue: number;
  basedOnDays: number;
}

export async function getDailyForecast(days = 7): Promise<ForecastEntry[]> {
  return apiClient.get(`/api/v1/forecasts/daily?days=${days}`);
}