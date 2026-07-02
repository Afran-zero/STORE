import { useState } from 'react';
import type { SubmitErrorHandler } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, Sheet as _Sheet } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useCreateIngredient,
  useDeleteIngredient,
  useIngredients,
  useUpdateIngredientMutation,
} from '@/features/inventory/hooks/use-ingredients';
import type { Ingredient } from '@/api/endpoints/ingredients';
import { ApiException } from '@/types/api';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  category: z.string().optional(),
  unit: z.string().min(1, 'Required'),
  costPerUnit: z.coerce.number().min(0).optional(),
  currentStock: z.coerce.number().min(0).optional(),
  minimumStock: z.coerce.number().min(0).optional(),
  maximumStock: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof schema>;

export function InventoryPage(): JSX.Element {
  const [filter, setFilter] = useState<'all' | 'low'>('all');
  const { data, isLoading } = useIngredients(filter === 'low' ? { lowStock: true } : {});
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [creating, setCreating] = useState(false);
  const createMutation = useCreateIngredient();
  const updateMutation = useUpdateIngredientMutation();
  const deleteMutation = useDeleteIngredient();

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, reset, formState: { errors } } = form;

  function openCreate() {
    reset({ name: '', category: '', unit: 'kg', costPerUnit: 0, currentStock: 0, minimumStock: 0 });
    setEditing(null);
    setCreating(true);
  }

  function openEdit(ing: Ingredient) {
    reset({
      name: ing.name,
      category: ing.category ?? '',
      unit: ing.unit,
      costPerUnit: ing.costPerUnit ?? 0,
      currentStock: ing.currentStock ?? 0,
      minimumStock: ing.minimumStock ?? 0,
      maximumStock: ing.maximumStock ?? 0,
    });
    setEditing(ing);
    setCreating(true);
  }

  const onInvalid: SubmitErrorHandler<FormValues> = (formErrors) => {
    const entries = Object.entries(formErrors);
    const summary = entries
      .map(([key, value]) => {
        const v = value as { message?: string } | undefined;
        return v?.message ? `${key}: ${v.message}` : key;
      })
      .join('; ');
    console.warn('[inventory] validation failed', formErrors);
    toast.error(summary || 'Please fix the highlighted fields');
  };

  async function onSubmit(values: FormValues) {
    try {
      if (editing && editing.id) {
        await updateMutation.mutateAsync({ id: editing.id, input: values });
        toast.success(`Updated ${values.name}`);
      } else {
        await createMutation.mutateAsync(values);
        toast.success(`Created ${values.name}`);
      }
      setCreating(false);
      setEditing(null);
    } catch (error) {
      const message = error instanceof ApiException ? error.message : 'Failed to save ingredient';
      toast.error(message);
      console.error('[inventory] save failed', error);
    }
  }

  async function onDelete(ing: Ingredient) {
    if (!confirm(`Delete ${ing.name}?`)) return;
    try {
      await deleteMutation.mutateAsync(ing.id);
      toast.success(`Deleted ${ing.name}`);
    } catch (error) {
      toast.error(error instanceof ApiException ? error.message : 'Delete failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'low')}>
            <option value="all">All ingredients</option>
            <option value="low">Low stock only</option>
          </Select>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New ingredient
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
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Cost / unit</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Min</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.length === 0 ? (
              <TableEmpty colspan={7}>No ingredients found. Add one to get started.</TableEmpty>
            ) : (
              data?.map((ing) => {
                const minStock = Number(ing.minimumStock ?? 0);
                const curStock = Number(ing.currentStock ?? 0);
                const isLow = minStock > 0 && curStock < minStock;
                return (
                  <TableRow key={ing.id}>
                    <TableCell className="font-semibold text-zinc-950">{ing.name}</TableCell>
                    <TableCell>{ing.category ?? '—'}</TableCell>
                    <TableCell>{ing.unit}</TableCell>
                    <TableCell>${(ing.costPerUnit ?? 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        {curStock}
                        {isLow ? <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> : null}
                      </span>
                    </TableCell>
                    <TableCell>{ing.minimumStock ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" onClick={() => openEdit(ing)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" onClick={() => onDelete(ing)} aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      )}

      <Sheet
        open={creating}
        onOpenChange={(o) => {
          setCreating(o);
          if (!o) setEditing(null);
        }}
        title={editing ? 'Edit ingredient' : 'New ingredient'}
        description={editing ? 'Update the ingredient details.' : 'Add a new ingredient to the catalog.'}
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} className="mt-1" />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input id="category" {...register('category')} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Select id="unit" {...register('unit')} className="mt-1">
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="l">l</option>
                <option value="ml">ml</option>
                <option value="pcs">pcs</option>
                <option value="pack">pack</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="costPerUnit">Cost / unit</Label>
              <Input id="costPerUnit" type="number" step="0.01" {...register('costPerUnit')} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="currentStock">Stock</Label>
              <Input id="currentStock" type="number" step="0.01" {...register('currentStock')} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="minimumStock">Min</Label>
              <Input id="minimumStock" type="number" step="0.01" {...register('minimumStock')} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="maximumStock">Max</Label>
              <Input id="maximumStock" type="number" step="0.01" {...register('maximumStock')} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Save changes' : 'Create ingredient'}
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
