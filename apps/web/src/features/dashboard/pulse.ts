import type { BodyWeightLog, GoalProgress } from '@arcadia/shared';

/** The weekly pulse: goal-aware motivational read of the last 7 days.
 * Pure function — callers fetch the inputs. Tone rules:
 *  - celebrate real wins loudly,
 *  - treat scale noise as noise (a week is water, not fat),
 *  - NEVER assume the user wants to lose — direction comes from their own
 *    weekly-rate goal, so a gainer's up-week is a win, not a warning. */

export interface PulseMessage {
  tone: 'celebrate' | 'steady' | 'nudge';
  text: string;
}

export interface PulseInput {
  /** Distinct yyyy-mm-dd session dates within the last 7 days. */
  sessionDatesThisWeek: string[];
  /** Training profile's days/week commitment, if set. */
  daysTarget: number | null;
  /** Weight history, newest first (~30 days is plenty). */
  weightHistory: BodyWeightLog[];
  /** kg per week the user chose: negative = lose, 0 = maintain, positive =
   * gain, null = never set a plan (stay neutral about direction). */
  weeklyRateKg: number | null;
  /** Progress rows for active goals (to celebrate completions). */
  goalProgress: GoalProgress[];
  /** Renders a kg magnitude in the user's units, e.g. 0.6 → "1.3 lb". */
  formatWeight: (kg: number) => string;
}

/** Latest weight vs. the entry closest to 7 days earlier (4–12 day window —
 * wide enough to survive skipped weigh-ins, tight enough to stay "this
 * week"). Null when there aren't two usable points. */
export function weeklyWeightDelta(history: BodyWeightLog[]): number | null {
  const latest = history[0];
  if (!latest) return null;
  const latestMs = Date.parse(latest.date);
  let baseline: BodyWeightLog | null = null;
  let bestGap = Infinity;
  for (const entry of history) {
    const days = (latestMs - Date.parse(entry.date)) / 86_400_000;
    if (days < 4 || days > 12) continue;
    const gap = Math.abs(days - 7);
    if (gap < bestGap) {
      bestGap = gap;
      baseline = entry;
    }
  }
  return baseline ? latest.weightKg - baseline.weightKg : null;
}

export function weeklyPulse(input: PulseInput): PulseMessage[] {
  const messages: PulseMessage[] = [];

  // Completed goals first — a finished goal beats everything else on morale.
  // calorie_target is excluded: its fraction hits 1 by USING the budget up,
  // which is not an achievement to congratulate.
  const completed = input.goalProgress.filter(
    (p) => p.fraction >= 1 && p.goal.type !== 'calorie_target',
  );
  for (const p of completed.slice(0, 2)) {
    messages.push({ tone: 'celebrate', text: `Goal complete: ${p.goal.title}` });
  }

  const done = input.sessionDatesThisWeek.length;
  if (input.daysTarget && done >= input.daysTarget) {
    messages.push({
      tone: 'celebrate',
      text: `Week complete — ${done} of ${input.daysTarget} workouts. Consistency is the whole game.`,
    });
  } else if (done > 0) {
    messages.push({
      tone: 'steady',
      text: input.daysTarget
        ? `${done} of ${input.daysTarget} workouts this week — keep stacking.`
        : `${done} workout${done === 1 ? '' : 's'} this week — keep stacking.`,
    });
  } else {
    messages.push({
      tone: 'nudge',
      text: 'No workouts logged yet this week — even 20 minutes counts. Start small, start today.',
    });
  }

  const delta = weeklyWeightDelta(input.weightHistory);
  if (delta === null) {
    if (input.weightHistory.length < 2) {
      messages.push({
        tone: 'nudge',
        text: 'Weigh in a few mornings a week to unlock weight-trend insights here.',
      });
    }
  } else {
    const magnitude = input.formatWeight(Math.abs(delta));
    const rate = input.weeklyRateKg;
    const flat = Math.abs(delta) < 0.2;
    if (rate === null) {
      if (!flat) {
        messages.push({
          tone: 'steady',
          text: `${delta < 0 ? 'Down' : 'Up'} ${magnitude} this week. Set a weekly goal on the Goals page and this gets smarter.`,
        });
      }
    } else if (rate < 0) {
      if (delta <= -0.2) {
        messages.push({ tone: 'celebrate', text: `Down ${magnitude} this week — right on pace.` });
      } else if (flat) {
        messages.push({
          tone: 'steady',
          text: 'Scale flat this week — completely normal. Weight trends show over 2–3 weeks, not 7 days.',
        });
      } else {
        messages.push({
          tone: 'nudge',
          text: `Up ${magnitude} this week. One week is usually water, not fat — recommit to logging every meal, keep protein at target, and watch weekend portions.`,
        });
      }
    } else if (rate > 0) {
      if (delta >= 0.2) {
        messages.push({ tone: 'celebrate', text: `Up ${magnitude} this week — lean gain on track.` });
      } else if (flat) {
        messages.push({
          tone: 'steady',
          text: 'Scale flat this week — to keep gaining, add a little: a bigger post-workout meal or one extra snack.',
        });
      } else {
        messages.push({
          tone: 'nudge',
          text: `Down ${magnitude} against a gain goal — you're probably under-eating. Add calories on training days first.`,
        });
      }
    } else {
      if (Math.abs(delta) <= 0.35) {
        messages.push({ tone: 'celebrate', text: 'Weight holding steady — exactly the plan.' });
      } else {
        messages.push({
          tone: 'steady',
          text: `Drifted ${delta < 0 ? 'down' : 'up'} ${magnitude} this week — worth a portion check if it continues.`,
        });
      }
    }
  }

  return messages.slice(0, 3);
}
