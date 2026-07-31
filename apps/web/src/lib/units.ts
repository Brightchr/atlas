import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDb, persist } from '@/lib/db';

/** Unit preference (metric kg/cm vs imperial lb/in) and conversion helpers.
 * ALL stored data stays metric — kg in sqlite, cm in the profile. The unit
 * system only changes what the user sees and types; values are converted at
 * the input/display boundary. */

export type UnitSystem = 'metric' | 'imperial';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const cmToIn = (cm: number): number => cm / CM_PER_IN;
export const inToCm = (inches: number): number => inches * CM_PER_IN;

export const weightUnit = (units: UnitSystem): string => (units === 'metric' ? 'kg' : 'lb');
export const heightUnit = (units: UnitSystem): string => (units === 'metric' ? 'cm' : 'in');

/** kg → display number in the preferred unit (1 decimal, trailing .0 dropped). */
export function displayWeight(kg: number, units: UnitSystem): number {
  const value = units === 'metric' ? kg : kgToLb(kg);
  return Math.round(value * 10) / 10;
}

/** User-typed weight in the preferred unit → kg for storage. */
export function parseWeight(value: number, units: UnitSystem): number {
  const kg = units === 'metric' ? value : lbToKg(value);
  return Math.round(kg * 100) / 100;
}

export function formatWeight(kg: number, units: UnitSystem): string {
  return `${displayWeight(kg, units)} ${weightUnit(units)}`;
}

export function displayHeight(cm: number, units: UnitSystem): number {
  return units === 'metric' ? cm : Math.round(cmToIn(cm) * 10) / 10;
}

export function parseHeight(value: number, units: UnitSystem): number {
  return units === 'metric' ? value : Math.round(inToCm(value) * 10) / 10;
}

const UNITS_KEY = 'units';

async function readUnits(): Promise<UnitSystem> {
  const db = await getDb();
  const rows = (await db.query('SELECT value FROM settings WHERE key = ?', [UNITS_KEY]))
    .values as { value: string }[];
  return rows[0]?.value === 'imperial' ? 'imperial' : 'metric';
}

async function writeUnits(units: UnitSystem): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [UNITS_KEY, units],
  );
  await persist();
}

/** The unit preference, shared app-wide via the query cache. Defaults to
 * metric until the setting loads (metric is also the storage format, so a
 * flash of metric is never wrong data — just the other unit). */
export function useUnits(): UnitSystem {
  const query = useQuery({ queryKey: ['settings', UNITS_KEY], queryFn: readUnits });
  return query.data ?? 'metric';
}

export function useSetUnits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: writeUnits,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', UNITS_KEY] }),
  });
}
