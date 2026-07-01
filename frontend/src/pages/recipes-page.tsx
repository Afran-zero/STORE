import { DataTable } from '@/components/shared/data-table';

const rows = [] as Array<{ id: string; name: string; status: string }>;

export function RecipesPage(): JSX.Element {
  return <DataTable title="Recipes" columns={[{ header: 'Name', cell: (row) => row.name }, { header: 'Status', cell: (row) => row.status }]} rows={rows} emptyMessage="Create a recipe to populate this page." />;
}
