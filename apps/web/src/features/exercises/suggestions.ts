import type { Exercise, Goal } from '@arcadia/shared';

/** The suggestion engine: recommends exercises from what the user is chasing
 * (muscle-focus goals) and what they are neglecting (muscles untrained or
 * stale in their recent history), with variety (skip recently performed
 * exercises). Pure function — no I/O, fully unit-testable.
 *
 * Ranking order (Fitbod-style):
 *   1. goal focus     — muscles the user explicitly wants to grow
 *   2. stale          — muscles trained before but not in the last few days
 *                       (most-neglected first)
 *   3. untouched      — muscles with no training history at all
 */

export interface ExerciseSuggestion {
  exercise: Exercise;
  reason: string;
}

const STALE_AFTER_DAYS = 4;
const PER_MUSCLE_LIMIT = 2;

export function buildSuggestions(options: {
  catalog: Exercise[];
  recentSets: { exerciseId: number; completedAt: string }[];
  goals: Goal[];
  limit?: number;
}): ExerciseSuggestion[] {
  const { catalog, recentSets, goals, limit = 8 } = options;
  const byId = new Map(catalog.map((e) => [e.id, e]));

  // What has been trained, per muscle, and which exercises were done recently.
  const lastTrained = new Map<number, string>();
  const doneExerciseIds = new Set<number>();
  for (const set of recentSets) {
    doneExerciseIds.add(set.exerciseId);
    const exercise = byId.get(set.exerciseId);
    const date = set.completedAt.slice(0, 10);
    for (const muscle of exercise?.primaryMuscles ?? []) {
      if ((lastTrained.get(muscle.id) ?? '') < date) lastTrained.set(muscle.id, date);
    }
  }

  const allMuscles = new Map<number, string>();
  for (const e of catalog) for (const m of e.primaryMuscles) allMuscles.set(m.id, m.commonName);

  const focusGoals = goals.filter((g) => g.type === 'muscle_focus' && g.muscleId !== null);
  const focusIds = new Set(focusGoals.map((g) => g.muscleId!));
  const hasHistory = recentSets.length > 0;

  interface RankedMuscle {
    id: number;
    reason: string;
  }
  const focus: RankedMuscle[] = focusGoals.map((g) => ({
    id: g.muscleId!,
    reason: `Supports your “${g.title}” goal`,
  }));
  const stale: (RankedMuscle & { days: number })[] = [];
  const untouched: RankedMuscle[] = [];

  for (const [id, name] of allMuscles) {
    if (focusIds.has(id)) continue;
    const last = lastTrained.get(id);
    if (!last) {
      untouched.push({
        id,
        reason: hasHistory ? `You haven't trained ${name} recently` : `A place to start: ${name}`,
      });
    } else {
      const days = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000);
      if (days >= STALE_AFTER_DAYS) {
        stale.push({ id, reason: `No ${name} work in ${days} days`, days });
      }
    }
  }
  stale.sort((a, b) => b.days - a.days);

  const rankedMuscles = [...focus, ...stale, ...untouched];

  // Fill suggestions round-robin: a couple per muscle, variety over repetition,
  // exercises with images first (nicer cards).
  const suggestions: ExerciseSuggestion[] = [];
  const used = new Set<number>();
  for (const muscle of rankedMuscles) {
    if (suggestions.length >= limit) break;
    const candidates = catalog
      .filter(
        (e) =>
          e.primaryMuscles.some((m) => m.id === muscle.id) &&
          !doneExerciseIds.has(e.id) &&
          !used.has(e.id),
      )
      .sort((a, b) => (b.imageUrls.length > 0 ? 1 : 0) - (a.imageUrls.length > 0 ? 1 : 0));
    for (const exercise of candidates.slice(0, PER_MUSCLE_LIMIT)) {
      if (suggestions.length >= limit) break;
      used.add(exercise.id);
      suggestions.push({ exercise, reason: muscle.reason });
    }
  }
  return suggestions;
}
