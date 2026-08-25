import { useState } from 'react';
import { TicketPercent } from 'lucide-react';
import { useCreatePromotion, usePromotions, useTogglePromotion } from '../api';

/** Promo codes: create with an optional redemption cap and an optional
 * instant grant (days of pro). Discount-only codes wait for checkout. */
export function PromotionsSection() {
  const promotions = usePromotions();
  const create = useCreatePromotion();
  const toggle = useTogglePromotion();
  const [code, setCode] = useState('');
  const [percent, setPercent] = useState('25');
  const [description, setDescription] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [grantDays, setGrantDays] = useState('');

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <TicketPercent size={18} className="text-accent" aria-hidden />
        Promotions
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE (e.g. LAUNCH25)"
          className="w-44 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <input
          type="number"
          min="1"
          max="100"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          className="w-20 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          aria-label="Discount percent"
        />
        <span className="text-sm text-muted">% off</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="w-56 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <input
          type="number"
          min="1"
          value={maxRedemptions}
          onChange={(e) => setMaxRedemptions(e.target.value)}
          placeholder="Max uses"
          className="w-28 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
          aria-label="Maximum redemptions (blank = unlimited)"
          title="Maximum redemptions (blank = unlimited)"
        />
        <input
          type="number"
          min="1"
          value={grantDays}
          onChange={(e) => setGrantDays(e.target.value)}
          placeholder="Grant days"
          className="w-28 rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
          aria-label="Days of pro granted instantly (blank = checkout discount)"
          title="Days of pro granted instantly (blank = checkout discount)"
        />
        <button
          type="button"
          disabled={code.length < 3 || create.isPending}
          onClick={() => {
            create.mutate({
              code,
              description,
              discountPercent: Number(percent) || 25,
              maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
              grantDays: grantDays ? Number(grantDays) : null,
            });
            setCode('');
            setDescription('');
            setMaxRedemptions('');
            setGrantDays('');
          }}
          className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Create
        </button>
      </div>
      {create.isError && <p className="text-sm text-rose-500">{create.error.message}</p>}
      {promotions.data?.promotions.length === 0 && (
        <p className="text-sm text-muted">No promotions yet.</p>
      )}
      <ul className="space-y-2">
        {promotions.data?.promotions.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-2xl border border-line bg-surface p-3 shadow-sm"
          >
            <div>
              <p className="font-mono text-sm font-semibold">
                {p.code}{' '}
                <span className="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                  {p.discountPercent}% off
                </span>
                {p.grantDays !== null && (
                  <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-500">
                    grants {p.grantDays}d
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">
                {p.description && <span>{p.description} · </span>}
                {p.redemptions} redeemed
                {p.maxRedemptions !== null && ` of ${p.maxRedemptions}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggle.mutate({ id: p.id, active: !p.active })}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                p.active
                  ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25'
                  : 'bg-elev text-muted hover:text-ink'
              }`}
            >
              {p.active ? 'Active' : 'Inactive'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
