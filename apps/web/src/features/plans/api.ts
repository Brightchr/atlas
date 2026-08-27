import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PlanDiet,
  PlanDifficulty,
  PlanGoal,
  PlanReview,
  PlanVisibility,
  SharedPlanPayload,
  SharedPlanSummary,
  TrainingPlan,
  Workout,
} from '@arcadia/shared';
import { apiFetch } from '@/lib/api';
import { listWorkouts } from '@/features/workouts/repository';
import {
  buildPlanPayload,
  createPlan,
  deletePlan,
  getActivePlanId,
  importPlanPayload,
  listPlans,
  renamePlan,
  setActivePlanId,
  setPlanDay,
  setPlanLocalOnly,
  setPlanVisibility,
  updatePlanDescription,
} from './repository';

export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: listPlans });
}

export function useWorkoutsForPlans() {
  return useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });
}

function usePlanMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
      void queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
  });
}

export const useCreatePlan = () => usePlanMutation(createPlan);
export const useUpdatePlanDescription = () =>
  usePlanMutation((args: { planId: string; description: string }) =>
    updatePlanDescription(args.planId, args.description),
  );
export const useDeletePlan = () => usePlanMutation(deletePlan);
export const useSetPlanLocalOnly = () =>
  usePlanMutation((args: { planId: string; localOnly: boolean }) =>
    setPlanLocalOnly(args.planId, args.localOnly),
  );
export const useSetPlanDay = () =>
  usePlanMutation(
    (args: { planId: string; dayOfWeek: number; value: { workoutId: string } | 'rest' | null }) =>
      setPlanDay(args.planId, args.dayOfWeek, args.value),
  );

/** Community plans: public ones plus the caller's own shares. */
export function useSharedPlans() {
  return useQuery({
    queryKey: ['plans', 'shared'],
    queryFn: () => apiFetch<{ plans: SharedPlanSummary[] }>('/v1/plans'),
    retry: 1,
  });
}

/** Publish (or republish) a plan with the chosen visibility and discovery
 * tags. The local visibility field is updated alongside so the UI reflects
 * the share state. */
export function useSharePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      plan: TrainingPlan;
      workouts: Workout[];
      visibility: PlanVisibility;
      difficulty?: PlanDifficulty;
      goal?: PlanGoal;
      diet?: PlanDiet | null;
      /** Fresh creator notes — beats the (possibly stale) plan.description. */
      description?: string;
    }) => {
      await setPlanVisibility(args.plan.id, args.visibility);
      if (args.visibility === 'private') {
        // Going private removes any existing share of this plan.
        await apiFetch(`/v1/plans/local/${args.plan.id}`, { method: 'DELETE' });
        return;
      }
      await apiFetch('/v1/plans', {
        method: 'PUT',
        body: JSON.stringify({
          localPlanId: args.plan.id,
          name: args.plan.name,
          description: args.description ?? args.plan.description ?? '',
          visibility: args.visibility,
          difficulty: args.difficulty ?? 'intermediate',
          goal: args.goal ?? 'general',
          diet: args.diet ?? null,
          payload: buildPlanPayload(args.plan, args.workouts),
        }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

/** One shared plan in full: summary fields plus the embedded payload. */
export function useSharedPlanDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['plans', 'shared', id],
    queryFn: () =>
      apiFetch<SharedPlanSummary & { payload: SharedPlanPayload }>(`/v1/plans/${id}`),
    enabled: Boolean(id),
  });
}

/** Reviews for one shared plan. */
export function usePlanReviews(planId: string | null) {
  return useQuery({
    queryKey: ['plans', 'reviews', planId],
    queryFn: () => apiFetch<{ reviews: PlanReview[] }>(`/v1/plans/${planId}/reviews`),
    enabled: planId !== null,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { planId: string; rating: number; comment: string }) =>
      apiFetch(`/v1/plans/${args.planId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating: args.rating, comment: args.comment }),
      }),
    onSuccess: (_data, args) => {
      void queryClient.invalidateQueries({ queryKey: ['plans', 'reviews', args.planId] });
      void queryClient.invalidateQueries({ queryKey: ['plans', 'shared'] });
    },
  });
}

/** Send one of your published plans directly to another user by username. */
export function useSendPlan() {
  return useMutation({
    mutationFn: (args: { planId: string; username: string }) =>
      apiFetch(`/v1/plans/${args.planId}/share`, {
        method: 'POST',
        body: JSON.stringify({ username: args.username }),
      }),
  });
}

/** Pull a shared plan's payload and recreate it (plan + workouts) locally. */
export function useImportSharedPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const shared = await apiFetch<{ payload: SharedPlanPayload }>(`/v1/plans/${id}`);
      return importPlanPayload(shared.payload, {
        kind: 'community',
        ref: id,
        name: shared.payload.name,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
      void queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
  });
}

/** Take one of your published plans off the community listing. Your local
 * copy (if you still have one) is untouched. */
export function useDeleteSharedPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/v1/plans/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans', 'shared'] });
    },
  });
}

/** The plan the user is following (null = none chosen). */
export function useActivePlanId() {
  return useQuery({ queryKey: ['plans', 'active'], queryFn: getActivePlanId });
}

export function useSetActivePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | null) => setActivePlanId(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useRenamePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renamePlan(id, name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['plans'] }),
  });
}
