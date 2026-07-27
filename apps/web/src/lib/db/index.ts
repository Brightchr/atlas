import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { DB_NAME, DB_VERSION, upgradeStatements } from './schema';

/** Single shared connection to the local database.
 * - Android/iOS: native SQLite via the Capacitor plugin.
 * - Web (dev + browser): sql.js (wasm) persisted to IndexedDB via jeep-sqlite.
 *
 * Init is lazy, time-boxed, and observable: repositories `await getDb()`, and
 * the UI can subscribe to status changes to surface failures clearly instead
 * of hanging silently. */

const INIT_TIMEOUT_MS = 12_000;

export type DbStatus = 'idle' | 'opening' | 'ready' | 'error';

let status: DbStatus = 'idle';
let statusError: string | null = null;
const listeners = new Set<() => void>();

function setStatus(next: DbStatus, error: string | null = null) {
  status = next;
  statusError = error;
  for (const listener of listeners) listener();
}

/** For useSyncExternalStore — lets React components render the DB state. */
export const dbStatusStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getStatus: (): DbStatus => status,
  getError: (): string | null => statusError,
};

const sqlite = new SQLiteConnection(CapacitorSQLite);
let dbPromise: Promise<SQLiteDBConnection> | null = null;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${INIT_TIMEOUT_MS / 1000}s`)),
        INIT_TIMEOUT_MS,
      ),
    ),
  ]);
}

async function openDatabase(): Promise<SQLiteDBConnection> {
  setStatus('opening');

  if (Capacitor.getPlatform() === 'web') {
    const { defineCustomElements } = await import('jeep-sqlite/loader');
    defineCustomElements(window);
    if (!document.querySelector('jeep-sqlite')) {
      document.body.appendChild(document.createElement('jeep-sqlite'));
    }
    await withTimeout(customElements.whenDefined('jeep-sqlite'), 'SQLite component load');
    await withTimeout(sqlite.initWebStore(), 'SQLite web store init');
  }

  await sqlite.addUpgradeStatement(DB_NAME, upgradeStatements);
  const db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
  await withTimeout(db.open(), 'Database open');

  if (Capacitor.getPlatform() === 'web') {
    // Persist the initial (possibly migrated) state to IndexedDB.
    await sqlite.saveToStore(DB_NAME);
  }

  setStatus('ready');
  return db;
}

/** Resolves the shared connection, opening it on first use. */
export function getDb(): Promise<SQLiteDBConnection> {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Local database failed to open:', message);
      setStatus('error', message);
      // Allow a retry on next call instead of caching the failure forever.
      dbPromise = null;
      throw new Error(`Local database unavailable: ${message}`);
    });
  }
  return dbPromise;
}

/** Persist changes on web (no-op on native, where writes are already durable). */
export async function persist(): Promise<void> {
  if (Capacitor.getPlatform() === 'web' && dbPromise) {
    await sqlite.saveToStore(DB_NAME);
  }
}

/** Small helper for generating row ids. */
export function newId(): string {
  return crypto.randomUUID();
}
