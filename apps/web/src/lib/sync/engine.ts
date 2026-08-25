import { queryClient } from '@/app/providers';
import { apiFetch } from '@/lib/api';
import { getDb, newId, onPersist, persist } from '@/lib/db';
import {
  EXTRA_SYNC_TABLES,
  SYNCED_TABLES,
  TRAINING_SYNC_TABLES,
  seedPendingStatements,
} from '@/lib/db/schema';

/** Device sync engine — local-first with a server relay.
 *
 * The local SQLite stays the source of truth for the UI. Triggers (see
 * schema.ts v7) record every write into sync_pending; this engine pushes
 * those rows to the API and pulls what the user's *other* devices pushed,
 * applying them with last-write-wins on the change timestamp. The server
 * never parses payloads — it's an ordered per-user replica log.
 *
 * Order matters: always pull before push, so a remote change that lost to a
 * newer local edit is discarded here (LWW) instead of silently clobbering it
 * on the server.
 */

const PUSH_BATCH = 400;
const WRITE_DEBOUNCE_MS = 2_500;
const PERIODIC_MS = 5 * 60 * 1000;
const BASE_TABLES = [...SYNCED_TABLES, ...EXTRA_SYNC_TABLES];

/** The entities this sync pass covers — refreshed at the start of every
 * syncNow because training sync is a user setting, not a constant. */
let SYNCED = new Set<string>(BASE_TABLES);

async function refreshSyncedSet(): Promise<void> {
  SYNCED = (await isTrainingSyncEnabled())
    ? new Set<string>([...BASE_TABLES, ...TRAINING_SYNC_TABLES])
    : new Set<string>(BASE_TABLES);
}

export interface SyncState {
  status: 'off' | 'idle' | 'syncing' | 'error';
  lastSyncAt: string | null;
  error: string | null;
  /** Set when this device's data belongs to a different signed-in account. */
  accountMismatch: boolean;
  /** True once the session's first sync pass has settled (ran, failed, or
   * couldn't run). Gates decisions that must not race the initial pull —
   * e.g. "this user has no profile, send them to onboarding". */
  firstSyncDone: boolean;
}

let state: SyncState = {
  status: 'idle',
  lastSyncAt: null,
  error: null,
  accountMismatch: false,
  firstSyncDone: false,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

/** For useSyncExternalStore. */
export const syncStore = {
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot: (): SyncState => state,
};

// ---------- sync_meta helpers ----------

async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = (await db.query('SELECT value FROM sync_meta WHERE key = ?', [key])).values as {
    value: string;
  }[];
  return rows[0]?.value ?? null;
}

async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

async function getDeviceId(): Promise<string> {
  let id = await getMeta('deviceId');
  if (!id) {
    id = newId();
    await setMeta('deviceId', id);
    await persist(); // survive reloads on web — the id must be stable per device
  }
  return id;
}

export async function isSyncEnabled(): Promise<boolean> {
  return (await getMeta('enabled')) !== '0'; // on by default
}

/** Training data (plans, workouts, session history) syncs BY DEFAULT — the
 * flag is an opt-out for people who want training kept on-device. */
export async function isTrainingSyncEnabled(): Promise<boolean> {
  return (await getMeta('trainingSync')) !== '0';
}

/** Plans the user pinned to this device — never pushed, and remote changes
 * to them are not applied. */
