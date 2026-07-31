import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDb, persist } from '@/lib/db';

/** Where the user trains and what their home setup has. Gym access implies
 * all equipment; the home equipment list powers the "only my equipment"
 * exercise filter. Stored as JSON in the local settings table. */

export type TrainingLocation = 'home' | 'gym' | 'both';

export interface TrainingSetup {
  location: TrainingLocation;
  /** Equipment ids (exercise-db vocabulary) available at home. */
  homeEquipmentIds: number[];
}

export const DEFAULT_TRAINING_SETUP: TrainingSetup = { location: 'gym', homeEquipmentIds: [] };

const KEY = 'training_setup';

async function readSetup(): Promise<TrainingSetup> {
  const db = await getDb();
  const rows = (await db.query('SELECT value FROM settings WHERE key = ?', [KEY])).values as {
    value: string;
  }[];
  if (!rows[0]) return DEFAULT_TRAINING_SETUP;
  try {
    const parsed = JSON.parse(rows[0].value) as Partial<TrainingSetup>;
    return {
      location: parsed.location ?? 'gym',
      homeEquipmentIds: Array.isArray(parsed.homeEquipmentIds) ? parsed.homeEquipmentIds : [],
    };
  } catch {
    return DEFAULT_TRAINING_SETUP;
  }
}

async function writeSetup(setup: TrainingSetup): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [KEY, JSON.stringify(setup)],
  );
  await persist();
}

export function useTrainingSetup(): TrainingSetup {
  const query = useQuery({ queryKey: ['settings', KEY], queryFn: readSetup });
  return query.data ?? DEFAULT_TRAINING_SETUP;
}

export function useSaveTrainingSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: writeSetup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', KEY] }),
  });
}
