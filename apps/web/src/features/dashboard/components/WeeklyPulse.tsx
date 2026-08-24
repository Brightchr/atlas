import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, PartyPopper, Scale, Sparkles, TrendingUp } from 'lucide-react';
import { useExerciseCatalog } from '@/features/exercises/api';
import { useGoalProgress } from '@/features/goals/api';
import {
  getProfile,
  getSessionDates,
  getWeightHistory,
  logBodyWeight,
} from '@/features/goals/repository';
import { useTrainingProfile } from '@/features/training/profile';
import { displayWeight, formatWeight, parseWeight, useUnits, weightUnit } from '@/lib/units';
import { weeklyPulse, type PulseMessage } from '../pulse';

const TONE_META: Record<PulseMessage['tone'], { Icon: typeof Sparkles; tint: string }> = {
  celebrate: { Icon: PartyPopper, tint: 'bg-accent-soft text-accent' },
  steady: { Icon: TrendingUp, tint: 'bg-sky-500/15 text-sky-500' },
  nudge: { Icon: Lightbulb, tint: 'bg-amber-500/15 text-amber-600' },
};

/** The motivational heart of the dashboard: workouts, weight and goals for
 * the last 7 days read together, with a quick weigh-in so the trend data
 * keeps flowing. Direction-aware — praise follows the user's own goal. */
export function WeeklyPulse() {
  const units = useUnits();
  const queryClient = useQueryClient();
  const [weight, setWeight] = useState('');

  const catalog = useExerciseCatalog();
  const progress = useGoalProgress(catalog.data);
  const trainingProfile = useTrainingProfile();
  const weekSessions = useQuery({
    queryKey: ['sessions', 'week'],
    queryFn: () => getSessionDates(7),
  });
  const weightHistory = useQuery({
    queryKey: ['weight', 'recent'],
    queryFn: () => getWeightHistory(30),
  });
  const planProfile = useQuery({ queryKey: ['profile'], queryFn: getProfile });

  const logWeight = useMutation({
    mutationFn: logBodyWeight,
    onSuccess: () => {
      setWeight('');
      void queryClient.invalidateQueries({ queryKey: ['weight'] });
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const messages = weeklyPulse({
    sessionDatesThisWeek: weekSessions.data ?? [],
    daysTarget: trainingProfile.data?.daysPerWeek ?? null,
    weightHistory: weightHistory.data ?? [],
    weeklyRateKg: planProfile.data?.weeklyRateKg ?? null,
    goalProgress: progress.data ?? [],
    formatWeight: (kg) => formatWeight(kg, units),
  });

  const latest = weightHistory.data?.[0];

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" aria-hidden />
          <h2 className="text-sm font-semibold">Your week</h2>
        </div>
        <Link to="/you" className="text-xs font-medium text-accent hover:underline">
          See trends →
        </Link>
      </div>

      <ul className="space-y-2">
        {messages.map((message) => {
          const { Icon, tint } = TONE_META[message.tone];
          return (
            <li key={message.text} className="flex items-start gap-2.5">
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tint}`}>
                <Icon size={14} strokeWidth={1.8} aria-hidden />
              </span>
              <p className="text-sm leading-relaxed">{message.text}</p>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Scale size={15} className="shrink-0 text-muted" aria-hidden />
        <input
          type="number"
          step="0.1"
          min="20"
          max="900"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={
            latest
              ? `Today's weight — last ${displayWeight(latest.weightKg, units)} ${weightUnit(units)}`
              : `Today's weight (${weightUnit(units)})`
          }
          aria-label={`Today's weight in ${weightUnit(units)}`}
          className="w-64 max-w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <button
          type="button"
          disabled={!Number(weight) || logWeight.isPending}
          onClick={() => logWeight.mutate(parseWeight(Number(weight), units))}
          className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Log weight
        </button>
        {logWeight.isSuccess && !logWeight.isPending && (
          <span className="text-xs text-accent">Logged ✓</span>
        )}
      </div>
    </section>
  );
}