async function localOnlyPlanIds(): Promise<Set<string>> {
  const db = await getDb();
  const rows = (await db.query('SELECT id FROM training_plans WHERE local_only = 1'))
    .values as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

/** True when this entity/row belongs to a local-only plan. Day rows encode
 * their plan in the deterministic id (`planId#dayOfWeek`, see schema v9). */
function belongsToLocalOnlyPlan(entity: string, rowId: string, localOnly: Set<string>): boolean {
  if (localOnly.size === 0) return false;
  if (entity === 'training_plans') return localOnly.has(rowId);
  if (entity === 'training_plan_days') {
    const hash = rowId.lastIndexOf('#');
    return hash > 0 && localOnly.has(rowId.slice(0, hash));
  }
  return false;
}

// ---------- wire shapes ----------

interface Change {
  entity: string;
  rowId: string;
  payload: Record<string, unknown> | null;
  deleted: boolean;
  changedAt: string;
}

interface PullResponse {
  changes: Change[];
  cursor: string;
  hasMore: boolean;
}

// ---------- applying remote changes ----------

const columnCache = new Map<string, Set<string>>();

async function tableColumns(table: string): Promise<Set<string>> {
  const cached = columnCache.get(table);
  if (cached) return cached;
  const db = await getDb();
  const rows = (await db.query(`PRAGMA table_info(${table})`)).values as { name: string }[];
  const cols = new Set(rows.map((r) => r.name));
  columnCache.set(table, cols);
  return cols;
}

interface SqlStatement {
  statement: string;
  values: unknown[];
}

const SUSPEND_ON: SqlStatement = {
  statement:
    "INSERT INTO sync_meta (key, value) VALUES ('suspend', '1') ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  values: [],
};
const SUSPEND_OFF: SqlStatement = { ...SUSPEND_ON, values: [] };
SUSPEND_OFF.statement = SUSPEND_ON.statement.replace("'1'", "'0'");

/** Builds the statements that apply one remote change, or null to skip it
 * (unknown entity, or a newer local pending edit that should win LWW). */
async function buildApplyStatements(
  ch: Change,
  pendingAt: string | undefined,
  localOnly: Set<string>,
): Promise<SqlStatement[] | null> {
  if (!SYNCED.has(ch.entity)) return null; // unknown entity (newer app version elsewhere)
  // A plan pinned to this device keeps local authority — remote edits and
  // deletes for it are ignored here.
  if (belongsToLocalOnlyPlan(ch.entity, ch.rowId, localOnly)) return null;
  // Local pending edit that is newer wins — it will push and overwrite the
  // server row. Older local pending loses: drop it and take the remote row.
  if (pendingAt && pendingAt > ch.changedAt) return null;

  const statements: SqlStatement[] = [];
  if (ch.deleted) {
    statements.push({ statement: `DELETE FROM ${ch.entity} WHERE id = ?`, values: [ch.rowId] });
  } else if (ch.payload) {
    // Filter to columns this device's schema actually has (tolerates version
    // skew between devices). Upsert via ON CONFLICT — never INSERT OR REPLACE,
    // which is delete+insert and trips foreign keys on referenced rows.
    const cols = await tableColumns(ch.entity);
    const entries = Object.entries(ch.payload).filter(([k]) => k !== 'id' && cols.has(k));
    if (entries.length === 0) return null;
    const names = entries.map(([k]) => k);
    statements.push({
      statement: `INSERT INTO ${ch.entity} (id, ${names.join(', ')})
         VALUES (?${', ?'.repeat(names.length)})
         ON CONFLICT(id) DO UPDATE SET ${names.map((k) => `${k} = excluded.${k}`).join(', ')}`,
      values: [ch.rowId, ...entries.map(([, v]) => v ?? null)],
    });
  } else {
    return null;
  }
  if (pendingAt) {
    // The remote row won: retire the stale local claim (guarded by timestamp
    // so a write racing this apply keeps its fresher pending entry).
    statements.push({
      statement: 'DELETE FROM sync_pending WHERE entity = ? AND row_id = ? AND changed_at = ?',
      values: [ch.entity, ch.rowId, pendingAt],
    });
  }
  return statements;
}

/** Applies a page of remote changes in ONE native transaction (executeSet),
 * bracketed by the trigger-suspend flag — no user write can interleave, so
 * nothing is ever silently untracked. Falls back to change-by-change if the
 * batch fails (e.g. one row violates a constraint), skipping only bad rows. */
async function applyPage(changes: Change[]): Promise<number> {
  if (changes.length === 0) return 0;
  const db = await getDb();

  const pendingRows = (
    await db.query('SELECT entity, row_id, changed_at FROM sync_pending')
  ).values as PendingRow[];
  const pendingAt = new Map(pendingRows.map((p) => [`${p.entity}:${p.row_id}`, p.changed_at]));
  const localOnly = await localOnlyPlanIds();

  const perChange: SqlStatement[][] = [];
  for (const ch of changes) {
    const stmts = await buildApplyStatements(
      ch,
      pendingAt.get(`${ch.entity}:${ch.rowId}`),
      localOnly,
    );
    if (stmts) perChange.push(stmts);
  }
  if (perChange.length === 0) return 0;

  try {
    await db.executeSet([SUSPEND_ON, ...perChange.flat(), SUSPEND_OFF], true);
    return perChange.length;
  } catch (batchErr) {
    console.warn('sync: batch apply failed, retrying change-by-change:', batchErr);
    let applied = 0;
    try {
      await setMeta('suspend', '1');
      for (const stmts of perChange) {
        try {
          for (const s of stmts) await db.run(s.statement, s.values as never[]);
          applied += 1;
        } catch (err) {
          // A single bad row (e.g. FK to something this device lacks) must not
          // wedge the whole sync — skip it; the cursor moves on regardless.
          console.warn('sync: skipped one change:', err);
        }
      }
    } finally {
      await setMeta('suspend', '0');
    }
    return applied;
  }
}

async function pullAll(deviceId: string): Promise<number> {
  let applied = 0;
  for (;;) {
    const since = (await getMeta('cursor')) ?? '0';
    const res = await apiFetch<PullResponse>(
      `/v1/sync/pull?since=${since}&deviceId=${encodeURIComponent(deviceId)}`,
    );
    applied += await applyPage(res.changes);
    if (res.cursor !== since) {
      await setMeta('cursor', res.cursor);
      await persist();
    }
    if (!res.hasMore) return applied;
  }
}

// ---------- pushing local changes ----------

interface PendingRow {
  entity: string;
  row_id: string;
  op: string;
  changed_at: string;
}

async function pushAll(deviceId: string): Promise<void> {
  const db = await getDb();
  for (;;) {
    const pending = (
      await db.query(
        `SELECT entity, row_id, op, changed_at FROM sync_pending ORDER BY changed_at LIMIT ${PUSH_BATCH}`,
      )
    ).values as PendingRow[];
    if (pending.length === 0) return;

    // Fetch current row payloads per entity in one query each.
    const byEntity = new Map<string, PendingRow[]>();
    for (const p of pending) {
      if (!SYNCED.has(p.entity)) continue;
      const list = byEntity.get(p.entity) ?? [];
      list.push(p);
      byEntity.set(p.entity, list);
    }
    const payloads = new Map<string, Record<string, unknown>>();
    for (const [entity, rows] of byEntity) {
      const ids = rows.filter((r) => r.op === 'upsert').map((r) => r.row_id);
      if (ids.length === 0) continue;
      const placeholders = ids.map(() => '?').join(',');
      const found = (
        await db.query(`SELECT * FROM ${entity} WHERE id IN (${placeholders})`, ids)
      ).values as Record<string, unknown>[];
      for (const row of found) payloads.set(`${entity}:${String(row.id)}`, row);
    }

    const localOnly = await localOnlyPlanIds();
    const changes: Change[] = [];
    for (const p of pending) {
      if (!SYNCED.has(p.entity)) continue;
      // Local-only plans never push content. Deletes still go through — that
      // is how pinning a previously-synced plan removes its server copy.
      if (p.op !== 'delete' && belongsToLocalOnlyPlan(p.entity, p.row_id, localOnly)) continue;
      const payload = payloads.get(`${p.entity}:${p.row_id}`) ?? null;
      // Deletes come ONLY from real delete ops. A pending 'upsert' whose row
      // is missing locally is stale bookkeeping (interrupted apply, wiped
      // store) — pushing it as a delete would tombstone healthy server data,
      // so it's dropped instead (the pending row clears below).
      if (p.op !== 'delete' && payload === null) continue;
      changes.push({
        entity: p.entity,
        rowId: p.row_id,
        payload: p.op === 'delete' ? null : payload,
        deleted: p.op === 'delete',
        changedAt: p.changed_at,
      });
    }

    if (changes.length > 0) {
      await apiFetch<{ accepted: number; cursor: string }>('/v1/sync/push', {
        method: 'POST',
        body: JSON.stringify({ deviceId, changes }),
      });
    }
    // Clear exactly what was sent; a row re-edited mid-push keeps its newer
    // pending entry (changed_at no longer matches).
    for (const p of pending) {
      await db.run(
        'DELETE FROM sync_pending WHERE entity = ? AND row_id = ? AND changed_at = ?',
        [p.entity, p.row_id, p.changed_at],
      );
    }
    await persist();
    if (pending.length < PUSH_BATCH) return;
  }
}

// ---------- orchestration ----------

let running = false;
let queued = false;
let currentUserId: string | null = null;

// Failed syncs retry on their own with exponential backoff (30s → 10min cap),
// so a flaky connection or a server deploy heals without user action.
let failStreak = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleRetry() {
  failStreak += 1;
  const delay = Math.min(30_000 * 2 ** (failStreak - 1), 600_000);
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void syncNow(), delay);
}

