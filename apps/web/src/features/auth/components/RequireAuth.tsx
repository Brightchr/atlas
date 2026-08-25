import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '../api';

/** Route guard: the app is an authenticated space. While the session check is
 * in flight a splash shows (no redirect flicker on refresh); signed-out users
 * land on /signin and are sent back to where they were headed afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg">
        <img
          src="/favicon/android-chrome-192x192.png"
          alt=""
          className="h-12 w-12 animate-pulse"
        />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!session.data) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return children;
}
