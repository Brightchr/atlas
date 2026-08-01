import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Play, Trash2 } from 'lucide-react';
import { TrainingTabs } from '@/components/TrainingTabs';
import { createWorkout, deleteWorkout, getOpenSession, listWorkouts } from '../repository';

export function WorkoutsPage() {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();

  const workoutsQuery = useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });
  const openSessionQuery = useQuery({ queryKey: ['sessions', 'open'], queryFn: getOpenSession });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['workouts'] });
  const createMutation = useMutation({ mutationFn: createWorkout, onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: deleteWorkout, onSuccess: invalidate });

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
    setName('');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Workouts</h1>
        <p className="text-sm text-muted">Your workout templates, stored on this device.</p>
      </header>

      <TrainingTabs />

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="New workout name…"
          className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90"
        >
          Add
        </button>
      </div>

      {openSessionQuery.data && (
        <Link
          to={`/workouts/session/${openSessionQuery.data.id}`}
          className="flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="flex items-center gap-2.5 text-sm font-semibold">
            <Play size={16} className="text-accent" aria-hidden />
            Workout in progress: {openSessionQuery.data.workoutName}
          </span>
          <span className="text-xs font-medium text-accent">Resume</span>
        </Link>
      )}

      {workoutsQuery.isError && (
        <p className="text-rose-500">Local database unavailable — workouts cannot be loaded.</p>
      )}
      {workoutsQuery.data?.length === 0 && (
        <p className="text-muted">No workouts yet. Create one above to get started.</p>
      )}
      <ul className="grid gap-2 md:grid-cols-2">
        {workoutsQuery.data?.map((workout) => (
          <li
            key={workout.id}
            className="flex items-center gap-2 rounded-2xl border border-line bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <Link to={`/workouts/${workout.id}`} className="flex min-w-0 flex-1 items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{workout.name}</span>
                <span className="block text-sm text-muted">
                  {workout.exercises.length} exercise{workout.exercises.length === 1 ? '' : 's'} —
                  view, edit &amp; start
                </span>
              </span>
              <ChevronRight size={17} className="shrink-0 text-muted" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(workout.id)}
              className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-500"
              aria-label={`Delete ${workout.name}`}
            >
              <Trash2 size={17} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
