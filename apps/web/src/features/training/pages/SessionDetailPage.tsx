import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarCheck,
  Globe,
  Pencil,
  Repeat,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import type { SharedSessionVisibility } from '@arcadia/shared';
import { useShareSession, useUnshareSession, useWorkoutFeed } from '@/features/social/sessions';
import { discardSession, getSession, repeatSession } from '@/features/workouts/repository';
import { useUnits } from '@/lib/units';

const KG_TO_LB = 2.2046226218;

const actionButton =
  'springy inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold shadow-sm transition-colors hover:bg-elev';

/** Drill-down for one finished workout: every set, grouped by exercise, with
 * the things you'd want to do with it next — repeat it, fix it, drop it. */
export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const units = useUnits();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [visibility, setVisibility] = useState<SharedSessionVisibility>('friends');
  const feed = useWorkoutFeed();
  const share = useShareSession();
  const unshare = useUnshareSession();
  const sharedAs = feed.data?.sessions.find((s) => s.localSessionId === sessionId) ?? null;
  const session = useQuery({
    queryKey: ['sessions', sessionId],
    queryFn: () => getSession(sessionId!),
    enabled: Boolean(sessionId),
  });

  const repeat = useMutation({
    mutationFn: () => repeatSession(sessionId!),
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
      if (id) void navigate(`/workouts/session/${id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => discardSession(sessionId!),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      void navigate('/history', { replace: true });
    },
  });

  if (session.isSuccess && !session.data) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-sm text-muted">
        Couldn't find this session.{' '}
        <Link to="/history" className="text-accent hover:underline">
          Back to history
        </Link>
      </div>
    );
  }
  if (!session.data) return null;

  const s = session.data;
  const toDisplay = (kg: number) =>
    units === 'imperial' ? Math.round(kg * KG_TO_LB * 10) / 10 : kg;
  const unitLabel = units === 'imperial' ? 'lb' : 'kg';
  // Session order first (its own exercise list), then anything logged that
  // isn't in it (legacy sessions).
  const order = new Map<string, number>();
  s.exercises.forEach((e, i) => order.set(e.exerciseName, i));
  const byExercise = new Map<string, typeof s.sets>();
  for (const set of s.sets) {
    const list = byExercise.get(set.exerciseName) ?? [];
    list.push(set);
    byExercise.set(set.exerciseName, list);
  }
  const sections = [...byExercise.entries()].sort(
    ([a], [b]) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9),
  );
  const volume = s.sets.reduce((sum, x) => sum + (x.weightKg ?? 0) * (x.reps ?? 0), 0);
  const durationMin = s.finishedAt
    ? Math.max(1, Math.round((Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60_000))
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <Link
        to="/history"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
      >
        <ArrowLeft size={15} aria-hidden />
        History
      </Link>

      <header className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <CalendarCheck size={18} strokeWidth={1.8} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{s.workoutName}</h1>
            <p className="text-xs text-muted">
              {new Date(s.startedAt).toLocaleDateString([], {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              {durationMin && ` · ${durationMin} min`} · {s.sets.length} set
              {s.sets.length === 1 ? '' : 's'}
              {volume > 0 &&
                ` · ${Math.round(toDisplay(volume)).toLocaleString()} ${unitLabel} total`}
            </p>
          </div>
        </div>
        {s.notes && <p className="mt-3 text-sm whitespace-pre-wrap text-muted">{s.notes}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={repeat.isPending}
            onClick={() => repeat.mutate()}
            className={actionButton}
          >
            <Repeat size={14} aria-hidden />
            Repeat
          </button>
          <Link to={`/workouts/session/${s.id}`} className={actionButton}>
            <Pencil size={14} aria-hidden />
            Edit
          </Link>
          <button
            type="button"
            onClick={() => setSharing((v) => !v)}
            aria-expanded={sharing}
            className={`${actionButton} ${sharedAs ? 'border-accent/40 bg-accent-soft text-accent' : ''}`}
          >
            <Share2 size={14} aria-hidden />
            {sharedAs ? `Shared · ${sharedAs.visibility}` : 'Share'}
          </button>
          {confirmDelete ? (
            <span className="ml-auto flex items-center gap-1.5 text-xs">
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
                className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 font-semibold text-rose-600"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg px-2.5 py-1.5 font-semibold text-muted hover:bg-elev"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-rose-500"
            >
              <Trash2 size={13} aria-hidden />
              Delete
            </button>
          )}
        </div>
      </header>

      {sharing && (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold">Share this workout</h2>
            <p className="text-xs text-muted">
              A snapshot of the exercises and sets goes to the server. Friends see it in their
              activity feed; public shares also show on your profile. Unshare any time.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                { id: 'friends', label: 'Friends', hint: 'Accepted friends only', Icon: Users },
                {
                  id: 'public',
                  label: 'Public',
                  hint: 'Anyone who opens your profile',
                  Icon: Globe,
                },
              ] as const
            ).map(({ id, label, hint, Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={visibility === id}
                onClick={() => setVisibility(id)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  visibility === id
                    ? 'border-accent/40 bg-accent-soft'
                    : 'border-line bg-surface hover:bg-elev'
                }`}
              >
                <Icon size={16} className="shrink-0 text-accent" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </button>
            ))}
          </div>
          {share.isError && (
            <p className="text-xs text-rose-500">
              Couldn't share: {share.error instanceof Error ? share.error.message : 'try again'}.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={share.isPending || s.sets.length === 0}
              onClick={() =>
                share.mutate({ session: s, visibility }, { onSuccess: () => setSharing(false) })
              }
              className="springy inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Share2 size={14} aria-hidden />
              {sharedAs ? 'Update share' : 'Share'}
            </button>
            {sharedAs && (
              <button
                type="button"
                disabled={unshare.isPending}
                onClick={() => unshare.mutate(s.id, { onSuccess: () => setSharing(false) })}
                className="text-xs font-medium text-muted transition-colors hover:text-rose-500"
              >
                Unshare
              </button>
            )}
            {s.sets.length === 0 && (
              <span className="text-xs text-muted">Log at least one set to share.</span>
            )}
          </div>
        </section>
      )}

      {sections.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No sets were logged. Use Edit to add them.
        </p>
      )}

      {sections.map(([name, sets]) => (
        <section key={name} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <Link
            to={`/exercises/${sets[0]!.exerciseId}`}
            className="text-sm font-semibold text-accent hover:underline"
          >
            {name}
          </Link>
          <ul className="mt-2 space-y-1">
            {sets.map((set) => (
              <li key={set.id} className="flex items-baseline justify-between text-sm">
                <span className="text-xs text-muted">Set {set.setNumber}</span>
                <span className="tabular-nums">
                  {set.durationSec
                    ? `${Math.round(set.durationSec / 60)} min`
                    : `${set.reps ?? '—'} reps${set.weightKg ? ` × ${toDisplay(set.weightKg)} ${unitLabel}` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
