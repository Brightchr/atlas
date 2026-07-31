import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
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
  importPlanPayload,
  listPlans,
  setPlanDay,
  setPlanVisibility,
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
export const useDeletePlan = () => usePlanMutation(deletePlan);
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

/** Publish (or republish) a plan with the chosen visibility. The local
 * visibility field is updated alongside so the UI reflects the share state. */
export function useSharePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      plan: TrainingPlan;
      workouts: Workout[];
      visibility: PlanVisibility;
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
          description: args.plan.description ?? '',
          visibility: args.visibility,
          payload: buildPlanPayload(args.plan, args.workouts),
        }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

/** Pull a shared plan's payload and recreate it (plan + workouts) locally. */
export function useImportSharedPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const shared = await apiFetch<{ payload: SharedPlanPayload }>(`/v1/plans/${id}`);
      return importPlanPayload(shared.payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
      void queryClient.invalidateQueries({ queryKey: ['workouts'] });
    },
  });
}
