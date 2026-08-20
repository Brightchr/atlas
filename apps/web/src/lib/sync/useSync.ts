import { useSyncExternalStore } from 'react';
import { syncStore, type SyncState } from './engine';

/** Live sync engine state for UI (settings section, status chips). */
export function useSyncState(): SyncState {
  return useSyncExternalStore(syncStore.subscribe, syncStore.getSnapshot);
}
