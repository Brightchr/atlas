import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDb, persist } from '@/lib/db';

/** The training profile is the lens the whole app filters through: picked
 * during onboarding, editable any time, it drives plan/workout
 * recommendations and default catalog filters. Stored locally (settings
 * table) — it shapes UX, it isn't account identity. */

export type TrainingGoal = 'build_muscle' | 'lose_weight' | 'get_stronger' | 'general';
export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';

export interface TrainingProfile {
  goal: TrainingGoal;
  level: TrainingLevel;
  /** How many days a week they want to train (guides plan recommendations). */
  daysPerWeek: number;
}

export const GOAL_OPTIONS: { id: TrainingGoal; label: string; hint: string }[] = [
  { id: 'build_muscle', label: 'Build muscle', hint: 'Hypertrophy: more volume, moderate reps' },
  {
    id: 'lose_weight',
    label: 'Lose weight',
    hint: 'Burn energy: circuits, cardio, full-body work',
  },
  { id: 'get_stronger', label: 'Get stronger', hint: 'Strength: heavy compound lifts, low reps' },
  { id: 'general', label: 'Stay fit', hint: 'Balanced training for health and energy' },
];

export const LEVEL_OPTIONS: { id: TrainingLevel; label: string; hint: string }[] = [
  { id: 'beginner', label: 'Beginner', hint: 'New, or returning after a long break' },
  { id: 'intermediate', label: 'Intermediate', hint: 'Training consistently for 6+ months' },
  { id: 'advanced', label: 'Advanced', hint: 'Years of structured training' },
];

export const GOAL_LABELS: Record<TrainingGoal, string> = Object.fromEntries(
  GOAL_OPTIONS.map((g) => [g.id, g.label]),
) as Record<TrainingGoal, string>;

export const LEVEL_LABELS: Record<TrainingLevel, string> = Object.fromEntries(
  LEVEL_OPTIONS.map((l) => [l.id, l.label]),
) as Record<TrainingLevel, string>;

export const DIET_LABELS: Record<string, string> = {
  high_protein: 'High protein',
  calorie_deficit: 'Calorie deficit',
  balanced: 'Balanced',
  performance: 'Performance fuel',
};

const KEY = 'training_profile';

export async function readTrainingProfile(): Promise<TrainingProfile | null> {
  const db = await getDb();
  const rows = (await db.query('SELECT value FROM settings WHERE key = ?', [KEY])).values as {
    value: string;
  }[];
  if (!rows[0]) return null;
  try {
    const parsed = JSON.parse(rows[0].value) as Partial<TrainingProfile>;
    if (!parsed.goal || !parsed.level) return null;
    return {
      goal: parsed.goal,
      level: parsed.level,
      daysPerWeek: parsed.daysPerWeek ?? 3,
    };
  } catch {
    return null;
  }
}

async function writeTrainingProfile(profile: TrainingProfile): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT INTO settings (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [KEY, KEY, JSON.stringify(profile)],
  );
  await persist();
}

/** null = not chosen yet (onboarding pending); undefined = still loading. */
export function useTrainingProfile() {
  return useQuery({ queryKey: ['settings', KEY], queryFn: readTrainingProfile });
}

export function useSaveTrainingProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: writeTrainingProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', KEY] }),
  });
}

/* ----------------------------- Onboarding ------------------------------ */

/** What skippers train with until they say otherwise. Recommendations and
 * weekly targets read this instead of rendering holes. */
export const DEFAULT_TRAINING_PROFILE: TrainingProfile = {
  goal: 'general',
  level: 'beginner',
  daysPerWeek: 3,
};

/** Profile for display/recommendation: the real one, or the default. */
export function useEffectiveTrainingProfile(): { profile: TrainingProfile; isSet: boolean } {
  const query = useTrainingProfile();
  return { profile: query.data ?? DEFAULT_TRAINING_PROFILE, isSet: Boolean(query.data) };
}

export type OnboardingStatus = 'completed' | 'skipped';
export interface OnboardingState {
  status: OnboardingStatus;
  at: string;
}

const ONBOARDING_KEY = 'onboarding';

/** Whether the intro wizard was finished or skipped. Lives in the synced
 * settings table (row id = key), so a wiped device gets it back on the first
 * pull and the wizard shows at most once per account. null = never seen. */
export async function readOnboardingState(): Promise<OnboardingState | null> {
  const db = await getDb();
  const rows = (await db.query('SELECT value FROM settings WHERE key = ?', [ONBOARDING_KEY]))
    .values as { value: string }[];
  if (!rows[0]) return null;
  try {
    const parsed = JSON.parse(rows[0].value) as Partial<OnboardingState>;
    if (parsed.status !== 'completed' && parsed.status !== 'skipped') return null;
    return { status: parsed.status, at: parsed.at ?? '' };
  } catch {
    return null;
  }
}

export async function writeOnboardingState(status: OnboardingStatus): Promise<void> {
  const db = await getDb();
  const value = JSON.stringify({ status, at: new Date().toISOString() } satisfies OnboardingState);
  await db.run(
    'INSERT INTO settings (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [ONBOARDING_KEY, ONBOARDING_KEY, value],
  );
  await persist();
}

/** null = never completed or skipped; undefined = still loading. */
export function useOnboardingState() {
  return useQuery({ queryKey: ['settings', ONBOARDING_KEY], queryFn: readOnboardingState });
}

export function useSetOnboardingState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: writeOnboardingState,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', ONBOARDING_KEY] }),
  });
}
