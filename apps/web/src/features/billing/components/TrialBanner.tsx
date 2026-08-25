import { Link } from 'react-router';
import { Sparkles } from 'lucide-react';
import { useCurrentUser } from '@/features/auth/api';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Slim bar shown while the signup trial runs — counts down and links to the
 * upgrade page. Turns amber for the final two days. Staff never see it. */
export function TrialBanner() {
  const { data: user } = useCurrentUser();
  if (!user || user.role !== 'user' || user.membership !== 'trial' || !user.trialEndsAt) {
    return null;
  }
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / DAY_MS),
  );
  const urgent = daysLeft <= 2;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 text-sm font-medium ${
        urgent ? 'bg-amber-500/15 text-amber-600' : 'bg-accent-soft text-accent'
      }`}
    >
      <span className="inline-flex items-center gap-2">
        <Sparkles size={16} aria-hidden />
        Free trial — {daysLeft === 1 ? 'last day' : `${daysLeft} days left`}
      </span>
      <Link
        to="/upgrade"
        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
          urgent
            ? 'border-amber-500/40 hover:bg-amber-500/20'
            : 'border-accent/40 hover:bg-accent/10'
        }`}
      >
        Subscribe
      </Link>
    </div>
  );
}
