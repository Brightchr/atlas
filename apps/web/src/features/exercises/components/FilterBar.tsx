import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { Exercise } from '@arcadia/shared';
import { hasActiveFilters, type ExerciseFilters, EMPTY_FILTERS } from '@/lib/wger/client';

interface Option {
  id: number;
  name: string;
}

interface FilterBarProps {
  /** Full catalog — used only to derive which filter options exist. */
  exercises: Exercise[];
  filters: ExerciseFilters;
  onChange: (next: ExerciseFilters) => void;
}

type FacetKey = 'category' | 'muscle' | 'equipment';

/** Dedupe by id via Map, then sort by name. */
function deriveOptions(exercises: Exercise[]) {
  const muscles = new Map<number, string>();
  const equipment = new Map<number, string>();
  const categories = new Map<number, string>();
  for (const e of exercises) {
    for (const m of e.primaryMuscles) muscles.set(m.id, m.commonName);
    for (const eq of e.equipment) equipment.set(eq.id, eq.name);
    if (e.category) categories.set(e.category.id, e.category.name);
  }
  const sorted = (map: Map<number, string>): Option[] =>
    [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  return { muscles: sorted(muscles), equipment: sorted(equipment), categories: sorted(categories) };
}

function toggleId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Compact faceted filtering: one toolbar of pill buttons with active counts;
 * tapping one expands a wrapped chip panel below — no sideways scrolling, easy
 * thumb targets on mobile. Controlled component: the page owns the state. */
export function FilterBar({ exercises, filters, onChange }: FilterBarProps) {
  const [openFacet, setOpenFacet] = useState<FacetKey | null>(null);
  const options = deriveOptions(exercises);
  const active = hasActiveFilters(filters);

  const facets: { key: FacetKey; label: string; count: number }[] = [
    { key: 'category', label: 'Category', count: filters.categoryId !== null ? 1 : 0 },
    { key: 'muscle', label: 'Muscle', count: filters.muscleIds.length },
    { key: 'equipment', label: 'Equipment', count: filters.equipmentIds.length },
  ];

  const toggleFacet = (key: FacetKey) => setOpenFacet((cur) => (cur === key ? null : key));

  const chip = (label: string, isActive: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        isActive
          ? 'border-transparent bg-accent text-accent-ink shadow-sm'
          : 'border-line bg-surface text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {facets.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            aria-expanded={openFacet === key}
            onClick={() => toggleFacet(key)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium shadow-sm transition-colors ${
              openFacet === key || count > 0
                ? 'border-accent/40 bg-accent-soft text-accent'
                : 'border-line bg-surface text-muted hover:text-ink'
            }`}
          >
            {label}
            {count > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
                {count}
              </span>
            )}
            <ChevronDown
              size={14}
              aria-hidden
              className={`transition-transform ${openFacet === key ? 'rotate-180' : ''}`}
            />
          </button>
        ))}
        {active && (
          <button
            type="button"
            onClick={() => {
              onChange(EMPTY_FILTERS);
              setOpenFacet(null);
            }}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            <X size={13} aria-hidden />
            Clear
          </button>
        )}
      </div>

      {openFacet && (
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-surface p-3 shadow-sm">
          {openFacet === 'category' &&
            options.categories.map(({ id, name }) =>
              chip(name, filters.categoryId === id, () =>
                onChange({ ...filters, categoryId: filters.categoryId === id ? null : id }),
              ),
            )}
          {openFacet === 'muscle' &&
            options.muscles.map(({ id, name }) =>
              chip(name, filters.muscleIds.includes(id), () =>
                onChange({ ...filters, muscleIds: toggleId(filters.muscleIds, id) }),
              ),
            )}
          {openFacet === 'equipment' &&
            options.equipment.map(({ id, name }) =>
              chip(name, filters.equipmentIds.includes(id), () =>
                onChange({ ...filters, equipmentIds: toggleId(filters.equipmentIds, id) }),
              ),
            )}
        </div>
      )}
    </div>
  );
}
