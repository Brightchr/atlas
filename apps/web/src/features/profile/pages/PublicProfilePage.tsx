import { Link, useParams } from 'react-router';
import { CalendarDays, MessageSquare, Star, TrendingUp } from 'lucide-react';
import { bannerCss, usePublicProfile } from '../api';
import { AvatarIcon } from '../avatars';
import { useCurrentUser } from '@/features/auth/api';
import { ReportButton } from '@/features/reports/components/ReportButton';
import { DIET_LABELS, GOAL_LABELS, LEVEL_LABELS } from '@/features/training/profile';
import { formatDate } from '@/lib/dates';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={13}
          className={i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-line'}
          aria-hidden
        />
      ))}
    </span>
  );
}

/** A user's public page: banner, avatar, reputation, published plans, the
 * reviews they've written, recent activity, and (if shared) their goals.
 * Every section here is opt-out — the server already withheld anything the
 * owner made private. Sign-in is required to reach this route at all. */
export function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const profile = usePublicProfile(username);
  const { data: me } = useCurrentUser();

  if (profile.isError) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center text-sm text-muted">
        No user called “{username}”.{' '}
        <Link to="/train/schedule" className="text-accent hover:underline">
          Back to plans
        </Link>
      </div>
    );
  }
  if (!profile.data) return null;
  const p = profile.data;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      {/* Banner + identity */}
      <header className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="h-28 md:h-36" style={{ background: bannerCss(p.bannerId) }} />
        <div className="relative px-5 pt-0 pb-4">
          <span className="absolute -top-7 rounded-2xl border-4 border-surface bg-elev p-1 shadow-md">
            <AvatarIcon
              name={p.username}
              icon={p.avatarIcon || null}
              tone={p.avatarTone || null}
              online={p.online}
              size="lg"
            />
          </span>
          <div className="pt-11">
            <h1 className="text-2xl font-bold">{p.displayName ?? p.username}</h1>
            <p className="text-sm text-muted">
              @{p.username} · member since{' '}
              {new Date(p.memberSince).toLocaleDateString([], { month: 'long', year: 'numeric' })}
              {p.online === true && <span className="ml-1.5 font-medium text-emerald-500">· online</span>}
            </p>
            {p.bio && <p className="mt-2 text-sm">{p.bio}</p>}
          </div>
          {p.stats && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-elev px-3 py-1.5 text-xs font-semibold">
                <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden />
                {p.stats.rating !== null ? `${p.stats.rating} overall` : 'No ratings yet'}
              </span>
              <span className="rounded-full bg-elev px-3 py-1.5 text-xs font-semibold tabular-nums">
                {p.stats.planCount} plan{p.stats.planCount === 1 ? '' : 's'}
              </span>
              <span className="rounded-full bg-elev px-3 py-1.5 text-xs font-semibold tabular-nums">
                {p.stats.reviewCount} review{p.stats.reviewCount === 1 ? '' : 's'} received
              </span>
            </div>
          )}
          {me && me.username !== p.username && (
            <div className="mt-3">
              <ReportButton targetType="user" targetId={p.username} label={`@${p.username}`} />
            </div>
          )}
        </div>
      </header>

      {/* Shared goals */}
      {p.goals.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp size={15} className="text-accent" aria-hidden />
            Training goals
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.goals.map((g) => (
              <li key={g.title} className="rounded-xl bg-elev p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">{g.title}</p>
                  <span className="shrink-0 text-xs font-bold text-accent tabular-nums">
                    {g.pct}%
                  </span>
                </div>
                {g.label && <p className="mt-0.5 text-xs text-muted">{g.label}</p>}
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface">
                  <span
                    className="block h-full rounded-full bg-linear-to-r from-accent to-accent-2"
                    style={{ width: `${g.pct}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Published plans */}
      {p.plans.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">
            Published plans <span className="text-muted">({p.plans.length})</span>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.plans.map((plan) => (
              <li key={plan.id}>
                <Link
                  to={`/plans/community/${plan.id}`}
                  className="springy block rounded-2xl border border-line bg-surface p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                      {GOAL_LABELS[plan.goal as keyof typeof GOAL_LABELS] ?? plan.goal}
                    </span>
                    <span className="rounded-full bg-elev px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                      {LEVEL_LABELS[plan.difficulty as keyof typeof LEVEL_LABELS] ?? plan.difficulty}
                    </span>
                    {plan.diet && (
                      <span className="rounded-full bg-elev px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                        {DIET_LABELS[plan.diet] ?? plan.diet}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold">{plan.name}</p>
                  {plan.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{plan.description}</p>
                  )}
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs">
                    {plan.rating !== null ? (
                      <>
                        <Stars rating={plan.rating} />
                        <span className="font-semibold tabular-nums">{plan.rating}</span>
                        <span className="text-muted">({plan.reviewCount})</span>
                      </>
                    ) : (
                      <span className="text-muted">No reviews yet</span>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Reviews they wrote */}
        {p.reviews.length > 0 && (
          <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <MessageSquare size={15} className="text-accent" aria-hidden />
              Reviews by {p.displayName ?? p.username}
            </h2>
            <ul className="space-y-2.5">
              {p.reviews.map((r) => (
                <li key={r.id} className="border-b border-line pb-2 last:border-none last:pb-0">
                  <div className="flex items-center gap-2 text-xs">
                    <Stars rating={r.rating} />
                    <Link
                      to={`/plans/community/${r.planId}`}
                      className="truncate font-semibold text-accent hover:underline"
                    >
                      {r.planName}
                    </Link>
                  </div>
                  {r.comment && <p className="mt-0.5 text-xs text-muted">{r.comment}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Activity */}
        {p.activity.length > 0 && (
          <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <CalendarDays size={15} className="text-accent" aria-hidden />
              Activity
            </h2>
            <ul className="space-y-2">
              {p.activity.map((a, i) => (
                <li key={i} className="flex items-baseline gap-2 text-xs">
                  <span className="w-16 shrink-0 text-muted tabular-nums">
                    {formatDate(a.at)}
                  </span>
                  <span className="min-w-0 flex-1">
                    {a.kind === 'plan' ? (
                      <>
                        Published <span className="font-medium">{a.title}</span>
                      </>
                    ) : (
                      <>
                        Rated <span className="font-medium">{a.title}</span> {a.detail}/5
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {p.plans.length === 0 && p.reviews.length === 0 && p.activity.length === 0 && p.goals.length === 0 && (
        <p className="rounded-2xl border border-line bg-surface p-6 text-center text-sm text-muted">
          {p.displayName ?? p.username} keeps their page private, or hasn't published anything yet.
        </p>
      )}
    </div>
  );
}
