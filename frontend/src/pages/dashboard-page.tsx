import { useActiveStore } from '@/hooks/use-active-store';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/features/dashboard/hooks/use-dashboard';
import { useStoreLowStock } from '@/features/store-inventory/hooks/use-store-inventory';
import { useDailyForecast } from '@/features/forecast/hooks/use-forecast';
import { useSales } from '@/features/sales/hooks/use-sales';
import { useNotifications } from '@/features/notifications/hooks/use-notifications';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

export function DashboardPage(): JSX.Element {
  const { storeId } = useActiveStore();
  const { data, isLoading } = useDashboard(storeId ?? undefined);
  const { data: lowStock = [] } = useStoreLowStock(storeId ?? undefined);
  const { data: forecast = [] } = useDailyForecast(7);
  const { data: sales = [] } = useSales(storeId ?? undefined);
  const { data: notifications = [] } = useNotifications(storeId ?? undefined);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Today's revenue" value={isLoading ? '—' : `$${data?.totals.todayRevenue.toFixed(2) ?? '0'}`} />
        <KpiCard label="Sales today" value={isLoading ? '—' : String(data?.totals.todaySales ?? 0)} />
        <KpiCard label="Low stock" value={isLoading ? '—' : String(data?.totals.lowStockItems ?? lowStock.length)} />
        <KpiCard label="Active stores" value={isLoading ? '—' : String(data?.totals.activeStores ?? 0)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <header className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight">7-day forecast</h3>
            <Link to="/forecast" className="text-sm font-semibold text-zinc-600 hover:underline">
              View all
            </Link>
          </header>
          {forecast.length === 0 ? (
            <p className="text-sm text-zinc-500">Not enough sales history yet — start recording sales to populate the forecast.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {forecast.slice(0, 6).map((row) => (
                <li key={row.foodItemId} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">{row.name}</p>
                    <p className="text-xs text-zinc-500">{row.category ?? 'Uncategorized'} · based on {row.basedOnDays}d</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-zinc-950">~{row.predictedQuantity.toFixed(0)}</p>
                    <p className="text-xs text-zinc-500">${row.totalRevenue.toFixed(2)}</p>
                  </div>
                </li>
              ))}
            </ul>
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
              {lowStock.slice(0, 6).map((row) => (
                <li key={row.ingredientId} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-semibold text-zinc-950">{row.ingredient?.name ?? row.ingredientId}</p>
                    <p className="text-xs text-zinc-500">{row.ingredient?.unit ?? ''}</p>
                  </div>
                  <Badge className="bg-red-50 text-red-600">{row.quantity} / {row.minimumStock ?? '—'}</Badge>
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
            <ul className="divide-y divide-zinc-100">
              {sales.slice(0, 5).map((sale) => (
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
              {notifications.slice(0, 5).map((n) => (
                <li key={n.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
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
