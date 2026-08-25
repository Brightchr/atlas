import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminReport,
  MembershipPlan,
  Promotion,
  ReportStatus,
  UserRole,
} from '@arcadia/shared';
import { apiFetch } from '@/lib/api';

export interface AdminStats {
  users: number;
  activeSessions: number;
  signups7d: number;
  notifications: number;
  proUsers: number;
  trialUsers: number;
  bannedUsers: number;
  openReports: number;
  ipBlocks: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  plan: MembershipPlan;
  planExpiresAt: string | null;
  trialEndsAt: string | null;
  status: 'active' | 'banned';
  bannedAt: string | null;
  banReason: string | null;
  createdAt: string;
  activeSessions: number;
  lastLogin: string | null;
  lastIp: string | null;
}

export interface IpBlock {
  id: string;
  ip: string;
  reason: string;
  createdAt: string;
  expiresAt: string | null;
  createdBy: string | null;
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
    mutationFn: (input: {
      code: string;
      description: string;
      discountPercent: number;
      maxRedemptions?: number | null;
      grantDays?: number | null;
    }) =>
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

export function useBanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      reason,
      blockIps,
    }: {
      userId: string;
      reason: string;
      blockIps: boolean;
    }) =>
      apiFetch<{ ok: boolean; blockedIps: number }>(`/v1/admin/users/${userId}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason, blockIps }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ip-blocks'] });
    },
  });
}

export function useUnbanUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ ok: boolean }>(`/v1/admin/users/${userId}/unban`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useIpBlocks() {
  return useQuery({
    queryKey: ['admin', 'ip-blocks'],
    queryFn: () => apiFetch<{ blocks: IpBlock[] }>('/v1/admin/ip-blocks'),
  });
}

export function useCreateIpBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { ip: string; reason: string; expiresInHours?: number }) =>
      apiFetch<{ ok: boolean }>('/v1/admin/ip-blocks', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ip-blocks'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useDeleteIpBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/v1/admin/ip-blocks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ip-blocks'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useAdminReports(status: ReportStatus | 'all') {
  return useQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: () => apiFetch<{ reports: AdminReport[] }>(`/v1/admin/reports?status=${status}`),
  });
}

export function useUpdateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: ReportStatus; note: string }) =>
      apiFetch<{ ok: boolean }>(`/v1/admin/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  detail: unknown;
  created_at: string;
}

export function useAuditLog() {
  return useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => apiFetch<{ entries: AuditEntry[] }>('/v1/admin/audit'),
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
