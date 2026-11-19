import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, MoreVertical, Plus } from 'lucide-react';
import type { LoggedSet, SessionExercise } from '@arcadia/shared';
import { Button, IconButton, Stepper } from '@/components/ui';
import { displayWeight, parseWeight, type UnitSystem, weightUnit } from '@/lib/units';
import { formatClock } from '../restTimer';

/** "20s" under a minute, "1:30" from there up. Holds are stored in seconds,
 * so rounding to minutes (the old behaviour) turned a 20-second hold into 0. */
export function formatDuration(sec: number): string {
  return sec < 60 ? `${Math.round(sec)}s` : formatClock(sec);
}

/** One set as short text: "135 × 10", "BW × 12", "45s". */
export function describeSet(
  set: Pick<LoggedSet, 'reps' | 'weightKg' | 'durationSec'>,
  units: UnitSystem,
): string {
  if (set.durationSec !== null) return formatDuration(set.durationSec);
  const weight = set.weightKg ? String(displayWeight(set.weightKg, units)) : 'BW';
  return `${weight} × ${set.reps ?? '—'}`;
}

export interface SetValues {
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  durationSec: number | null;
}

/** The steppers and the big Log button for the next set of one exercise.
 *
 * Mounted with a `key` of the set number, so it starts fresh (with new
 * prefilled values) each time a set is logged instead of carrying stale
 * state over. */
function NextSetLogger({
  setNumber,
  timed,
  inMinutes,
  units,
  defaults,
  pending,
  onLog,
}: {
  setNumber: number;
  timed: boolean;
  /** Enter the duration in minutes rather than seconds (long efforts). */
  inMinutes: boolean;
  units: UnitSystem;
  defaults: { weight: string; reps: string; seconds: string };
  pending: boolean;
  onLog: (values: SetValues) => void;
}) {
  const [weight, setWeight] = useState(defaults.weight);
  const [reps, setReps] = useState(defaults.reps);
  const [seconds, setSeconds] = useState(defaults.seconds);

  const valid = timed ? Number(seconds) > 0 : Number(reps) > 0;
  const submit = () =>
    onLog(
      timed
        ? {
            setNumber,
            reps: null,
            weightKg: null,
            // Stored in seconds whichever unit was typed.
            durationSec: Math.round(Number(seconds) * (inMinutes ? 60 : 1)),
          }
        : {
            setNumber,
            reps: Number(reps),
            // Empty or 0 means bodyweight: stored as "no load", not 0 kg.
            weightKg: Number(weight) > 0 ? parseWeight(Number(weight), units) : null,
            durationSec: null,
          },
    );

  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-elev/60 p-3">
      {/* Stacked on phones: side by side the number fields get too narrow to read. */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {timed ? (
          <Stepper
            label={inMinutes ? 'Minutes' : 'Seconds'}
            value={seconds}
            onChange={setSeconds}
            step={inMinutes ? 1 : 5}
            decimals={inMinutes}
          />
        ) : (
          <>
            <Stepper
              label={weightUnit(units)}
              value={weight}
              onChange={setWeight}
              // 5 lb / 2.5 kg: the smallest jump most plates allow.
              step={units === 'imperial' ? 5 : 2.5}
              decimals
              placeholder="BW"
            />
            <Stepper label="Reps" value={reps} onChange={setReps} step={1} />
          </>
        )}
      </div>
      <Button size="xl" block disabled={pending || !valid} onClick={submit}>
        <Check size={22} strokeWidth={2.6} aria-hidden />
        Log set {setNumber}
      </Button>
    </div>
  );
}

/** One exercise in the workout. The current exercise is expanded (set list,
 * steppers, Log button); the rest collapse to a one-line summary so the
 * screen is about the set you are doing, not the whole workout. */
