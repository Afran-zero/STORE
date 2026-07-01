import { DataTable } from '@/components/shared/data-table';

const rows = [] as Array<{ id: string; name: string; stock: string; status: string }>;

export function InventoryPage(): JSX.Element {
  return <DataTable title="Inventory" columns={[{ header: 'Ingredient', cell: (row) => row.name }, { header: 'Stock', cell: (row) => row.stock }, { header: 'Status', cell: (row) => row.status }]} rows={rows} emptyMessage="No ingredients yet." />;
}
