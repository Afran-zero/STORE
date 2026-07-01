import { DataTable } from '@/components/shared/data-table';

const rows = [] as Array<{ id: string; name: string; role: string; store: string }>;

export function EmployeesPage(): JSX.Element {
  return <DataTable title="Employees" columns={[{ header: 'Name', cell: (row) => row.name }, { header: 'Role', cell: (row) => row.role }, { header: 'Store', cell: (row) => row.store }]} rows={rows} emptyMessage="No employees found." />;
}
