import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}

/** First / previous / "Page x of y" / next / last. Hidden entirely for a
 * single page. The parent owns the page state (and any scroll reset). */
export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  const button =
    'flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface shadow-sm transition-colors hover:bg-elev disabled:opacity-40 disabled:hover:bg-surface';

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 pt-2">
      <button
        type="button"
        aria-label="First page"
        disabled={page <= 1}
        onClick={() => onChange(1)}
        className={button}
      >
        <ChevronsLeft size={16} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={button}
      >
        <ChevronLeft size={16} aria-hidden />
      </button>
      <span className="px-1.5 text-sm text-muted tabular-nums">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className={button}
      >
        <ChevronRight size={16} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Last page"
        disabled={page >= pageCount}
        onClick={() => onChange(pageCount)}
        className={button}
      >
        <ChevronsRight size={16} aria-hidden />
      </button>
    </nav>
  );
}
