import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Power, Trash2, Boxes } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import {
  useCreateStore,
  useDeleteStore,
  useSetStoreStatus,
  useStores,
  useUpdateStoreMutation,
} from '@/features/stores/hooks/use-stores';
import type { Store } from '@/features/stores/hooks/use-stores';
import { ApiException } from '@/types/api';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  code: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function StoresPage(): JSX.Element {
  const { data, isLoading } = useStores();
  const [editing, setEditing] = useState<Store | null>(null);
  const [opening, setOpening] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, reset, formState: { errors } } = form;

  const createMutation = useCreateStore();
  const updateMutation = useUpdateStoreMutation();
  const statusMutation = useSetStoreStatus();
  const deleteMutation = useDeleteStore();

  function openCreate() {
    reset({ name: '', code: '', address: '', city: '', phone: '', openingTime: '', closingTime: '' });
    setEditing(null);
    setOpening(true);
  }

  function openEdit(store: Store) {
    reset({
      name: store.name,
      code: store.code ?? '',
      address: store.address ?? '',
      city: store.city ?? '',
      phone: store.phone ?? '',
      openingTime: store.openingTime ?? '',
      closingTime: store.closingTime ?? '',
    });
    setEditing(store);
    setOpening(true);
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editing && editing.id) {
        await updateMutation.mutateAsync({ id: editing.id, input: values });
        toast.success(`Updated ${values.name}`);
      } else {
        await createMutation.mutateAsync(values);
        toast.success(`Created ${values.name}`);
      }
      setOpening(false);
      setEditing(null);
    } catch (error) {
      toast.error(error instanceof ApiException ? error.message : 'Failed to save store');
    }
  }

  async function onToggleStatus(store: Store) {
    try {
      await statusMutation.mutateAsync({ id: store.id, isActive: !(store.isActive ?? true) });
      toast.success(`${store.name} ${store.isActive ? 'closed' : 'opened'}`);
    } catch (error) {
      toast.error(error instanceof ApiException ? error.message : 'Status change failed');
    }
  }

  async function onDelete(store: Store) {
    if (!confirm(`Delete ${store.name}?`)) return;
    try {
      await deleteMutation.mutateAsync(store.id);
      toast.success(`Deleted ${store.name}`);
    } catch (error) {
      toast.error(error instanceof ApiException ? error.message : 'Delete failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{data?.length ?? 0} stores</p>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New store
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : data?.length === 0 ? (
        <Card className="text-center text-sm text-zinc-500">No stores yet. Create one to start operating.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((store) => (
            <Card key={store.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                    <Boxes className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">{store.name}</p>
                    <p className="text-xs text-zinc-500">{store.code ?? '—'}</p>
                  </div>
                </div>
                <Badge>{store.isActive ?? true ? 'OPEN' : 'CLOSED'}</Badge>
              </div>
              <div className="text-xs text-zinc-600">
                {store.address ?? '—'}
                {store.city ? `, ${store.city}` : ''}
              </div>
              <div className="text-xs text-zinc-500">
                Hours: {store.openingTime ?? '—'} – {store.closingTime ?? '—'} · {store.phone ?? 'no phone'}
              </div>
              <div className="mt-auto flex justify-end gap-1">
                <Button variant="ghost" onClick={() => onToggleStatus(store)}>
                  <Power className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => openEdit(store)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" onClick={() => onDelete(store)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={opening}
        onOpenChange={(o) => { setOpening(o); if (!o) setEditing(null); }}
        title={editing ? 'Edit store' : 'New store'}
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} className="mt-1" />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="code">Code</Label>
              <Input id="code" {...register('code')} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} className="mt-1" />
            </div>
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register('address')} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" {...register('city')} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="openingTime">Opens</Label>
              <Input id="openingTime" type="time" {...register('openingTime')} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="closingTime">Closes</Label>
              <Input id="closingTime" type="time" {...register('closingTime')} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpening(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Save changes' : 'Create store'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
