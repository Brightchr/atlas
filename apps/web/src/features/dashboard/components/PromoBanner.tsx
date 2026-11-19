import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, TicketPercent, X } from 'lucide-react';
import { IconButton } from '@/components/ui';
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
 * the user closes it (per code, per device: a new promo shows again). It
 * sits at the very bottom of Home: today's content comes first. */
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
    <section className="flex items-center gap-1 rounded-2xl border border-accent/30 bg-accent-soft py-1 pr-1 pl-4 text-sm shadow-sm">
      <TicketPercent size={18} className="mr-2 shrink-0 text-accent" aria-hidden />
      {/* Wraps onto two lines on a phone instead of truncating: the code and
          the end date are the whole point of the strip. */}
      <p className="min-w-0 flex-1 py-1.5">
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
        className="springy inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-accent hover:underline"
      >
        Redeem
        <ArrowRight size={16} aria-hidden />
      </Link>
      <IconButton label="Dismiss promotion" onClick={dismiss}>
        <X size={18} aria-hidden />
      </IconButton>
    </section>
  );
}
