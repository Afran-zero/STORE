import { DataTable } from '@/components/shared/data-table';

const rows = [] as Array<{ id: string; name: string; price: string; profit: string }>;

export function FoodPage(): JSX.Element {
  return <DataTable title="Food menu" columns={[{ header: 'Name', cell: (row) => row.name }, { header: 'Price', cell: (row) => row.price }, { header: 'Profit', cell: (row) => row.profit }]} rows={rows} emptyMessage="Add food items linked to recipes." />;
}
