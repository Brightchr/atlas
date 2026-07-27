import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Mountain } from 'lucide-react';
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
        <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-accent-ink shadow-md">
          <Mountain size={22} aria-hidden />
        </span>
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!session.data) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return children;
}
