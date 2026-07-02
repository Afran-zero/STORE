import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Sparkles, RefreshCw } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDailyForecast } from '@/features/forecast/hooks/use-forecast';
import { useFood } from '@/features/food/hooks/use-food';

export function ForecastPage(): JSX.Element {
  const [days, setDays] = useState(14);
  const { data: forecast = [], isLoading, isFetching, refetch } = useDailyForecast(days);
  const { data: food = [] } = useFood();
  const foodMap = new Map(food.map((f) => [f.id, f]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{forecast.length} day projections across {food.length} items</p>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onChange={(event) => setDays(Number(event.target.value))} className="w-32">
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </Select>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <Card className="p-4">
        {isLoading ? (
          <Skeleton className="h-72" />
        ) : forecast.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">
            Forecasts appear once you have at least a few days of sales history.
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecast} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 16, border: '1px solid #e4e4e7', fontSize: 12 }}
                  labelStyle={{ color: '#18181b' }}
                />
                <Line
                  type="monotone"
                  dataKey="predictedQuantity"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, idx) => <Skeleton key={idx} className="h-24" />)
        ) : forecast.length === 0 ? null : (
          forecast.slice(0, 8).map((row) => {
            const item = foodMap.get(row.foodItemId);
            return (
              <Card key={row.foodItemId} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" />
                    <p className="font-semibold text-zinc-950">{item?.name ?? row.name}</p>
                  </div>
                  <Badge>{row.basedOnDays}d history</Badge>
                </div>
                <p className="mt-3 text-2xl font-semibold text-zinc-950">
                  {Math.round(row.predictedQuantity)}{' '}
                  <span className="text-sm font-normal text-zinc-500">units / day</span>
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Avg {row.averageQuantity.toFixed(1)} · Revenue ${row.totalRevenue.toFixed(2)}
                </p>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}