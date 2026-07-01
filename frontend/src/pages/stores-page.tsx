import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { createStore, listStores, type StoreType } from '@/api/endpoints/stores';

const storeTypes: StoreType[] = ['RETAIL', 'FOOD', 'WAREHOUSE', 'KITCHEN'];

export function StoresPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<StoreType>('RETAIL');
  const [phone, setPhone] = useState('');

  const storesQuery = useQuery({
    queryKey: ['stores', 'list'],
    queryFn: listStores,
  });

  const createMutation = useMutation({
    mutationFn: createStore,
    onSuccess: () => {
      setName('');
      setPhone('');
      void queryClient.invalidateQueries({ queryKey: ['stores', 'list'] });
      toast.success('Store created');
    },
    onError: () => {
      toast.error('Unable to create store');
    },
  });

  return (
    <div className="space-y-6">
      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">Add Store</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <Input placeholder="Store name" value={name} onChange={(event) => setName(event.target.value)} />
          <select
            className="h-10 rounded-xl border border-zinc-200 px-3 text-sm"
            value={type}
            onChange={(event) => setType(event.target.value as StoreType)}
          >
            {storeTypes.map((storeType) => (
              <option key={storeType} value={storeType}>{storeType}</option>
            ))}
          </select>
          <Input placeholder="Phone (optional)" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <Button
            onClick={() => {
              if (!name.trim()) {
                toast.error('Store name is required');
                return;
              }
              createMutation.mutate({ name: name.trim(), type, phone: phone.trim() || undefined });
            }}
            disabled={createMutation.isPending}
          >
            Create Store
          </Button>
        </div>
      </Card>

      <DataTable
        title="Stores"
        rows={storesQuery.data ?? []}
        isLoading={storesQuery.isLoading}
        columns={[
          { header: 'Name', cell: (row) => row.name },
          { header: 'Type', cell: (row) => row.type },
          { header: 'Status', cell: (row) => row.status },
        ]}
        emptyMessage="Add your first store to get started."
      />
    </div>
  );
}
