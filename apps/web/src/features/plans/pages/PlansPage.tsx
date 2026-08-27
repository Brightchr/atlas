import { useState } from 'react';
import { Link } from 'react-router';
import {
  CalendarDays,
  CheckCircle2,
  Download,
  Globe,
  Lock,
  MessageSquare,
  MonitorSmartphone,
  Send,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import type {
  PlanDiet,
  PlanDifficulty,
  PlanGoal,
  PlanVisibility,
  SharedPlanSummary,
  TrainingPlan,
  Workout,
} from '@arcadia/shared';
import { DIET_LABELS, GOAL_LABELS, LEVEL_LABELS, useTrainingProfile } from '@/features/training/profile';
import {
  useActivePlanId,
  useCreatePlan,
  useDeletePlan,
  useDeleteSharedPlan,
  useImportSharedPlan,
  usePlans,
  useRenamePlan,
  useSendPlan,
  useSetActivePlan,
  useSetPlanDay,
  useSetPlanLocalOnly,
  useSharePlan,
  useSharedPlans,
  useUpdatePlanDescription,
  useWorkoutsForPlans,
} from '../api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const VISIBILITY_META: Record<PlanVisibility, { label: string; Icon: typeof Lock }> = {
  private: { label: 'Private', Icon: Lock },
  friends: { label: 'Friends', Icon: Users },
  public: { label: 'Public', Icon: Globe },
};

