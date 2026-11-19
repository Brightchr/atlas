import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import type { Food } from '@arcadia/shared';
import { Button } from '@/components/ui';
import { importFood } from '../../repository';

/** Create a food straight from its label: per-serving numbers plus the
 * serving size, stored per-100g so it scales anywhere. The created food is
 * saved to your library, shows up in every future search, and logs by
 * servings ("2 servings of peanut butter") like any other food. */
export function CreateFoodCard({ onCreated }: { onCreated: (food: Food) => void }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingGrams, setServingGrams] = useState('');
  const [servingName, setServingName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [sugar, setSugar] = useState('');
  const [fiber, setFiber] = useState('');
  const [sodiumMg, setSodiumMg] = useState('');

  const grams = Number(servingGrams);
  const valid = name.trim().length > 0 && grams > 0 && Number(kcal) >= 0 && kcal !== '';

  const create = useMutation({
    mutationFn: async () => {
      // Label numbers are per serving; storage is per 100 g.
      const per100 = (v: string) =>
        v === '' ? undefined : Math.round((Number(v) / grams) * 100 * 100) / 100;
      return importFood({
        name: name.trim(),
        brand: brand.trim() || null,
        barcode: null,
        source: 'user',
        per100g: {
          kcal: Math.round((Number(kcal) / grams) * 100),
          proteinG: per100(protein) ?? 0,
          carbsG: per100(carbs) ?? 0,
          fatG: per100(fat) ?? 0,
          sugarG: per100(sugar),
          fiberG: per100(fiber),
          sodiumG: sodiumMg === '' ? undefined : per100(String(Number(sodiumMg) / 1000)),
        },
        imageUrl: null,
        servingName: servingName.trim() || `1 serving (${grams} g)`,
        servingGrams: grams,
      });
    },
    onSuccess: (food) => onCreated(food),
  });

  // 44px-tall fields; inputMode opens the number pad on phones.
  const field =
    'mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-accent';
  const label = 'block text-sm font-medium text-muted';

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Name *
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Crunchy peanut butter" className={field} />
        </label>
        <label className={label}>
          Brand
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="optional" className={field} />
        </label>
        <label className={label}>
          Serving size (g) * — from the label
          <input type="number" inputMode="decimal" min="1" value={servingGrams} onChange={(e) => setServingGrams(e.target.value)} placeholder="e.g. 32" className={field} />
        </label>
        <label className={label}>
          Serving name
          <input value={servingName} onChange={(e) => setServingName(e.target.value)} placeholder="e.g. 2 tbsp" className={field} />
        </label>
      </div>
      <p className="text-sm font-semibold text-muted">Per serving, straight off the label:</p>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Calories *
          <input type="number" inputMode="decimal" min="0" value={kcal} onChange={(e) => setKcal(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Protein (g)
          <input type="number" inputMode="decimal" min="0" step="0.1" value={protein} onChange={(e) => setProtein(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Carbs (g)
          <input type="number" inputMode="decimal" min="0" step="0.1" value={carbs} onChange={(e) => setCarbs(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Fat (g)
          <input type="number" inputMode="decimal" min="0" step="0.1" value={fat} onChange={(e) => setFat(e.target.value)} className={field} />
        </label>
        <label className={label}>
          Sugar (g)
          <input type="number" inputMode="decimal" min="0" step="0.1" value={sugar} onChange={(e) => setSugar(e.target.value)} placeholder="optional" className={field} />
        </label>
        <label className={label}>
          Fiber (g)
          <input type="number" inputMode="decimal" min="0" step="0.1" value={fiber} onChange={(e) => setFiber(e.target.value)} placeholder="optional" className={field} />
        </label>
        <label className={label}>
          Sodium (mg)
          <input type="number" inputMode="decimal" min="0" value={sodiumMg} onChange={(e) => setSodiumMg(e.target.value)} placeholder="optional" className={field} />
        </label>
      </div>
      <Button block disabled={!valid || create.isPending} onClick={() => create.mutate()}>
        Create food
      </Button>
      {create.isError && <p className="text-sm text-rose-500">{create.error.message}</p>}
      <p className="text-sm text-muted">
        Blending ingredients into one thing, like a smoothie?{' '}
        <Link to="/eat/recipes" className="font-medium text-accent hover:underline">
          Build it as a recipe
        </Link>{' '}
        — it totals the stats for you.
      </p>
    </div>
  );
}
