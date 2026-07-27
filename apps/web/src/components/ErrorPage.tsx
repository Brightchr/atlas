import { Link, useRouteError } from 'react-router';
import { TriangleAlert } from 'lucide-react';

/** Router-level error boundary: an unexpected render/loader crash lands here
 * instead of a blank screen. */
export function ErrorPage() {
  const error = useRouteError();
  const message =
    error instanceof Error ? error.message : 'Something went wrong while rendering this page.';

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg p-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500">
        <TriangleAlert size={26} aria-hidden />
      </span>
      <div>
        <h1 className="text-xl font-bold">Something broke</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{message}</p>
      </div>
      <Link
        to="/"
        reloadDocument
        className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90"
      >
        Reload the app
      </Link>
    </div>
  );
}
