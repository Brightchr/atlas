import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { LandingPage } from '@/features/marketing/pages/LandingPage';
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

  if (session.isError) {
    // The server didn't answer (API down, dev proxy 502). The user may well
    // be signed in, so neither the landing page nor /signin is right.
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
        <p className="text-base font-semibold">Can&apos;t reach Atlas</p>
        <p className="max-w-sm text-sm text-muted">
          The server didn&apos;t respond. It retries on its own, or try again now.
        </p>
        <button
          type="button"
          onClick={() => void session.refetch()}
          disabled={session.isFetching}
          className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {session.isFetching ? 'Checking…' : 'Try again'}
        </button>
      </div>
    );
  }

  if (!session.data) {
    // The bare root is a first visit — signed out, atlas-fitness.org IS the
    // marketing page (rendered in place, no /home redirect in the URL bar).
    // A deep link (someone shared /train, a bookmark) means they want IN, so
    // it goes to sign-in and returns them there afterwards.
    if (location.pathname === '/') {
      return <LandingPage />;
    }
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  return children;
}
