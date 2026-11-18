import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, TicketPercent, X } from 'lucide-react';
import { useActivePromotions } from '@/features/billing/api';
import { formatDate } from '@/lib/dates';

const DISMISS_KEY = 'arcadia-promo-dismissed';

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

/** A slim strip for a live promotion — only when one exists, and only until
 * the user closes it (per code, per device: a new promo shows again). The
 * dashboard's hero belongs to the workout; this sits below it. */
export function PromoBanner() {
  const promotions = useActivePromotions();
  const promo = promotions.data?.promotions[0];
  const [dismissed, setDismissed] = useState<string | null>(readDismissed);

  if (!promo || dismissed === promo.code) return null;

  const dismiss = () => {
    setDismissed(promo.code);
    try {
      localStorage.setItem(DISMISS_KEY, promo.code);
    } catch {
      /* private mode: dismissal lasts for this view only */
    }
  };

  return (
    <section className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm shadow-sm">
      <TicketPercent size={16} className="shrink-0 text-accent" aria-hidden />
      <p className="min-w-0 flex-1 truncate">
        <span className="font-semibold">
          {promo.grantDays
            ? `${promo.grantDays} days of full access — free`
            : `${promo.discountPercent}% off your subscription`}
        </span>
        <span className="text-muted">
          {' '}
          with code <span className="font-mono font-semibold text-ink">{promo.code}</span>
          {promo.endsAt && ` · ends ${formatDate(promo.endsAt)}`}
        </span>
      </p>
      <Link
        to="/upgrade"
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-accent hover:underline"
      >
        Redeem
        <ArrowRight size={13} aria-hidden />
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss promotion"
        className="shrink-0 rounded-lg p-1 text-muted transition-colors hover:bg-elev hover:text-ink"
      >
        <X size={14} aria-hidden />
      </button>
    </section>
  );
}
