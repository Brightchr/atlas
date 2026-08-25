import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Mountain } from 'lucide-react';
import { upsertTargetGoal } from '@/features/goals/repository';
import {
  GOAL_OPTIONS,
  LEVEL_OPTIONS,
  useSaveTrainingProfile,
  useTrainingProfile,
  type TrainingGoal,
  type TrainingLevel,
} from '../profile';

const DAY_CHOICES = [2, 3, 4, 5, 6];

/** Onboarding: pick a goal, a level, and a weekly commitment. Everything the
 * app recommends — plans, workouts, catalog defaults — filters through this.
 * Also reachable later from Settings to change course. */
export function WelcomePage() {
  const existing = useTrainingProfile();
  const save = useSaveTrainingProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [goal, setGoal] = useState<TrainingGoal | null>(existing.data?.goal ?? null);
  const [level, setLevel] = useState<TrainingLevel | null>(existing.data?.level ?? null);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(existing.data?.daysPerWeek ?? 3);

  const ready = goal !== null && level !== null;

  const finish = () => {
    if (!goal || !level) return;
    save.mutate(
      { goal, level, daysPerWeek },
      {
        onSuccess: async () => {
          // The weekly commitment becomes a real, trackable goal — the
          // answers must show up on the Goals page, not just steer
          // recommendations invisibly.
          await upsertTargetGoal('workout_frequency', 'Train weekly', daysPerWeek).catch(
            () => undefined,
          );
          void queryClient.invalidateQueries({ queryKey: ['goals'] });
          void navigate(existing.data ? '/settings' : '/', { replace: true });
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pt-8 md:p-6 md:pt-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-accent-ink shadow-md">
          <Mountain size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold">What are you training for?</h1>
          <p className="mt-1 text-sm text-muted">
            Your answers shape everything: recommended plans, suggested workouts, and what you see
            first. Change them any time in Settings.
          </p>
        </div>
      </header>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Your goal</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {GOAL_OPTIONS.map(({ id, label, hint }) => (
            <button
              key={id}
              type="button"
              aria-pressed={goal === id}
              onClick={() => setGoal(id)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                goal === id ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface hover:bg-elev'
              }`}
            >
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
              {goal === id && <Check size={16} className="shrink-0 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Your experience</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {LEVEL_OPTIONS.map(({ id, label, hint }) => (
            <button
              key={id}
              type="button"
              aria-pressed={level === id}
              onClick={() => setLevel(id)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                level === id ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface hover:bg-elev'
              }`}
            >
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
              {level === id && <Check size={16} className="shrink-0 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Days per week you can train</h2>
        <div className="flex flex-wrap gap-1.5">
          {DAY_CHOICES.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={daysPerWeek === d}
              onClick={() => setDaysPerWeek(d)}
              className={`h-11 w-11 rounded-xl border text-sm font-semibold transition-colors ${
                daysPerWeek === d
                  ? 'border-transparent bg-accent text-accent-ink shadow-sm'
                  : 'border-line bg-surface text-muted hover:text-ink'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        disabled={!ready || save.isPending}
        onClick={finish}
        className="w-full rounded-xl bg-linear-to-r from-accent to-accent-2 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {existing.data ? 'Save changes' : "Let's train"}
      </button>
    </div>
  );
}
