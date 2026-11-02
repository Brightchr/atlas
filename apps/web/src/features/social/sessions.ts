import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  SharedSessionPayload,
  SharedSessionSummary,
  SharedSessionVisibility,
  WorkoutSession,
} from '@arcadia/shared';
import { apiFetch } from '@/lib/api';

/** Sharing finished workouts: the device builds a snapshot, the server
 * stores it and gates who may read it. Nothing here touches the local DB. */

/** Exercises in session order, each with its logged sets. Exercises with no
 * sets are left out — a shared workout is what you did, not what you
 * planned. */
export function buildSessionSharePayload(session: WorkoutSession): SharedSessionPayload {
  const order = new Map(session.exercises.map((e, i) => [e.exerciseId, i]));
  const byExercise = new Map<
    number,
    { name: string; sets: SharedSessionPayload['exercises'][number]['sets'] }
  >();
  for (const set of session.sets) {
    const entry = byExercise.get(set.exerciseId) ?? { name: set.exerciseName, sets: [] };
    entry.sets.push({ reps: set.reps, weightKg: set.weightKg, durationSec: set.durationSec });
    byExercise.set(set.exerciseId, entry);
  }
  const exercises = [...byExercise.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9))
    .map(([, e]) => e);
  const totals = exercises.reduce(
    (acc, e) => {
      acc.sets += e.sets.length;
      acc.volumeKg += e.sets.reduce((v, s) => v + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
      return acc;
    },
    { sets: 0, volumeKg: 0 },
  );
  const payload: SharedSessionPayload = {
    exercises,
    totals: { ...totals, volumeKg: Math.round(totals.volumeKg) },
  };
  if (session.notes) payload.notes = session.notes;
  return payload;
}

export function useWorkoutFeed() {
  return useQuery({
    queryKey: ['social', 'workout-feed'],
    queryFn: () => apiFetch<{ sessions: SharedSessionSummary[] }>('/v1/sessions/feed'),
    retry: 1,
  });
}

export function useShareSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { session: WorkoutSession; visibility: SharedSessionVisibility }) => {
      const { session, visibility } = args;
      const durationSec = session.finishedAt
        ? Math.max(
            0,
            Math.round((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 1000),
          )
        : 0;
      return apiFetch<SharedSessionSummary>('/v1/sessions/shared', {
        method: 'PUT',
        body: JSON.stringify({
          localSessionId: session.id,
          name: session.workoutName,
          performedAt: session.startedAt,
          durationSec,
          visibility,
          payload: buildSessionSharePayload(session),
        }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social', 'workout-feed'] }),
  });
}

export function useUnshareSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (localSessionId: string) =>
      apiFetch<void>(`/v1/sessions/shared/${localSessionId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social', 'workout-feed'] }),
  });
}
