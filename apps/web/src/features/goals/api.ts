import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Exercise, GoalProgress } from '@arcadia/shared';
import { getDiaryForDate } from '@/features/nutrition/repository';
import { formatWeight, useUnits } from '@/lib/units';
import { goalProgress } from './progress';
import {
  archiveGoal,
  createGoal,
  getRecentLoggedSets,
  getSessionDates,
  getWeightHistory,
  listGoals,
  logBodyWeight,
} from './repository';

/** Sets per primary muscle over the last 7 days — needs the catalog to map
 * exercise ids to muscles. */
export function weeklySetsPerMuscle(
  catalog: Exercise[],
  recentSets: { exerciseId: number; completedAt: string }[],
): Map<number, number> {
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const perMuscle = new Map<number, number>();
  for (const set of recentSets) {
    if (set.completedAt < weekAgo) continue;
    const exercise = byId.get(set.exerciseId);
    for (const muscle of exercise?.primaryMuscles ?? []) {
      perMuscle.set(muscle.id, (perMuscle.get(muscle.id) ?? 0) + 1);
    }
  }
  return perMuscle;
}

/** Goals with computed progress. `catalog` comes from useExerciseCatalog so the
 * exercise data is shared with the rest of the app. */
export function useGoalProgress(catalog: Exercise[] | undefined) {
  const units = useUnits();
  return useQuery({
    queryKey: ['goals', 'progress', catalog ? 'with-catalog' : 'no-catalog', units],
    queryFn: async (): Promise<GoalProgress[]> => {
      const today = new Date().toISOString().slice(0, 10);
      const [goals, sessionDates, weightHistory, diary, recentSets] = await Promise.all([
        listGoals(),
        getSessionDates(60),
        getWeightHistory(120),
        getDiaryForDate(today),
        getRecentLoggedSets(7),
      ]);
      const totals = diary.reduce(
        (acc, e) => ({ kcal: acc.kcal + e.macros.kcal, proteinG: acc.proteinG + e.macros.proteinG }),
        { kcal: 0, proteinG: 0 },
      );
      const inputs = {
        sessionDates,
        weightHistory,
        todayKcal: totals.kcal,
        todayProteinG: totals.proteinG,
        weeklySetsPerMuscle: weeklySetsPerMuscle(catalog ?? [], recentSets),
        formatWeight: (kg: number) => formatWeight(kg, units),
      };
      return goals.map((goal) => goalProgress(goal, inputs));
    },
  });
}

function useGoalMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
      void queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });
}

export function useCreateGoal() {
  return useGoalMutation(createGoal);
}

export function useArchiveGoal() {
  return useGoalMutation(archiveGoal);
}

export function useLogWeight() {
  return useGoalMutation(logBodyWeight);
}
