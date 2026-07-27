import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { DB_NAME, DB_VERSION, upgradeStatements } from './schema';

/** Single shared connection to the local database.
 * - Android/iOS: native SQLite via the Capacitor plugin.
 * - Web (dev + browser): sql.js (wasm) persisted to IndexedDB via jeep-sqlite.
 *
 * Init is lazy and non-blocking: the app renders immediately and repositories
 * `await getDb()`, which resolves once the connection is open. */

const sqlite = new SQLiteConnection(CapacitorSQLite);
let dbPromise: Promise<SQLiteDBConnection> | null = null;

async function openDatabase(): Promise<SQLiteDBConnection> {
  if (Capacitor.getPlatform() === 'web') {
    const { defineCustomElements } = await import('jeep-sqlite/loader');
    defineCustomElements(window);
    const jeepEl = document.createElement('jeep-sqlite');
    document.body.appendChild(jeepEl);
    await customElements.whenDefined('jeep-sqlite');
    await sqlite.initWebStore();
  }

  await sqlite.addUpgradeStatement(DB_NAME, upgradeStatements);
  const db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
  await db.open();

  if (Capacitor.getPlatform() === 'web') {
    // Persist the initial (possibly migrated) state to IndexedDB.
    await sqlite.saveToStore(DB_NAME);
  }

  return db;
}

/** Resolves the shared connection, opening it on first use. */
export function getDb(): Promise<SQLiteDBConnection> {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((err) => {
      // Allow a retry on next call instead of caching the failure forever.
      dbPromise = null;
      throw err;
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
