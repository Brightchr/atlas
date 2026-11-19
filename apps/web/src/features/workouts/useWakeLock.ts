import { useEffect } from 'react';

/** Keep the screen on while `active` (the live workout screen): a phone that
 * locks between sets means unlocking with chalky hands every two minutes.
 *
 * The browser releases a wake lock whenever the page is hidden (switching
 * apps, locking the phone), so it is re-requested each time the page becomes
 * visible again. Unsupported browsers simply skip it. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) void next.release();
        else lock = next;
      } catch {
        // Denied (battery saver, permissions policy): nothing to do.
      }
    };

    void request();
    document.addEventListener('visibilitychange', request);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', request);
      void lock?.release();
    };
  }, [active]);
}
