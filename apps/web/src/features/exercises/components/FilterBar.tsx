import { X } from 'lucide-react';
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

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-transparent bg-accent text-accent-ink shadow-sm'
          : 'border-line bg-surface text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-semibold tracking-wide text-muted uppercase">
        {label}
      </span>
      <div className="-my-1 flex gap-1.5 overflow-x-auto py-1">{children}</div>
    </div>
  );
}

/** Controlled facet-filter bar: the page owns the state, this renders it. */
export function FilterBar({ exercises, filters, onChange }: FilterBarProps) {
  const options = deriveOptions(exercises);
  const active = hasActiveFilters(filters);

  return (
    <div className="space-y-2">
      <ChipRow label="Category">
        {options.categories.map(({ id, name }) => (
          <Chip
            key={id}
            label={name}
            active={filters.categoryId === id}
            onClick={() =>
              onChange({ ...filters, categoryId: filters.categoryId === id ? null : id })
            }
          />
        ))}
      </ChipRow>
      <ChipRow label="Muscle">
        {options.muscles.map(({ id, name }) => (
          <Chip
            key={id}
            label={name}
            active={filters.muscleIds.includes(id)}
            onClick={() => onChange({ ...filters, muscleIds: toggleId(filters.muscleIds, id) })}
          />
        ))}
      </ChipRow>
      <ChipRow label="Equipment">
        {options.equipment.map(({ id, name }) => (
          <Chip
            key={id}
            label={name}
            active={filters.equipmentIds.includes(id)}
            onClick={() =>
              onChange({ ...filters, equipmentIds: toggleId(filters.equipmentIds, id) })
            }
          />
        ))}
      </ChipRow>
      {active && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <X size={12} aria-hidden />
          Clear all filters
        </button>
      )}
    </div>
  );
}