function Stars({ rating, count }: { rating: number | null; count: number }) {
  if (rating === null) return <span className="text-xs text-muted">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="flex" aria-label={`Rated ${rating} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={12}
            className={i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-line'}
            aria-hidden
          />
        ))}
      </span>
      <span className="font-semibold tabular-nums">{rating}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
}

function TagRow({ plan }: { plan: SharedPlanSummary }) {
  return (
    <span className="flex flex-wrap gap-1">
      <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
        {GOAL_LABELS[plan.goal]}
      </span>
      <span className="rounded-full bg-elev px-1.5 py-0.5 text-[10px] font-semibold text-muted">
        {LEVEL_LABELS[plan.difficulty]}
      </span>
      {plan.diet && (
        <span className="rounded-full bg-elev px-1.5 py-0.5 text-[10px] font-semibold text-muted">
          {DIET_LABELS[plan.diet]}
        </span>
      )}
    </span>
  );
}

/** One community plan: identity, tags, rating — the card links through to the
 * full detail page (workouts, exercises, diet, reviews). */
function CommunityCard({ shared }: { shared: SharedPlanSummary }) {
  const importPlan = useImportSharedPlan();
  const removeShare = useDeleteSharedPlan();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const { Icon } = VISIBILITY_META[shared.visibility];

  return (
    <li className="rounded-2xl border border-line bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <CalendarDays size={16} strokeWidth={1.8} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={`/plans/community/${shared.id}`}
            className="block truncate text-sm font-semibold hover:underline"
          >
            {shared.name}
          </Link>
          <p className="truncate text-xs text-muted">
            by{' '}
            <Link to={`/users/${shared.owner}`} className="font-medium text-accent hover:underline">
              {shared.owner}
            </Link>
            {shared.mine && (
              <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                you
              </span>
            )}
            {shared.sharedToMe && (
              <span className="ml-1.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                sent to you
              </span>
            )}
            <Icon size={11} className="mb-0.5 ml-1.5 inline" aria-hidden />
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {shared.mine &&
            (confirmingRemove ? (
              <>
                <button
                  type="button"
                  disabled={removeShare.isPending}
                  onClick={() => removeShare.mutate(shared.id)}
                  className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-600 disabled:opacity-50"
                >
                  Unpublish
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  className="rounded-lg px-2 py-1.5 text-xs text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                aria-label={`Unpublish ${shared.name}`}
                data-tip="Unpublish from the community"
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            ))}
          <button
            type="button"
            disabled={importPlan.isPending}
            onClick={() => importPlan.mutate(shared.id)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-elev disabled:opacity-50"
          >
            <Download size={13} aria-hidden />
            {importPlan.isSuccess ? 'Imported ✓' : 'Import'}
          </button>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <TagRow plan={shared} />
        <Link
          to={`/plans/community/${shared.id}`}
          className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-ink"
        >
          <Stars rating={shared.rating} count={shared.reviewCount} />
          <MessageSquare size={12} aria-hidden />
        </Link>
      </div>
    </li>
  );
}

function PlanCard({
  plan,
  workouts,
  active,
}: {
  plan: TrainingPlan;
  workouts: Workout[];
  active: boolean;
}) {
  const setDay = useSetPlanDay();
  const deletePlan = useDeletePlan();
  const setLocalOnly = useSetPlanLocalOnly();
  const share = useSharePlan();
  const sendPlan = useSendPlan();
  const shared = useSharedPlans();
  const profile = useTrainingProfile();
  const updateDescription = useUpdatePlanDescription();
  const setActive = useSetActivePlan();
  const rename = useRenamePlan();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(plan.name);
  const [difficulty, setDifficulty] = useState<PlanDifficulty>('intermediate');
  // Every published plan carries a goal; it defaults to the creator's own.
  const [goalChoice, setGoalChoice] = useState<PlanGoal | null>(null);
  const goal = goalChoice ?? profile.data?.goal ?? 'general';
  const [diet, setDiet] = useState<PlanDiet | ''>('');
  const [notes, setNotes] = useState(plan.description ?? '');
  const [recipient, setRecipient] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const publishedId = shared.data?.plans.find(
    (p) => p.mine && p.name === plan.name,
  )?.id;

  const dayValue = (dayOfWeek: number): string => {
    const day = plan.days.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) return '';
    return day.isRestDay ? 'rest' : (day.workoutId ?? '');
  };

  const republish = (patch: {
    visibility?: PlanVisibility;
    difficulty?: PlanDifficulty;
    goal?: PlanGoal;
    diet?: PlanDiet | null;
    description?: string;
  }) =>
    share.mutate({
      plan,
      workouts,
      description: patch.description ?? notes,
      visibility: patch.visibility ?? plan.visibility,
      difficulty: patch.difficulty ?? difficulty,
      goal: patch.goal ?? goal,
      diet: patch.diet !== undefined ? patch.diet : diet || null,
    });

  return (
    <li
      className={`rounded-2xl border bg-surface p-4 shadow-sm ${
        active ? 'border-accent/60 ring-1 ring-accent/25' : 'border-line'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {renaming ? (
            <span className="flex items-center gap-1.5">
              <input
                value={newName}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    rename.mutate({ id: plan.id, name: newName.trim() });
                    setRenaming(false);
                  }
                  if (e.key === 'Escape') setRenaming(false);
                }}
                aria-label="Plan name"
                className="rounded-lg border border-line bg-surface px-2 py-1 text-sm font-semibold outline-none focus:border-accent"
              />
              <button
                type="button"
                disabled={!newName.trim()}
                onClick={() => {
                  rename.mutate({ id: plan.id, name: newName.trim() });
                  setRenaming(false);
                }}
                className="rounded-lg bg-accent-soft px-2 py-1 text-xs font-semibold text-accent"
              >
                Save
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNewName(plan.name);
                setRenaming(true);
              }}
              title="Rename plan"
              className="text-left font-semibold hover:underline"
            >
              {plan.name}
            </button>
          )}
          {plan.basedOnName && (
            <p className="text-xs text-muted">
              based on{' '}
              <Link
                to={
                  plan.basedOnKind === 'catalog'
                    ? `/train/explore/plan/${plan.basedOnRef}`
                    : `/plans/community/${plan.basedOnRef}`
                }
                className="text-accent hover:underline"
              >
                {plan.basedOnName}
              </Link>
            </p>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-500">
              <CheckCircle2 size={13} aria-hidden />
              Active
            </span>
          ) : (
            <button
              type="button"
              disabled={setActive.isPending}
              onClick={() => setActive.mutate(plan.id)}
              title="Make this the plan your Today card and adherence follow"
              className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted transition-colors hover:bg-elev hover:text-ink disabled:opacity-50"
            >
              Use this plan
            </button>
          )}
        {confirmingDelete ? (
          <span className="flex shrink-0 items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => deletePlan.mutate(plan.id)}
              className="rounded-lg bg-rose-500/10 px-2 py-1 font-semibold text-rose-600"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg px-2 py-1 text-muted hover:text-ink"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${plan.name}`}
            className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
          >
            <Trash2 size={15} aria-hidden />
          </button>
        )}
        </span>
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

      <div className="mt-3 space-y-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Sharing</span>
          {/* One control, four levels: the first three all sync to your
              account and differ only in who can SEE the plan; "device only"
              is the odd one out — it un-syncs the plan entirely. */}
          <select
            value={plan.localOnly ? 'device' : plan.visibility}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'device') {
                setLocalOnly.mutate({ planId: plan.id, localOnly: true });
                // Un-publish too — a device-only plan shouldn't stay visible.
                if (plan.visibility !== 'private') republish({ visibility: 'private' });
              } else {
                if (plan.localOnly) setLocalOnly.mutate({ planId: plan.id, localOnly: false });
                republish({ visibility: value as PlanVisibility });
              }
            }}
            aria-label={`${plan.name} visibility`}
            className="min-w-0 max-w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          >
            <option value="private">Private — just you, still syncs</option>
            <option value="friends">Friends only — syncs, friends can see it</option>
            <option value="public">Public — anyone can import</option>
            <option value="device">Device only — never syncs</option>
          </select>
          {(share.isPending || setLocalOnly.isPending) && (
            <span className="text-xs text-muted">Saving…</span>
          )}
          {share.isError && <span className="text-xs text-rose-500">{share.error.message}</span>}
          {share.isSuccess && !share.isPending && (
            <span className="text-xs text-accent">Sharing updated ✓</span>
          )}
          {plan.localOnly && (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <MonitorSmartphone size={12} aria-hidden />
              pinned to this device
            </span>
          )}
        </div>

        {plan.visibility !== 'private' && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={goal}
                onChange={(e) => {
                  setGoalChoice(e.target.value as PlanGoal);
                  republish({ goal: e.target.value as PlanGoal });
                }}
                aria-label="Plan goal"
                className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
              >
                {Object.entries(GOAL_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    Goal: {label}
                  </option>
                ))}
              </select>
              <select
                value={difficulty}
                onChange={(e) => {
                  setDifficulty(e.target.value as PlanDifficulty);
                  republish({ difficulty: e.target.value as PlanDifficulty });
                }}
                aria-label="Plan difficulty"
                className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
              >
                {Object.entries(LEVEL_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    Difficulty: {label}
                  </option>
                ))}
              </select>
              <select
                value={diet}
                onChange={(e) => {
                  setDiet(e.target.value as PlanDiet | '');
                  republish({ diet: (e.target.value || null) as PlanDiet | null });
                }}
                aria-label="Paired diet"
                className="rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
              >
                <option value="">No paired diet</option>
                {Object.entries(DIET_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>
                    Diet: {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-start gap-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes for people using this plan — who it's for, how to progress it…"
                rows={2}
                maxLength={500}
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs outline-none placeholder:text-muted/70 focus:border-accent"
              />
              <button
                type="button"
                disabled={updateDescription.isPending}
                onClick={() => {
                  updateDescription.mutate({ planId: plan.id, description: notes });
                  republish({ description: notes });
                }}
                className="shrink-0 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold hover:bg-elev disabled:opacity-50"
              >
                Save notes
              </button>
            </div>

            {publishedId && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted">Send to</span>
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="username"
                  className="w-36 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent"
                />
                <button
                  type="button"
                  disabled={!recipient.trim() || sendPlan.isPending}
                  onClick={() =>
                    sendPlan.mutate(
                      { planId: publishedId, username: recipient.trim() },
                      { onSuccess: () => setRecipient('') },
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold hover:bg-elev disabled:opacity-50"
                >
                  <Send size={12} aria-hidden />
                  {sendPlan.isSuccess && !sendPlan.isPending ? 'Sent ✓' : 'Send'}
                </button>
                {sendPlan.isError && (
                  <span className="text-xs text-rose-500">{sendPlan.error.message}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export function PlansPage({ embedded = false }: { embedded?: boolean }) {
  const [name, setName] = useState('');
  const plansQuery = usePlans();
  const activeQuery = useActivePlanId();
  const workoutsQuery = useWorkoutsForPlans();
  const sharedQuery = useSharedPlans();
  const createPlan = useCreatePlan();

  const workouts = workoutsQuery.data ?? [];
  const activeId = activeQuery.data ?? null;
  // The active plan leads; the rest keep their alphabetical order.
  const myPlans = [...(plansQuery.data ?? [])].sort(
    (a, b) => Number(b.id === activeId) - Number(a.id === activeId),
  );
  // Includes your own shares (badged) and plans sent directly to you —
  // that's also how you pull a plan you published onto a fresh device.
  const community = sharedQuery.data?.plans ?? [];

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createPlan.mutate(trimmed);
    setName('');
  };

  return (
    <div className={embedded ? 'space-y-4' : 'mx-auto max-w-4xl space-y-4 p-4 md:p-6'}>
      <header>
        <h1 className={embedded ? 'text-lg font-bold' : 'text-2xl font-bold'}>My plans</h1>
        <p className="text-sm text-muted">
          Keep as many plans as you like and switch anytime — the <b>active</b> plan drives your
          Today card and adherence. Edit any plan freely; adopted ones remember what they were
          based on.
        </p>
      </header>

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
          No plans yet. Create one here, or grab a recommended plan from the Explore tab — it
          arrives with all its workouts.
        </p>
      )}
      {workouts.length === 0 && (plansQuery.data?.length ?? 0) > 0 && (
        <p className="text-sm text-muted">
          You have no workouts yet — add some from Explore or build them under the Workouts tab.
        </p>
      )}

      <ul className="grid items-start gap-3 md:grid-cols-2">
        {myPlans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} workouts={workouts} active={plan.id === activeId} />
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
          {community.map((shared) => (
            <CommunityCard key={shared.id} shared={shared} />
          ))}
        </ul>
      </section>
    </div>
  );
}
