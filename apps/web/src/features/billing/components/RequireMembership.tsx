import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '@/features/auth/api';

/** Paywall gate for the authenticated app shell. Expired members are routed
 * to /upgrade (the API enforces the same rule with 402s — this is UX, not
 * security). Staff always pass; a session cached before this field existed
 * (membership undefined) passes too and self-corrects on the next refetch. */
export function RequireMembership({ children }: { children: ReactNode }) {
  const session = useSession();
  const { pathname } = useLocation();

  const user = session.data?.user;
  const expired =
    user !== undefined && user.membership === 'expired' && user.role === 'user';
  if (expired && pathname !== '/upgrade') {
    return <Navigate to="/upgrade" replace />;
  }
  return children;
}
