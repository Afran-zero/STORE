import { DataTable } from '@/components/shared/data-table';

const rows = [] as Array<{ id: string; name: string; status: string }>;

export function StoresPage(): JSX.Element {
  return <DataTable title="Stores" columns={[{ header: 'Name', cell: (row) => row.name }, { header: 'Status', cell: (row) => row.status }]} rows={rows} emptyMessage="Add your first store to get started." />;
}
