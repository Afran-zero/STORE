import { KpiCard } from '@/components/shared/kpi-card';
import { Card } from '@/components/ui/card';

export function DashboardPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Today's revenue" value="$0" delta="0%" />
        <KpiCard label="Low stock alerts" value="0" />
        <KpiCard label="Open tickets" value="0" />
        <KpiCard label="Active stores" value="0" />
      </section>
      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h3 className="text-lg font-bold tracking-tight">Revenue trend</h3>
          <p className="mt-2 text-sm text-zinc-500">Chart will render once analytics data is connected.</p>
          <div className="mt-6 h-64 rounded-3xl border border-dashed border-zinc-200 bg-zinc-50" />
        </Card>
        <Card>
          <h3 className="text-lg font-bold tracking-tight">Recent tickets</h3>
          <p className="mt-2 text-sm text-zinc-500">No data yet.</p>
        </Card>
      </section>
    </div>
  );
}
