import { localDayOfWeek } from '@/lib/dates';

export interface PlanSlot {
  /** Monday = 0 … Sunday = 6. */
  dayOfWeek: number;
  workoutId: string;
}

/** Which plan workout comes next.
 *
 * A plan is a week of routines, but it is followed as a SEQUENCE: next is
 * whatever follows the last plan workout you actually finished, not whatever
 * the calendar says today. Miss Monday and Monday's workout is still next on
 * Tuesday, instead of silently vanishing.
 *
 * Pure (no database, no React) so it can be unit-tested: `days` are the
 * plan's workout days in week order, `finished` the finished sessions newest
 * first, `today` the current weekday. */
export function pickNextUp(
  days: PlanSlot[],
  finished: { workoutId: string | null; startedAt: string }[],
  today: number,
): PlanSlot | undefined {
  if (days.length === 0) return undefined;
  const inPlan = new Set(days.map((d) => d.workoutId));
  const last = finished.find((s) => s.workoutId !== null && inPlan.has(s.workoutId));
  // Nothing from this plan done yet: start with today's workout, or the
  // first one still ahead this week, or wrap to the start of the week.
  if (!last) return days.find((d) => d.dayOfWeek >= today) ?? days[0];
  // A routine can sit on two days (Mon and Thu): prefer the slot matching
  // the weekday it was actually done on.
  const doneOn = localDayOfWeek(new Date(last.startedAt));
  let index = days.findIndex((d) => d.workoutId === last.workoutId && d.dayOfWeek === doneOn);
  if (index === -1) index = days.findIndex((d) => d.workoutId === last.workoutId);
  return days[(index + 1) % days.length];
}
