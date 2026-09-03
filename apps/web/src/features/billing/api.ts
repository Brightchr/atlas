import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BillingStatus, PublicPromotion } from '@arcadia/shared';
import { apiFetch } from '@/lib/api';

export function useBillingStatus() {
  return useQuery({
    queryKey: ['billing', 'status'],
    queryFn: () => apiFetch<BillingStatus>('/v1/billing'),
  });
}

/** Active promotions for the dashboard banner. Slow-moving marketing content
 * — a long staleTime keeps it off the request hot path. */
export function useActivePromotions() {
  return useQuery({
    queryKey: ['billing', 'active-promotions'],
    queryFn: () => apiFetch<{ promotions: PublicPromotion[] }>('/v1/billing/promotions'),
    staleTime: 10 * 60 * 1000,
  });
}

export interface RedeemResult {
  ok: boolean;
  granted: boolean;
  grantDays: number | null;
  discountPercent: number;
}

export function useRedeemPromo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<RedeemResult>('/v1/billing/redeem', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => {
      // A grant code can flip membership to pro on the spot — refresh both
      // the billing panel and the session state the paywall keys off.
      void queryClient.invalidateQueries({ queryKey: ['billing'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

/** Starts Stripe Checkout: the API returns the hosted page's URL and the
 * browser hands over to Stripe. Membership flips via webhook while the user
 * pays; the success redirect back to /upgrade re-fetches it. */
export function useCheckout() {
  return useMutation({
    mutationFn: (interval: 'month' | 'year') =>
      apiFetch<{ url: string }>('/v1/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ interval }),
      }),
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
  });
}

/** Stripe's hosted billing portal — change card, cancel, past invoices. */
export function useBillingPortal() {
  return useMutation({
    mutationFn: () => apiFetch<{ url: string }>('/v1/billing/portal', { method: 'POST' }),
    onSuccess: (data) => {
      window.location.assign(data.url);
    },
  });
}
