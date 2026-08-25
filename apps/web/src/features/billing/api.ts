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

/** Placeholder flow: the API answers 501 until the payment processor lands,
 * and the UI surfaces that message. Later this returns a checkout URL. */
export function useCheckout() {
  return useMutation({
    mutationFn: () => apiFetch<{ url?: string }>('/v1/billing/checkout', { method: 'POST' }),
  });
}
