import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Scale } from 'lucide-react';
import type { BodyWeightLog } from '@arcadia/shared';
import { Button, Card } from '@/components/ui';
import { formatDate, formatDateShort, localIsoDate, parseDay } from '@/lib/dates';
import {
  displayWeight,
  formatWeight,
  parseWeight,
  useUnits,
  weightUnit,
  type UnitSystem,
} from '@/lib/units';
import { useLogWeight } from '../api';
import { getWeightHistory } from '../repository';
import { fieldClasses } from './Field';

/** How many weigh-ins the trend looks back over. */
const HISTORY = 30;

/** A tiny line of the recent weigh-ins, oldest on the left. Hand-drawn SVG
 * instead of a chart library: there are no axes or tooltips, so a polyline is
 * all it takes. Points are placed by date, so a gap between weigh-ins shows up
 * as a longer segment instead of being squeezed out. */
function Sparkline({ logs }: { logs: BodyWeightLog[] }) {
  const times = logs.map((l) => parseDay(l.date).getTime());
  const weights = logs.map((l) => l.weightKg);
  const t0 = Math.min(...times);
  const tSpan = Math.max(...times) - t0 || 1;
  const w0 = Math.min(...weights);
  const wSpan = Math.max(...weights) - w0;
  const points = logs
    .map((l, i) => {
      const x = ((times[i]! - t0) / tSpan) * 100;
      // SVG y grows downward, so the heaviest day sits at the top (y = 2).
      // A flat history (span 0) is drawn through the middle.
      const y = wSpan === 0 ? 16 : 30 - ((l.weightKg - w0) / wSpan) * 28;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className="h-12 w-full text-accent"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        // Keeps the line 2px thick even though the drawing is stretched.
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** "+0.8 kg since 10/12", worked out in the unit the user reads. */
function changeLabel(first: BodyWeightLog, latest: BodyWeightLog, units: UnitSystem): string {
  const delta =
    Math.round(
      (displayWeight(latest.weightKg, units) - displayWeight(first.weightKg, units)) * 10,
    ) / 10;
  const since = `since ${formatDateShort(first.date)}`;
  if (delta === 0) return `No change ${since}`;
  // A real minus sign lines up with the plus; a hyphen is narrower.
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${weightUnit(units)} ${since}`;
}

/** Log today's weight and see where it has been heading. Always available,
 * goal or no goal: weight is the thread between training, nutrition and Home. */
export function WeightLogCard() {
  const units = useUnits();
  const logWeight = useLogWeight();
  const [weight, setWeight] = useState('');

  // The key starts with 'goals' on purpose: useLogWeight invalidates every
  // query under ['goals'], so this refetches by itself after a weigh-in.
  const history = useQuery({
    queryKey: ['goals', 'weight-history', HISTORY],
    queryFn: () => getWeightHistory(HISTORY),
  });
  // Stored newest first; the chart reads left to right, oldest first.
  const logs = [...(history.data ?? [])].reverse();
  const first = logs[0];
  const latest = logs[logs.length - 1];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!Number(weight)) return;
    logWeight.mutate(parseWeight(Number(weight), units));
    setWeight('');
  };

  return (
    <Card className="glow-ring space-y-3 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Scale size={17} strokeWidth={1.9} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">Body weight</p>
          <p className="text-xl leading-tight font-bold tabular-nums">
            {latest ? formatWeight(latest.weightKg, units) : '—'}
          </p>
        </div>
        {latest && (
          <p className="shrink-0 text-right text-xs text-muted tabular-nums">
            {latest.date === localIsoDate() ? 'Logged today' : `Last ${formatDate(latest.date)}`}
            {first && first !== latest && (
              <span className="block">{changeLabel(first, latest, units)}</span>
            )}
          </p>
        )}
      </div>

      {logs.length >= 2 ? (
        <Sparkline logs={logs} />
      ) : (
        history.isSuccess && (
          <p className="text-sm text-muted">
            Weigh in a few mornings a week and your trend line shows up here.
          </p>
        )
      )}

      {/* A <form> so Enter on the keyboard logs the weight too. noValidate
          because min/max/step are only hints for the keypad and spinner: the
          browser must not block an unusual but real number. */}
      <form onSubmit={handleSubmit} noValidate className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="20"
          max="400"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={`Today's weight (${weightUnit(units)})`}
          aria-label={`Today's weight in ${weightUnit(units)}`}
          className={fieldClasses}
        />
        <Button type="submit" className="shrink-0" disabled={!Number(weight)}>
          Log weight
        </Button>
      </form>
    </Card>
  );
}
