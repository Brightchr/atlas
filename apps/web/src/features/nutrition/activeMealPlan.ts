import { getDb, persist } from '@/lib/db';

/** Which meal plan the week is based on — template key or a hand-built
 * custom plan. Synced via settings so every device agrees. The week's items
 * stay fully editable; this is provenance, not a lock. */
export interface ActiveMealPlan {
  kind: 'template' | 'custom';
  /** Template key when kind = 'template'. */
  key?: string;
  name: string;
  appliedAt: string;
}

const KEY = 'active_meal_plan';

export async function getActiveMealPlan(): Promise<ActiveMealPlan | null> {
  const db = await getDb();
  const rows = (await db.query('SELECT value FROM settings WHERE key = ?', [KEY])).values as {
    value: string;
  }[];
  if (!rows[0]?.value) return null;
  try {
    const parsed = JSON.parse(rows[0].value) as ActiveMealPlan;
    return parsed && typeof parsed.name === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export async function setActiveMealPlan(plan: ActiveMealPlan | null): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT INTO settings (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [KEY, KEY, plan ? JSON.stringify(plan) : ''],
  );
  await persist();
}
