import { useState } from 'react';
import { CalendarDays, Download, Globe, Lock, Trash2, Users } from 'lucide-react';
import type { PlanVisibility, TrainingPlan, Workout } from '@arcadia/shared';
import { TrainingTabs } from '@/components/TrainingTabs';
import {
  useCreatePlan,
  useDeletePlan,
  useImportSharedPlan,
  usePlans,
  useSetPlanDay,
  useSharePlan,
  useSharedPlans,
  useWorkoutsForPlans,
} from '../api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const VISIBILITY_META: Record<PlanVisibility, { label: string; Icon: typeof Lock }> = {
  private: { label: 'Private', Icon: Lock },
  friends: { label: 'Friends', Icon: Users },
  public: { label: 'Public', Icon: Globe },
};

function PlanCard({ plan, workouts }: { plan: TrainingPlan; workouts: Workout[] }) {
  const setDay = useSetPlanDay();
  const deletePlan = useDeletePlan();
  const share = useSharePlan();
  const dayValue = (dayOfWeek: number): string => {
    const day = plan.days.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) return '';
    return day.isRestDay ? 'rest' : (day.workoutId ?? '');
  };

  return (
    <li className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{plan.name}</p>
        <button
          type="button"
          onClick={() => deletePlan.mutate(plan.id)}
          aria-label={`Delete ${plan.name}`}
          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
        >
          <Trash2 size={15} aria-hidden />
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        {DAYS.map((label, dayOfWeek) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-medium text-muted">{label}</span>
            <select
              value={dayValue(dayOfWeek)}
              onChange={(e) => {
                const v = e.target.value;
                setDay.mutate({
                  planId: plan.id,
                  dayOfWeek,
                  value: v === '' ? null : v === 'rest' ? 'rest' : { workoutId: v },
                });
              }}
              aria-label={`${label} assignment`}
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="">—</option>
              <option value="rest">Rest day</option>
              {workouts.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="text-xs font-medium text-muted">Sharing</span>
        <select
          value={plan.visibility}
          onChange={(e) =>
            share.mutate({ plan, workouts, visibility: e.target.value as PlanVisibility })
          }
          aria-label={`${plan.name} visibility`}
          className="rounded-xl border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
        >
          <option value="private">Private — only this device</option>
          <option value="friends">Friends (coming with the friends system)</option>
          <option value="public">Public — anyone can import</option>
        </select>
        {share.isPending && <span className="text-xs text-muted">Saving…</span>}
        {share.isError && <span className="text-xs text-rose-500">{share.error.message}</span>}
        {share.isSuccess && !share.isPending && (
          <span className="text-xs text-accent">Sharing updated ✓</span>
        )}
      </div>
    </li>
  );
}

export function PlansPage() {
  const [name, setName] = useState('');
  const plansQuery = usePlans();
  const workoutsQuery = useWorkoutsForPlans();
  const sharedQuery = useSharedPlans();
  const createPlan = useCreatePlan();
  const importPlan = useImportSharedPlan();

  const workouts = workoutsQuery.data ?? [];
  const community = (sharedQuery.data?.plans ?? []).filter((p) => !p.mine);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createPlan.mutate(trimmed);
    setName('');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Workout plans</h1>
        <p className="text-sm text-muted">
          Map workouts to weekdays. Share plans publicly, with friends, or keep them private.
        </p>
      </header>

      <TrainingTabs />

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="New plan — e.g. Push/Pull/Legs…"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90"
        >
          Create
        </button>
      </div>

      {plansQuery.data?.length === 0 && (
        <p className="text-muted">
          No plans yet. Create one and assign your workouts to days — build the workouts themselves
          under the Workouts tab.
        </p>
      )}
      {workouts.length === 0 && (plansQuery.data?.length ?? 0) > 0 && (
        <p className="text-sm text-muted">
          You have no workouts yet — create some under the Workouts tab to assign them here.
        </p>
      )}

      <ul className="grid items-start gap-3 md:grid-cols-2">
        {plansQuery.data?.map((plan) => (
          <PlanCard key={plan.id} plan={plan} workouts={workouts} />
        ))}
      </ul>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Globe size={18} className="text-accent" aria-hidden />
          Community plans
        </h2>
        {sharedQuery.isError && (
          <p className="text-sm text-muted">Could not load shared plans right now.</p>
        )}
        {sharedQuery.data && community.length === 0 && (
          <p className="text-sm text-muted">
            No public plans yet — share one of yours to get the community going.
          </p>
        )}
        <ul className="grid items-start gap-2 md:grid-cols-2">
          {community.map((shared) => {
            const { Icon } = VISIBILITY_META[shared.visibility];
            return (
              <li
                key={shared.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <CalendarDays size={16} strokeWidth={1.8} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{shared.name}</p>
                  <p className="truncate text-xs text-muted">
                    by {shared.owner}
                    <Icon size={11} className="mb-0.5 ml-1.5 inline" aria-hidden />
                  </p>
                </div>
                <button
                  type="button"
                  disabled={importPlan.isPending}
                  onClick={() => importPlan.mutate(shared.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-elev disabled:opacity-50"
                >
                  <Download size={13} aria-hidden />
                  Import
                </button>
              </li>
            );
          })}
        </ul>
        {importPlan.isSuccess && (
          <p className="text-sm text-accent">Plan imported — it's in "My plans" above ✓</p>
        )}
      </section>
    </div>
  );
}
