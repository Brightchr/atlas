import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';

/** Go back the way the user came; if they landed here directly (a shared
 * link, a refresh), go to `fallback` instead. One behaviour for every back
 * button in the app. */
export function useBack(fallback: string): () => void {
  const navigate = useNavigate();
  return () => {
    // React Router stamps an index on history entries it created; 0 means
    // this is the first page of the visit and there is nothing to go back to.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) void navigate(-1);
    else void navigate(fallback, { replace: true });
  };
}

/** The title row at the top of a page: optional back button, title, optional
 * subtitle, and room for one or two actions on the right. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Where back goes when there is no history. Omit on top-level tabs. */
  back?: string;
  actions?: ReactNode;
}) {
  const goBack = useBack(back ?? '/');
  return (
    <header className="flex items-center gap-2">
      {back && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="springy -ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-elev hover:text-ink"
        >
          <ChevronLeft size={24} aria-hidden />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold">{title}</h1>
        {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
