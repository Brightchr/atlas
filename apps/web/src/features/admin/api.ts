import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MembershipPlan, Promotion, UserRole } from '@arcadia/shared';
import { apiFetch } from '@/lib/api';

export interface AdminStats {
  users: number;
  activeSessions: number;
  signups7d: number;
  notifications: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  plan: MembershipPlan;
  planExpiresAt: string | null;
  createdAt: string;
  activeSessions: number;
  lastLogin: string | null;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => apiFetch<AdminStats>('/v1/admin/stats'),
  });
}

export function useAdminUsers(q: string) {
  return useQuery({
    queryKey: ['admin', 'users', q],
    queryFn: () =>
      apiFetch<{ users: AdminUser[] }>(`/v1/admin/users?q=${encodeURIComponent(q)}`),
  });
}

export function useImpersonate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ user: AdminUser }>(`/v1/admin/users/${userId}/impersonate`, { method: 'POST' }),
    onSuccess: (data) =>
      queryClient.setQueryData(['auth', 'me'], { user: data.user, impersonated: true }),
  });
}

export function useStopImpersonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ user: AdminUser }>('/v1/admin/impersonation/stop', { method: 'POST' }),
    onSuccess: (data) =>
      queryClient.setQueryData(['auth', 'me'], { user: data.user, impersonated: false }),
  });
}

export function useSetPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, plan }: { userId: string; plan: MembershipPlan }) =>
      apiFetch<{ ok: boolean }>(`/v1/admin/users/${userId}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ plan }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function usePromotions() {
  return useQuery({
    queryKey: ['admin', 'promotions'],
    queryFn: () => apiFetch<{ promotions: Promotion[] }>('/v1/admin/promotions'),
  });
}

export function useCreatePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string; description: string; discountPercent: number }) =>
      apiFetch<{ ok: boolean }>('/v1/admin/promotions', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] }),
  });
}

export function useTogglePromotion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetch<{ ok: boolean }>(`/v1/admin/promotions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] }),
  });
}

export function useSetRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      apiFetch<{ ok: boolean }>(`/v1/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
