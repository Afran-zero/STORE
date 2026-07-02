import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, ReceiptText, Calculator } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import {
  useCreateFood,
  useDeleteFood,
  useFood,
  useRecalculateFoodCost,
  useUpdateFoodMutation,
} from '@/features/food/hooks/use-food';
import { useRecipes } from '@/features/recipes/hooks/use-recipes';
import type { FoodItem } from '@/api/endpoints/food';
import { ApiException } from '@/types/api';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  category: z.string().optional(),
  price: z.coerce.number().positive('Must be > 0'),
  recipeId: z.string().min(1, 'Required'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

type FormValues = z.infer<typeof schema>;

export function FoodPage(): JSX.Element {
  const { data, isLoading } = useFood();
  const { data: recipes = [] } = useRecipes();
  const [editing, setEditing] = useState<FoodItem | null>(null);
  const [opening, setOpening] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, reset, formState: { errors } } = form;

  const createMutation = useCreateFood();
  const updateMutation = useUpdateFoodMutation();
  const deleteMutation = useDeleteFood();
  const recalcMutation = useRecalculateFoodCost();

  useEffect(() => {
    if (opening && editing) {
      reset({
        name: editing.name,
        description: editing.description ?? '',
        category: editing.category ?? '',
        price: editing.price,
        recipeId: editing.recipeId ?? '',
        imageUrl: editing.imageUrl ?? '',
        status: (editing.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'),
      });
    } else if (opening && !editing) {
      reset({ name: '', description: '', category: '', price: 0, recipeId: recipes[0]?.id ?? '', imageUrl: '', status: 'ACTIVE' });
    }
  }, [opening, editing, recipes, reset]);

  async function onSubmit(values: FormValues) {
    try {
      const payload = { ...values, imageUrl: values.imageUrl || undefined };
      if (editing && editing.id) {
        await updateMutation.mutateAsync({ id: editing.id, input: payload });
        toast.success(`Updated ${values.name}`);
      } else {
        await createMutation.mutateAsync(payload as { name: string; price: number; recipeId: string; description?: string; category?: string; imageUrl?: string });
        toast.success(`Created ${values.name}`);
      }
      setOpening(false);
      setEditing(null);
    } catch (error) {
      toast.error(error instanceof ApiException ? error.message : 'Failed to save food item');
    }
  }

  async function onDelete(item: FoodItem) {
    if (!confirm(`Delete ${item.name}?`)) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      toast.success(`Deleted ${item.name}`);
    } catch (error) {
      toast.error(error instanceof ApiException ? error.message : 'Delete failed');
    }
  }

  async function onRecalc(item: FoodItem) {
    try {
      await recalcMutation.mutateAsync(item.id);
      toast.success(`Recalculated cost for ${item.name}`);
    } catch (error) {
      toast.error(error instanceof ApiException ? error.message : 'Recalculation failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{data?.length ?? 0} items</p>
        <Button onClick={() => { setEditing(null); setOpening(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New food item
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : data?.length === 0 ? (
        <Card className="text-center text-sm text-zinc-500">No food items yet. Create one to make it orderable.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.map((item) => (
            <Card key={item.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
                    <ReceiptText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">{item.name}</p>
                    <p className="text-xs text-zinc-500">{item.category ?? 'Uncategorized'}</p>
                  </div>
                </div>
                <Badge>{item.status ?? 'ACTIVE'}</Badge>
              </div>
              {item.description ? <p className="text-sm text-zinc-600">{item.description}</p> : null}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-2xl bg-zinc-50 px-3 py-2">
                  <p className="text-zinc-500">Price</p>
                  <p className="text-sm font-semibold text-zinc-950">${item.price.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 px-3 py-2">
                  <p className="text-zinc-500">Cost</p>
                  <p className="text-sm font-semibold text-zinc-950">${item.cost.toFixed(2)}</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 px-3 py-2">
                  <p className="text-zinc-500">Profit</p>
                  <p className="text-sm font-semibold text-zinc-950">${item.estimatedProfit.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-auto flex justify-end gap-1">
                <Button variant="ghost" onClick={() => onRecalc(item)} aria-label="Recalculate cost">
                  <Calculator className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => { setEditing(item); setOpening(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" onClick={() => onDelete(item)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={opening}
        onOpenChange={(o) => { setOpening(o); if (!o) setEditing(null); }}
        title={editing ? 'Edit food item' : 'New food item'}
        description="Link a recipe and set a price."
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} className="mt-1" />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register('description')} className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="category">Category</Label>
              <Input id="category" {...register('category')} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="price">Price</Label>
              <Input id="price" type="number" step="0.01" {...register('price')} className="mt-1" />
              {errors.price ? <p className="mt-1 text-xs text-red-600">{errors.price.message}</p> : null}
            </div>
          </div>
          <div>
            <Label htmlFor="recipeId">Recipe</Label>
            <Select id="recipeId" {...register('recipeId')} className="mt-1">
              <option value="">Select recipe…</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
            {errors.recipeId ? <p className="mt-1 text-xs text-red-600">{errors.recipeId.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="imageUrl">Image URL (optional)</Label>
            <Input id="imageUrl" {...register('imageUrl')} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" {...register('status')} className="mt-1">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpening(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Save changes' : 'Create food item'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