export function ExerciseCard({
  exercise,
  sets,
  previous,
  units,
  expanded,
  pending,
  onToggle,
  onLog,
  onUnlog,
  onMenu,
}: {
  exercise: SessionExercise;
  /** Sets logged for this exercise in THIS session. */
  sets: LoggedSet[];
  /** Sets from the last finished session that included this exercise. */
  previous: LoggedSet[];
  units: UnitSystem;
  expanded: boolean;
  pending: boolean;
  onToggle: () => void;
  onLog: (values: SetValues) => void;
  onUnlog: (setId: string) => void;
  onMenu: () => void;
}) {
  const timed = exercise.targetDurationSec !== null;
  const target = exercise.targetSets ?? (timed ? 1 : 3);
  // "Add a set" asks for more rows than the plan has. Stored as an absolute
  // row count so logging the extra set does not conjure yet another one.
  const [wantedRows, setWantedRows] = useState(0);

  const byNumber = new Map(sets.map((s) => [s.setNumber, s]));
  const highest = sets.reduce((max, s) => Math.max(max, s.setNumber), 0);
  const rowCount = Math.max(target, highest, wantedRows);
  // The next set to log: the lowest-numbered row without a logged set.
  let next = 1;
  while (byNumber.has(next)) next++;
  const complete = sets.length >= target && next > rowCount;

  // Prefill, in order of preference: what you just did this session (you
  // usually repeat it), then the same set last time, then the plan's target.
  const lastToday = [...sets].sort((a, b) => b.setNumber - a.setNumber)[0];
  const lastTime = previous.find((s) => s.setNumber === next) ?? previous[previous.length - 1];
  const source = lastToday ?? lastTime;
  // A 20-second hold is entered in seconds; a 30-minute run in minutes.
  // Either way it is stored in seconds.
  const inMinutes = timed && (exercise.targetDurationSec ?? 0) >= 120;
  const durationDefault = source?.durationSec ?? exercise.targetDurationSec ?? 60;
  const defaults = {
    weight: source?.weightKg ? String(displayWeight(source.weightKg, units)) : '',
    reps: String(source?.reps ?? exercise.targetReps ?? 10),
    seconds: String(
      inMinutes ? Math.round((durationDefault / 60) * 10) / 10 : Math.round(durationDefault),
    ),
  };

  // Bring the card into view when it becomes the current exercise.
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (expanded) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [expanded]);

  const targetLabel = timed
    ? `${target} × ${formatDuration(exercise.targetDurationSec ?? 0)}`
    : `${target} × ${exercise.targetReps ?? '—'}`;

  return (
    <li
      ref={ref}
      className={`scroll-mt-24 scroll-mb-48 rounded-2xl border shadow-sm transition-colors ${
        expanded ? 'border-accent/50 bg-surface' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-center gap-1 py-1 pr-1 pl-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={`flex h-9 min-w-12 shrink-0 items-center justify-center rounded-full px-2 text-sm font-bold tabular-nums ${
              complete ? 'bg-accent text-accent-ink' : 'bg-elev text-muted'
            }`}
          >
            {complete ? (
              <Check size={18} strokeWidth={3} aria-hidden />
            ) : (
              `${sets.length}/${target}`
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold">{exercise.exerciseName}</span>
            <span className="block truncate text-sm text-muted tabular-nums">
              {expanded || sets.length === 0
                ? `Target ${targetLabel}${exercise.restSec ? ` · rest ${exercise.restSec}s` : ''}`
                : sets.map((s) => describeSet(s, units)).join(' · ')}
            </span>
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        <IconButton label={`Options for ${exercise.exerciseName}`} onClick={onMenu}>
          <MoreVertical size={20} aria-hidden />
        </IconButton>
      </div>

      {expanded && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-[2.5rem_1fr_1fr_3rem] items-center gap-x-2 px-1 text-xs font-semibold tracking-wide text-muted uppercase">
            <span>Set</span>
            <span>Last time</span>
            <span>Today</span>
            <span />
          </div>
          <ul className="mt-1 space-y-1">
            {Array.from({ length: rowCount }, (_, i) => i + 1).map((n) => {
              const logged = byNumber.get(n);
              const before = previous.find((s) => s.setNumber === n);
              const isNext = n === next;
              return (
                <li
                  key={n}
                  className={`grid min-h-12 grid-cols-[2.5rem_1fr_1fr_3rem] items-center gap-x-2 rounded-xl px-1 tabular-nums ${
                    logged ? 'bg-accent-soft/50' : isNext ? 'bg-elev' : ''
                  }`}
                >
                  <span
                    className={`pl-2 text-base font-bold ${isNext ? 'text-accent' : 'text-muted'}`}
                  >
                    {n}
                  </span>
                  <span className="truncate text-sm text-muted">
                    {before ? describeSet(before, units) : '—'}
                  </span>
                  <span className={`truncate text-base ${logged ? 'font-bold' : 'text-muted'}`}>
                    {logged ? describeSet(logged, units) : isNext ? 'Up next' : '—'}
                  </span>
                  {logged ? (
                    <button
                      type="button"
                      onClick={() => onUnlog(logged.id)}
                      aria-label={`Undo set ${n}`}
                      className="springy pop-in flex h-11 w-11 items-center justify-center justify-self-end rounded-full bg-accent text-accent-ink"
                    >
                      <Check size={20} strokeWidth={3} aria-hidden />
                    </button>
                  ) : (
                    <span
                      aria-hidden
                      className="mr-2.5 h-6 w-6 justify-self-end rounded-full border-2 border-line"
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {next <= rowCount ? (
            <NextSetLogger
              // Remount (and so re-prefill) when the set changes or when last
              // time's numbers arrive from the database.
              key={`${next}-${sets.length}-${previous.length}`}
              setNumber={next}
              timed={timed}
              inMinutes={inMinutes}
              units={units}
              defaults={defaults}
              pending={pending}
              onLog={onLog}
            />
          ) : (
            <Button
              variant="secondary"
              size="lg"
              block
              className="mt-3"
              onClick={() => setWantedRows(rowCount + 1)}
            >
              <Plus size={18} aria-hidden />
              Add another set
            </Button>
          )}
          {next <= rowCount && (
            <button
              type="button"
              onClick={() => setWantedRows(rowCount + 1)}
              className="mt-1 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-muted hover:bg-elev hover:text-ink"
            >
              <Plus size={16} aria-hidden />
              Add a set
            </button>
          )}
        </div>
      )}
    </li>
  );
}
