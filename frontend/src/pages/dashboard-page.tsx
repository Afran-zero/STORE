import { useActiveStore } from '@/hooks/use-active-store';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/features/analytics/hooks/use-analytics';
import { useStoreLowStock } from '@/features/store-inventory/hooks/use-store-inventory';
import { useProjectedDailyForecast } from '@/features/forecast/hooks/use-forecast';
import { useSales } from '@/features/sales/hooks/use-sales';
import { useNotifications } from '@/features/notifications/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const FORECAST_COLORS = ['#09090b', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8', '#52525b', '#27272a'];

interface ForecastChartDatum {
  date: string;
  [foodName: string]: number | string;
}

export function DashboardPage(): JSX.Element {
  const { storeId } = useActiveStore();
  const { data, isLoading } = useDashboard(storeId ?? undefined);
  const { data: lowStock = [] } = useStoreLowStock(storeId ?? undefined);
  const { data: forecast } = useProjectedDailyForecast(7, 6);
  const { data: sales = [] } = useSales(storeId ?? undefined);
  const { data: notifications = [] } = useNotifications(storeId ?? undefined);

  // Build per-date bars from the projected forecast shape.
  const chartData: ForecastChartDatum[] = (() => {
    if (!forecast?.items?.length) return [];
    const dates = forecast.days ?? [];
    return dates.map((date) => {
      const row: ForecastChartDatum = { date: date.slice(5) }; // MM-DD
      forecast.items.forEach((item) => {
        const point = item.daily.find((p) => p.date === date);
        row[item.name] = point?.predictedQuantity ?? 0;
      });
      return row;
    });
  })();

  const topFoodNames = (forecast?.items ?? []).slice(0, 6).map((i) => i.name);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Today's revenue" value={isLoading ? '—' : `$${data?.totals?.todayRevenue.toFixed(2) ?? '0'}`} />
        <KpiCard label="Sales today" value={isLoading ? '—' : String(data?.totals?.todaySales ?? 0)} />
        <KpiCard label="Low stock" value={isLoading ? '—' : String(data?.totals?.lowStockItems ?? lowStock.length)} />
        <KpiCard label="Active stores" value={isLoading ? '—' : String(data?.totals?.activeStores ?? 0)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold tracking-tight">7-day forecast</h3>
              <p className="text-xs text-zinc-500">
                Predicted daily quantity per top food item, based on the last {forecast?.basisDays ?? 28} days of sales.
              </p>
            </div>
            <Link to="/forecast" className="text-sm font-semibold text-zinc-600 hover:underline">
              View all
            </Link>
          </header>
          {chartData.length === 0 || topFoodNames.length === 0 ? (
            <p className="text-sm text-zinc-500">Not enough sales history yet — start recording sales to populate the forecast.</p>
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: 12, borderColor: '#d4d4d8' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {topFoodNames.map((name, idx) => (
                      <Bar
                        key={name}
                        dataKey={name}
                        stackId="forecast"
                        fill={FORECAST_COLORS[idx % FORECAST_COLORS.length]}
                        radius={idx === topFoodNames.length - 1 ? [6, 6, 0, 0] : undefined}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 divide-y divide-zinc-200">
                {forecast?.items.slice(0, 6).map((item) => (
                  <li key={item.foodItemId} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-950">{item.name}</p>
                      <p className="text-xs text-zinc-500">{item.category ?? 'Uncategorized'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-zinc-950">~{item.totalPredicted} units</p>
                      <p className="text-xs text-zinc-500">avg {item.weightedAverage.toFixed(1)}/day</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <header className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight">Low stock</h3>
            <Link to="/inventory" className="text-sm font-semibold text-zinc-600 hover:underline">
              Manage
            </Link>
          </header>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : lowStock.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing below minimum. Keep it up.</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.slice(0, 6).map((row: any) => (
                <li
                  key={row.ingredientId ?? row.ingredient?.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-semibold text-zinc-950">{row.ingredient?.name ?? row.ingredientId}</p>
                    <p className="text-xs text-zinc-500">{row.ingredient?.unit ?? ''}</p>
                  </div>
                  <Badge className="bg-red-50 text-red-600 border-red-200">{row.quantity} / {row.minimumStock ?? '—'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <header className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight">Recent sales</h3>
            <Link to="/sales" className="text-sm font-semibold text-zinc-600 hover:underline">
              Record
            </Link>
          </header>
          {sales.length === 0 ? (
            <p className="text-sm text-zinc-500">No sales recorded yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {sales.slice(0, 5).map((sale: any) => (
                <li key={sale.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">{sale.foodName} × {sale.quantity}</p>
                    <p className="text-xs text-zinc-500">
                      {sale.channel} · {formatDistanceToNow(new Date(sale.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-zinc-950">${sale.totalPrice.toFixed(2)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <header className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight">Notifications</h3>
            <Link to="/notifications" className="text-sm font-semibold text-zinc-600 hover:underline">
              All
            </Link>
          </header>
          {notifications.length === 0 ? (
            <p className="text-sm text-zinc-500">No alerts.</p>
          ) : (
            <ul className="space-y-2">
              {notifications.slice(0, 5).map((n: any) => (
                <li key={n.id} className="rounded-2xl border border-zinc-300 bg-zinc-50 px-3 py-2">
                  <p className="text-sm font-semibold text-zinc-950">{n.title}</p>
                  <p className="text-xs text-zinc-500">{n.message}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}