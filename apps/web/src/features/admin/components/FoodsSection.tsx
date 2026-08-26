import { useState } from 'react';
import { ChefHat, Trash2, Upload, UtensilsCrossed } from 'lucide-react';
import {
  useCuratedFoods,
  useDeleteFood,
  useImportFoods,
  useImportRecipes,
  type CuratedFoodInput,
} from '../api';

const FORMAT_HINT = `[
  { "name": "Bacon Egg and Cheese", "brand": "Dunkin'",
    "kcal": 500, "proteinG": 22, "carbsG": 40, "fatG": 28,
    "servingName": "1 sandwich", "servingGrams": 100 }
]`;

/** Seed the community recipe browser: paste a JSON array of full recipes
 * (name, servings, instructions, ingredients with food snapshots). Imported
 * recipes are published under YOUR account and upsert by name. */
function RecipesImport() {
  const [raw, setRaw] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const importRecipes = useImportRecipes();

  const handleImport = () => {
    setParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setParseError('That isn’t valid JSON.');
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      setParseError('Expected a JSON array of recipes.');
      return;
    }
    importRecipes.mutate(parsed, { onSuccess: () => setRaw('') });
  };

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <ChefHat size={18} className="text-accent" aria-hidden />
        Import community recipes
      </h2>
      <p className="text-sm text-muted">
        Paste a recipe JSON array — they publish to the community browser under your account and
        update in place on re-import.
      </p>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder='[ { "name": "…", "servings": 1, "instructions": "…", "ingredients": [ … ] } ]'
        rows={5}
        spellCheck={false}
        className="w-full rounded-2xl border border-line bg-surface p-3 font-mono text-xs outline-none placeholder:text-muted/60 focus:border-accent"
        aria-label="Recipes JSON"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={raw.trim().length < 2 || importRecipes.isPending}
          onClick={handleImport}
          className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {importRecipes.isPending ? 'Importing…' : 'Import recipes'}
        </button>
        {importRecipes.isSuccess && (
          <p className="text-sm text-emerald-500">
            Imported {importRecipes.data.imported} recipes.
          </p>
        )}
      </div>
      {parseError && <p className="text-sm text-rose-500">{parseError}</p>}
      {importRecipes.isError && (
        <p className="text-sm text-rose-500">{importRecipes.error.message}</p>
      )}
    </section>
  );
}

/** Our own food DB: paste a JSON array (hand-written or generated from a
 * nutrition guide) and it merges into everyone's search results, ahead of
 * the external sources. Serving-only items use servingGrams=100 so logging
 * "1 serving" reproduces the label exactly. */
export function FoodsSection() {
  const [q, setQ] = useState('');
  const [raw, setRaw] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const foods = useCuratedFoods(q);
  const importFoods = useImportFoods();
  const deleteFood = useDeleteFood();

  const handleImport = () => {
    setParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      setParseError('That isn’t valid JSON — check for a missing bracket or comma.');
      return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      setParseError('Expected a JSON array of foods.');
      return;
    }
    importFoods.mutate(parsed as CuratedFoodInput[], { onSuccess: () => setRaw('') });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Upload size={18} className="text-accent" aria-hidden />
          Import foods
        </h2>
        <p className="text-sm text-muted">
          Paste a JSON array of foods — they appear at the top of everyone's food search. Macros
          are per 100 g; for label-only items (restaurant guides) use the per-serving numbers with{' '}
          <code className="rounded bg-elev px-1">servingGrams: 100</code> so one serving matches
          the label. Re-importing the same name + brand updates it in place.
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={FORMAT_HINT}
          rows={8}
          spellCheck={false}
          className="w-full rounded-2xl border border-line bg-surface p-3 font-mono text-xs outline-none placeholder:text-muted/60 focus:border-accent"
          aria-label="Foods JSON"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={raw.trim().length < 2 || importFoods.isPending}
            onClick={handleImport}
            className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {importFoods.isPending ? 'Importing…' : 'Import'}
          </button>
          {importFoods.isSuccess && (
            <p className="text-sm text-emerald-500">
              Imported {importFoods.data.imported} foods.
            </p>
          )}
        </div>
        {parseError && <p className="text-sm text-rose-500">{parseError}</p>}
        {importFoods.isError && (
          <p className="text-sm text-rose-500">{importFoods.error.message}</p>
        )}
      </section>

      <RecipesImport />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <UtensilsCrossed size={18} className="text-accent" aria-hidden />
            Curated foods
            {foods.data && (
              <span className="rounded-full bg-elev px-2.5 py-0.5 text-xs font-semibold text-muted">
                {foods.data.total}
              </span>
            )}
          </h2>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter…"
            className="w-full max-w-xs rounded-xl border border-line bg-surface px-4 py-2 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-accent"
          />
        </div>
        {foods.data?.foods.length === 0 && (
          <p className="text-sm text-muted">Nothing curated yet — import a guide above.</p>
        )}
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          {foods.data?.foods.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted">
                  {f.brand ? `${f.brand} · ` : ''}
                  {Math.round(f.kcal)} kcal{f.servingName ? ` / ${f.servingName}` : ' /100g'}
                </p>
              </div>
              <button
                type="button"
                disabled={deleteFood.isPending}
                onClick={() => deleteFood.mutate(f.id)}
                aria-label={`Delete ${f.name}`}
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-rose-500 disabled:opacity-50"
              >
                <Trash2 size={15} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        {foods.data && foods.data.foods.length === 100 && (
          <p className="text-xs text-muted">Showing the first 100 — use the filter to narrow.</p>
        )}
      </section>
    </div>
  );
}
