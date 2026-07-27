import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { createWorkout, deleteWorkout, listWorkouts } from '../repository';

export function WorkoutsPage() {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();

  const workoutsQuery = useQuery({ queryKey: ['workouts'], queryFn: listWorkouts });

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
            className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm"
          >
            <div>
              <p className="font-semibold">{workout.name}</p>
              <p className="text-sm text-muted">
                {workout.exercises.length} exercise{workout.exercises.length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(workout.id)}
              className="rounded-lg p-2 text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-500"
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
