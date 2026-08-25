import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDb, persist } from '@/lib/db';

/** Whether the rest countdown auto-starts after logging a set. Some people
 * live by it, some find it nagging — so it's a remembered preference, toggled
 * right on the session screen where it either helps or annoys. */

const KEY = 'rest_timer_enabled';

async function readEnabled(): Promise<boolean> {
  const db = await getDb();
  const rows = (await db.query('SELECT value FROM settings WHERE key = ?', [KEY])).values as {
    value: string;
  }[];
  return rows[0]?.value !== '0'; // on by default
}

async function writeEnabled(enabled: boolean): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT INTO settings (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [KEY, KEY, enabled ? '1' : '0'],
  );
  await persist();
}

export function useRestTimerEnabled(): boolean {
  const query = useQuery({ queryKey: ['settings', KEY], queryFn: readEnabled });
  return query.data ?? true;
}

export function useSetRestTimerEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: writeEnabled,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', KEY] }),
  });
}
