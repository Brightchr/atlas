import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';

/** Bottom sheet on phones, centered dialog on larger screens. The one modal
 * pattern in the app: pickers, confirmations and menus all open in this, so
 * they never push the page around or get lost below the fold. Closes on
 * backdrop tap and Escape. */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  tall = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the scrolling body — the place for the primary action. */
  footer?: ReactNode;
  /** Use most of the screen height (search pickers). */
  tall?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portalled to <body> so no ancestor (transforms, overflow, stacking
  // contexts) can clip or re-anchor the overlay.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className={`sheet-enter flex w-full max-w-lg flex-col rounded-t-3xl border border-line bg-surface shadow-2xl sm:rounded-3xl ${
          tall ? 'h-[88dvh] sm:h-[80dvh]' : 'max-h-[88dvh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 py-2 pr-2 pl-5">
          <h2 className="truncate text-lg font-bold">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={20} aria-hidden />
          </IconButton>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-y-auto px-5 ${
            footer ? 'pb-4' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))]'
          }`}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** A destructive (or just important) yes/no, as a sheet. */
export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  danger = true,
  pending = false,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="text-sm text-muted">{body}</p>
      <div className="mt-5 grid gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className={`springy min-h-12 rounded-xl px-5 text-base font-semibold disabled:opacity-50 ${
            danger
              ? 'bg-rose-500 text-white hover:bg-rose-600'
              : 'bg-linear-to-r from-accent to-accent-2 text-accent-ink'
          }`}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="springy min-h-12 rounded-xl border border-line px-5 text-base font-semibold hover:bg-elev"
        >
          Cancel
        </button>
      </div>
    </Sheet>
  );
}