export async function syncNow(): Promise<void> {
  if (running) {
    queued = true;
    return;
  }
  if (!navigator.onLine || !currentUserId) {
    // Can't sync at all — don't leave firstSyncDone consumers waiting forever.
    setState({ firstSyncDone: true });
    return;
  }
  if (!(await isSyncEnabled())) {
    setState({ status: 'off', firstSyncDone: true });
    return;
  }

  // Never mix accounts: this device's data belongs to whoever synced first.
  const boundAccount = await getMeta('accountId');
  if (boundAccount && boundAccount !== currentUserId) {
    setState({ status: 'off', accountMismatch: true, firstSyncDone: true });
    return;
  }

  running = true;
  setState({ status: 'syncing', error: null });
  try {
    await refreshSyncedSet();
    const deviceId = await getDeviceId();
    const applied = await pullAll(deviceId);
    await pushAll(deviceId);
    if (!boundAccount) await setMeta('accountId', currentUserId);
    const at = new Date().toISOString();
    await setMeta('lastSyncAt', at);
    failStreak = 0;
    clearTimeout(retryTimer);
    setState({ status: 'idle', lastSyncAt: at });
    if (applied > 0) await queryClient.invalidateQueries();
  } catch (err) {
    setState({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    scheduleRetry();
  } finally {
    setState({ firstSyncDone: true });
    running = false;
    if (queued) {
      queued = false;
      void syncNow();
    }
  }
}

/** Backfill statements for everything that should sync right now — the base
 * tables plus training when its opt-in is on. */
async function activeSeedStatements(): Promise<string[]> {
  const tables = (await isTrainingSyncEnabled())
    ? [...BASE_TABLES, ...TRAINING_SYNC_TABLES]
    : [...BASE_TABLES];
  return seedPendingStatements(tables);
}

/** Turn sync on (seeds a full backfill so the server copy is complete even if
 * it was deleted) or off. Turning it off can also erase the server copy. */
export async function setSyncEnabled(
  enabled: boolean,
  opts?: { deleteServerCopy?: boolean },
): Promise<void> {
  await setMeta('enabled', enabled ? '1' : '0');
  if (enabled) {
    const db = await getDb();
    for (const sql of await activeSeedStatements()) await db.execute(sql);
    await persist();
    setState({ status: 'idle' });
    void syncNow();
  } else {
    if (opts?.deleteServerCopy) {
      await apiFetch<{ ok: boolean }>('/v1/sync/data', { method: 'DELETE' });
    }
    setState({ status: 'off' });
  }
}

/** Rebinds this device's data to the currently signed-in account (after a
 * mismatch): full pull of their data merges with what's here, then push all. */
export async function adoptCurrentAccount(): Promise<void> {
  if (!currentUserId) return;
  await setMeta('accountId', currentUserId);
  await setMeta('cursor', '0');
  const db = await getDb();
  for (const sql of await activeSeedStatements()) await db.execute(sql);
  await persist();
  setState({ accountMismatch: false });
  void syncNow();
}

/** Opt training data in or out of sync. Turning it ON seeds a training
 * backfill and rewinds the pull cursor to 0 — training changes other devices
 * pushed earlier were skipped as unknown entities, and only a full re-pull
 * can recover them (applying is idempotent, so replaying the log is safe).
 * Turning it OFF leaves already-synced training data in the server backup;
 * it simply stops flowing. */
export async function setTrainingSyncEnabled(enabled: boolean): Promise<void> {
  await setMeta('trainingSync', enabled ? '1' : '0');
  if (enabled) {
    await setMeta('cursor', '0');
    const db = await getDb();
    for (const sql of seedPendingStatements([...TRAINING_SYNC_TABLES])) await db.execute(sql);
    await persist();
    void syncNow();
  }
}

/** Wires the engine to the app lifecycle. Call once per signed-in session;
 * returns a cleanup for sign-out/unmount. */
export function startSync(userId: string): () => void {
  currentUserId = userId;

  let debounce: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => void syncNow(), WRITE_DEBOUNCE_MS);
  };
  const onOnline = () => void syncNow();
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow();
  };

  const offPersist = onPersist(schedule);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(() => void syncNow(), PERIODIC_MS);

  void isSyncEnabled().then(async (enabled) => {
    if (!enabled) {
      const mismatch = (await getMeta('accountId')) !== null &&
        (await getMeta('accountId')) !== userId;
      setState({ status: 'off', accountMismatch: mismatch, firstSyncDone: true });
      return;
    }
    setState({ lastSyncAt: await getMeta('lastSyncAt') });
    void syncNow();
  });

  return () => {
    currentUserId = null;
    clearTimeout(debounce);
    offPersist();
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
  };
}
