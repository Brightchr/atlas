import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Flag, TrendingUp, Trophy } from 'lucide-react';
import { displayWeight, formatWeight, useUnits } from '@/lib/units';
import { recentPersonalRecords, strengthGains, weightProgress } from '../stats';

/** The "where you stand" hero: gains framed the encouraging way.
 * Research-backed rules baked in: percent-since-start (only ever grows),
 * trophies for recent PRs, weight as milestones toward the user's own goal —
 * and when a number isn't moving, it simply isn't shown. No red arrows,
 * no "you're behind", ever. */
export function GainsHero() {
  const units = useUnits();
  const gains = useQuery({ queryKey: ['stats', 'gains'], queryFn: () => strengthGains(4) });
  const records = useQuery({
    queryKey: ['stats', 'records'],
    queryFn: () => recentPersonalRecords(30, 6),
  });
  const journey = useQuery({ queryKey: ['stats', 'weight-journey'], queryFn: weightProgress });

  const gainList = (gains.data ?? []).filter((g) => g.gainPct > 0);
  const prs = records.data ?? [];
  const trip = journey.data;

  if (gainList.length === 0 && prs.length === 0 && !trip) return null;

  return (
    <section className="rounded-2xl border border-accent/30 bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent">
          <TrendingUp size={15} strokeWidth={1.8} aria-hidden />
        </span>
        <h2 className="text-sm font-semibold">Your gains</h2>
      </div>

      {gainList.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {gainList.map((g) => (
            <Link
              key={g.exerciseName}
              to={`/exercises/${g.exerciseId}`}
              className="springy rounded-xl bg-elev p-3 hover:-translate-y-0.5"
            >
              <p className="font-display text-xl font-bold text-accent tabular-nums">
                +{g.gainPct}%
              </p>
              <p className="truncate text-xs font-semibold">{g.exerciseName}</p>
              <p className="text-[11px] text-muted">
                est. 1RM {Math.round(displayWeight(g.bestKg, units))} — up since {g.sinceLabel}
              </p>
            </Link>
          ))}
        </div>
      )}

      {prs.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase">
            <Trophy size={12} className="text-amber-500" aria-hidden />
            Records — last 30 days
          </p>
          <ul className="space-y-1">
            {prs.map((pr) => (
              <li key={`${pr.exerciseName}-${pr.date}-${pr.estimatedOneRepMaxKg}`} className="flex items-baseline gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{pr.exerciseName}</span>
                <span className="shrink-0 text-xs tabular-nums">
                  {formatWeight(pr.weightKg, units)}
                  {pr.reps ? ` × ${pr.reps}` : ''}
                </span>
                <span className="shrink-0 text-[11px] text-muted tabular-nums">
                  {new Date(pr.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {trip && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted uppercase">
            <Flag size={12} className="text-accent" aria-hidden />
            Weight journey
          </p>
          <div className="flex items-center gap-2">
            {Array.from({ length: trip.milestonesTotal }, (_, i) => (
              <span
                key={i}
                className={`h-2 flex-1 rounded-full ${
                  i < trip.milestonesDone ? 'bg-linear-to-r from-accent to-accent-2' : 'bg-elev'
                }`}
              />
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted tabular-nums">
            {trip.milestonesDone} of {trip.milestonesTotal} milestones banked —{' '}
            {formatWeight(trip.currentKg, units)} now, {formatWeight(trip.targetKg, units)} the
            goal
            {trip.towardGoalPerWeekKg !== null && trip.towardGoalPerWeekKg > 0.05 && (
              <span className="font-semibold text-accent">
                {' '}· trending {formatWeight(Math.abs(trip.towardGoalPerWeekKg), units)}/week the
                right way
              </span>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
