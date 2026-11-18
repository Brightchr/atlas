import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronUp, Dumbbell, Timer } from 'lucide-react';
import type { SharedSessionSummary } from '@arcadia/shared';
import { useCurrentUser } from '@/features/auth/api';
import { AvatarIcon } from '@/features/profile/avatars';
import { ReportButton } from '@/features/reports/components/ReportButton';
import { useUnits } from '@/lib/units';

const KG_TO_LB = 2.2046226218;

function when(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** One shared workout in a feed or on a profile: who, what, when, the
 * totals, and the sets on tap. Remote, other-user data — rendered defensively. */
export function SharedWorkoutCard({
  item,
  showOwner = true,
}: {
  item: SharedSessionSummary;
  showOwner?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const units = useUnits();
  const { data: me } = useCurrentUser();
  const toDisplay = (kg: number) =>
    units === 'imperial' ? Math.round(kg * KG_TO_LB) : Math.round(kg);
  const unitLabel = units === 'imperial' ? 'lb' : 'kg';
  const exercises = Array.isArray(item.payload?.exercises) ? item.payload.exercises : [];
  const totals = item.payload?.totals ?? { sets: 0, volumeKg: 0 };
  const name = item.owner.displayName ?? item.owner.username;
  const mine = me?.username === item.owner.username;
  const minutes = Math.round(item.durationSec / 60);

  return (
    <li className="rounded-2xl border border-line bg-surface p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        {showOwner && (
          <AvatarIcon
            name={item.owner.username}
            icon={item.owner.avatarIcon}
            tone={item.owner.avatarTone}
            online={null}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            {showOwner && (
              <>
                <Link
                  to={`/users/${item.owner.username}`}
                  className="font-semibold hover:underline"
                >
                  {mine ? 'You' : name}
                </Link>{' '}
                <span className="text-muted">did</span>{' '}
              </>
            )}
            <span className="font-semibold">{item.name}</span>
            <span className="text-muted"> · {when(item.performedAt)}</span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted tabular-nums">
            {minutes > 0 && (
              <span className="inline-flex items-center gap-1">
                <Timer size={12} aria-hidden />
                {minutes} min
              </span>
            )}
            <span>
              {totals.sets} set{totals.sets === 1 ? '' : 's'}
            </span>
            {totals.volumeKg > 0 && (
              <span>
                {toDisplay(totals.volumeKg).toLocaleString()} {unitLabel}
              </span>
            )}
            {item.visibility === 'public' && <span className="text-accent">public</span>}
          </p>
          {exercises.length > 0 && (
            <p className="mt-1 truncate text-xs text-muted">
              <Dumbbell size={12} className="mr-1 inline" aria-hidden />
              {exercises
                .slice(0, 3)
                .map((e) => e.name)
                .join(' · ')}
              {exercises.length > 3 ? ` +${exercises.length - 3}` : ''}
            </p>
          )}
        </div>
        {exercises.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Hide sets' : 'Show sets'}
            className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
          >
            {open ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          {exercises.map((e, i) => (
            <div key={i}>
              <p className="text-xs font-semibold">{e.name}</p>
              <ul className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted tabular-nums">
                {(Array.isArray(e.sets) ? e.sets : []).map((s, j) => (
                  <li key={j}>
                    {s.durationSec
                      ? `${Math.round(s.durationSec / 60)} min`
                      : `${s.reps ?? '—'}${s.weightKg ? ` × ${toDisplay(s.weightKg)} ${unitLabel}` : ' reps'}`}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {item.payload?.notes && (
            <p className="text-xs whitespace-pre-wrap text-muted">{item.payload.notes}</p>
          )}
          {!mine && (
            <ReportButton targetType="session" targetId={item.id} label={`“${item.name}”`} />
          )}
        </div>
      )}
    </li>
  );
}
