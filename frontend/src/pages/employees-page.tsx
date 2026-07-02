import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Power, Trash2, UserCog } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import {
  useCreateUser,
  useDeleteUser,
  useToggleUserStatus,
  useUsers,
} from '@/features/users/hooks/use-users';
import { useStores } from '@/features/stores/hooks/use-stores';
import type { UserRecord } from '@/api/endpoints/users';
import { ApiException } from '@/types/api';

const schema = z.object({
  email: z.string().email('Valid email required'),
  name: z.string().min(1, 'Required'),
  role: z.enum(['OWNER', 'MANAGER', 'WORKER']),
  password: z.string().min(6, 'Min 6 chars'),
  assignedStore: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function EmployeesPage(): JSX.Element {
  const { data, isLoading } = useUsers();
  const { data: stores = [] } = useStores();
  const [opening, setOpening] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, reset, formState: { errors } } = form;

  const createMutation = useCreateUser();
  const toggleMutation = useToggleUserStatus();
  const deleteMutation = useDeleteUser();

  function openCreate() {
    reset({ email: '', name: '', role: 'WORKER', password: '', assignedStore: '' });
    setOpening(true);
  }

  async function onSubmit(values: FormValues) {
    try {
      await createMutation.mutateAsync({
        email: values.email,
        name: values.name,
        role: values.role,
        password: values.password,
        assignedStore: values.assignedStore || null,
      });
      toast.success(`Invited ${values.name}`);
      setOpening(false);
    } catch (error) {
      toast.error(error instanceof ApiException ? error.message : 'Invite failed');
    }
  }

  async function onToggle(user: UserRecord) {
    try {
      await toggleMutation.mutateAsync({ id: user.id, isActive: !(user.isActive ?? true) });
      toast.success(`${user.name} ${user.isActive ? 'deactivated' : 'reactivated'}`);
    } catch (error) {
      toast.error(error instanceof ApiException ? error.message : 'Status change failed');
    }
  }

  async function onDelete(user: UserRecord) {
    if (!confirm(`Remove ${user.name}?`)) return;
    try {
      await deleteMutation.mutateAsync(user.id);
      toast.success(`Removed ${user.name}`);
    } catch (error) {
      toast.error(error instanceof ApiException ? error.message : 'Delete failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{data?.length ?? 0} members</p>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Invite member
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 ? (
              <TableEmpty colspan={6}>No team members yet.</TableEmpty>
            ) : (
              data?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                        <UserCog className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-zinc-950">{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge>{user.role}</Badge></TableCell>
                  <TableCell>{stores.find((s) => s.id === user.assignedStore)?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge>{user.isActive ?? true ? 'ACTIVE' : 'DISABLED'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" onClick={() => onToggle(user)}><Power className="h-4 w-4" /></Button>
                      <Button variant="ghost" onClick={() => onDelete(user)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={opening} onOpenChange={setOpening} title="Invite team member">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} className="mt-1" />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} className="mt-1" />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="role">Role</Label>
              <Select id="role" {...register('role')} className="mt-1">
                <option value="WORKER">Worker</option>
                <option value="MANAGER">Manager</option>
                <option value="OWNER">Owner</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="assignedStore">Store</Label>
              <Select id="assignedStore" {...register('assignedStore')} className="mt-1">
                <option value="">Unassigned</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="password">Temporary password</Label>
            <Input id="password" type="password" {...register('password')} className="mt-1" />
            {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpening(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>Send invite</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
