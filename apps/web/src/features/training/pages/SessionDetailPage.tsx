import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Globe, Pencil, Repeat, Share2, Trash2, Users } from 'lucide-react';
import type { SharedSessionVisibility } from '@arcadia/shared';
import { Button, Card, ConfirmSheet, PageHeader, Sheet } from '@/components/ui';
import { useShareSession, useUnshareSession, useWorkoutFeed } from '@/features/social/sessions';
import { discardSession, getSession, repeatSession } from '@/features/workouts/repository';
import { displayWeight, useUnits, weightUnit } from '@/lib/units';

/** A timed set as people say it: "20s" under a minute, "1:30" from there on.
 * (Rounding to whole minutes used to turn a 20-second plank into "0 min".) */
function formatSetDuration(totalSec: number): string {
  const sec = Math.round(totalSec);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

// The four actions share one look: icon above label, so all four fit side by
// side on a 375px phone while each stays a 56px-tall target. Written out
// rather than built on buttonClasses() because that sets its own padding and
// gap, and two Tailwind classes for the same property don't reliably override
// each other.
const actionBase =
  'springy flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50';
const actionNeutral = `${actionBase} border border-line bg-surface text-ink shadow-sm hover:bg-elev`;
const actionActive = `${actionBase} bg-accent-soft text-accent`;
const actionDanger = `${actionBase} bg-rose-500/10 text-rose-500 hover:bg-rose-500/20`;

const SHARE_OPTIONS = [
  { id: 'friends', label: 'Friends', hint: 'Accepted friends only', Icon: Users },
  { id: 'public', label: 'Public', hint: 'Anyone who opens your profile', Icon: Globe },
] as const;

/** Drill-down for one finished workout: every set, grouped by exercise, with
 * the things you'd want to do with it next — repeat it, fix it, share it,
 * drop it. */
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
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
        <PageHeader title="Workout" back="/history" />
        <p className="text-sm text-muted">Couldn't find this session.</p>
      </div>
    );
  }
  if (!session.data) return null;

  const s = session.data;
  const unitLabel = weightUnit(units);
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

  // "52 min · 18 sets · 12,400 lb total" — pieces that don't apply drop out.
  const summary = [
    durationMin ? `${durationMin} min` : null,
    `${s.sets.length} set${s.sets.length === 1 ? '' : 's'}`,
    volume > 0
      ? `${Math.round(displayWeight(volume, units)).toLocaleString()} ${unitLabel} total`
      : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <PageHeader
        title={s.workoutName}
        subtitle={new Date(s.startedAt).toLocaleDateString([], {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
        back="/history"
      />

      <p className="text-sm text-muted tabular-nums">{summary.join(' · ')}</p>
      {s.notes && <p className="text-sm whitespace-pre-wrap text-muted">{s.notes}</p>}

      <div className="grid grid-cols-4 gap-2">
        <button
          type="button"
          className={actionNeutral}
          disabled={repeat.isPending}
          onClick={() => repeat.mutate()}
        >
          <Repeat size={20} aria-hidden />
          Repeat
        </button>
        <Link to={`/workouts/session/${s.id}`} className={actionNeutral}>
          <Pencil size={20} aria-hidden />
          Edit
        </Link>
        {/* Accent-tinted when already shared, so the state is visible without
            opening the sheet. */}
        <button
          type="button"
          className={sharedAs ? actionActive : actionNeutral}
          onClick={() => {
            // Open on the current setting when it's already shared.
            if (sharedAs) setVisibility(sharedAs.visibility);
            setSharing(true);
          }}
        >
          <Share2 size={20} aria-hidden />
          {sharedAs ? 'Shared' : 'Share'}
        </button>
        <button type="button" className={actionDanger} onClick={() => setConfirmDelete(true)}>
          <Trash2 size={20} aria-hidden />
          Delete
        </button>
      </div>

      {sections.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
          No sets were logged. Use Edit to add them.
        </p>
      )}

      {sections.map(([name, sets]) => (
        <Card key={name} className="px-4 pt-1 pb-3">
          <Link
            to={`/exercises/${sets[0]!.exerciseId}`}
            className="flex min-h-11 items-center text-base font-semibold text-accent hover:underline"
          >
            {name}
          </Link>
          <ul className="divide-y divide-line">
            {sets.map((set) => (
              <li key={set.id} className="flex items-baseline justify-between py-2 text-sm">
                <span className="text-muted">Set {set.setNumber}</span>
                <span className="font-medium tabular-nums">
                  {set.durationSec
                    ? formatSetDuration(set.durationSec)
                    : `${set.reps ?? '—'} reps${set.weightKg ? ` × ${displayWeight(set.weightKg, units)} ${unitLabel}` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {sharing && (
        <Sheet
          title="Share this workout"
          onClose={() => setSharing(false)}
          footer={
            <div className="grid gap-2">
              <Button
                size="lg"
                block
                disabled={share.isPending || s.sets.length === 0}
                onClick={() =>
                  share.mutate({ session: s, visibility }, { onSuccess: () => setSharing(false) })
                }
              >
                <Share2 size={18} aria-hidden />
                {sharedAs ? 'Update share' : 'Share'}
              </Button>
              {sharedAs && (
                <Button
                  variant="ghost"
                  block
                  disabled={unshare.isPending}
                  onClick={() => unshare.mutate(s.id, { onSuccess: () => setSharing(false) })}
                >
                  Stop sharing
                </Button>
              )}
            </div>
          }
        >
          <p className="text-sm text-muted">
            A snapshot of the exercises and sets goes to the server. Friends see it in their
            activity feed; public shares also show on your profile. You can stop sharing any time.
          </p>
          <div className="mt-4 grid gap-2">
            {SHARE_OPTIONS.map(({ id, label, hint, Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={visibility === id}
                onClick={() => setVisibility(id)}
                className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-2 text-left transition-colors ${
                  visibility === id
                    ? 'border-accent bg-accent-soft'
                    : 'border-line bg-surface hover:bg-elev'
                }`}
              >
                <Icon size={20} className="shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-sm text-muted">{hint}</span>
                </span>
                {visibility === id && (
                  <Check size={18} className="shrink-0 text-accent" aria-hidden />
                )}
              </button>
            ))}
          </div>
          {s.sets.length === 0 && (
            <p className="mt-3 text-sm text-muted">Log at least one set to share.</p>
          )}
          {share.isError && (
            <p className="mt-3 text-sm text-rose-500">
              Couldn't share: {share.error instanceof Error ? share.error.message : 'try again'}.
            </p>
          )}
        </Sheet>
      )}

      {confirmDelete && (
        <ConfirmSheet
          title="Delete this workout?"
          body={`"${s.workoutName}" and its ${s.sets.length} logged set${
            s.sets.length === 1 ? '' : 's'
          } will be removed from your history. This can't be undone.`}
          confirmLabel="Delete workout"
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
