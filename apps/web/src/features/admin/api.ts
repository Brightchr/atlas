import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserRole } from '@arcadia/shared';
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
