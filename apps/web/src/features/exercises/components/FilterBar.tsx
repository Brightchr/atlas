// The filter chip bar for the exercise list. YOU are building this component —
// follow the numbered TODOs. It receives everything via props and owns NO state
// itself (a "controlled component": the page is the single source of truth).

import type { Exercise } from '@arcadia/shared';
// TODO(step 3a): import ExerciseFilters from '@/lib/wger/client' once step 1a is done.

interface FilterBarProps {
  /** Full catalog — used only to derive which filter options exist. */
  exercises: Exercise[];
  // TODO(step 3b): add `filters: ExerciseFilters` and `onChange: (next: ExerciseFilters) => void`.
}

// TODO(step 3c): Derive the available options from `exercises`:
//   - unique primary muscles (id + commonName), sorted by name
//   - unique equipment (id + name), sorted by name
//   - unique categories (id + name), sorted by name
// Hint: build a Map keyed by id while looping, then [...map.values()].
// Do this INSIDE the component body — it's cheap for ~900 items, no memo needed yet.

// TODO(step 3d): Render three horizontal chip rows (overflow-x-auto on mobile):
//   - a chip per muscle/equipment/category
//   - clicking a chip toggles its id in/out of the corresponding filters array
//     (categories: single-select — clicking the active one clears it)
//   - active chip: "bg-accent text-accent-ink"; inactive: "bg-surface border border-line text-muted"
//   - when ANY filter is active, show a "Clear all" button that calls onChange with empty filters
// Look at how AppLayout renders navItems with .map() — same pattern.

export function FilterBar({ exercises }: FilterBarProps) {
  void exercises; // TODO(step 3e): remove this line once you use the props.
  return null; // TODO(step 3f): replace with your JSX.
}
