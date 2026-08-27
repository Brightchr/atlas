import { Link } from 'react-router';
import { ArrowRight, TicketPercent } from 'lucide-react';
import { useActivePromotions } from '@/features/billing/api';
import { formatDate } from '@/lib/dates';

/** The dashboard hero slot, reserved for things WE post: when a promotion is
 * live it takes over the banner; otherwise the evergreen brand card shows.
 * This slot is deliberately not draggable — it's ours, not the user's. */
export function PromoBanner() {
  const promotions = useActivePromotions();
  const promo = promotions.data?.promotions[0];

  return (
    <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-accent to-accent-2 p-6 text-accent-ink shadow-lg md:p-8">
      <div
        aria-hidden
        className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-accent-ink/10 blur-2xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-24 right-24 h-48 w-48 rounded-full border border-accent-ink/15"
      />
      {promo ? (
        <>
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase opacity-80">
            <TicketPercent size={14} aria-hidden />
            Limited offer
          </p>
          <h2 className="mt-2 max-w-md text-2xl font-bold md:text-3xl">
            {promo.grantDays
              ? `${promo.grantDays} days of full access — free`
              : `${promo.discountPercent}% off your subscription`}
          </h2>
          <p className="mt-1.5 max-w-sm text-sm opacity-85">
            {promo.description || 'Use the code below on the upgrade page.'}
            {promo.endsAt && ` Ends ${formatDate(promo.endsAt)}.`}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="rounded-xl border border-accent-ink/25 bg-accent-ink/10 px-3.5 py-2 font-mono text-sm font-bold tracking-wider backdrop-blur-sm">
              {promo.code}
            </span>
            <Link
              to="/upgrade"
              className="inline-flex items-center gap-2 rounded-xl border border-accent-ink/20 bg-accent-ink/10 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-accent-ink/20"
            >
              Redeem now
              <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold tracking-widest uppercase opacity-80">
            Arcadia Atlas
          </p>
          <h2 className="mt-2 max-w-md text-2xl font-bold md:text-3xl">
            Stay on top of your health
          </h2>
          <p className="mt-1.5 max-w-sm text-sm opacity-85">
            Workouts, meals and progress — tracked in one place, on every device.
          </p>
          <Link
            to="/train/library"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-accent-ink/20 bg-accent-ink/10 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-accent-ink/20"
          >
            Start training
            <ArrowRight size={15} aria-hidden />
          </Link>
        </>
      )}
    </section>
  );
}
