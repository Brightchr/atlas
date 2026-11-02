import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@arcadia/shared';
import { apiFetch } from '@/lib/api';
import { env } from '@/lib/env';

/** Auth uses the httpOnly session cookie — the token is never stored in
 * localStorage (XSS cannot steal what JS cannot read). */

interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface SessionState {
  user: AuthUser;
  /** True while an admin is masquerading as this user. */
  impersonated: boolean;
}

async function fetchSession(): Promise<SessionState | null> {
  const res = await fetch(`${env.apiUrl}/v1/auth/me`, { credentials: 'include' });
  if (res.status === 401) return null; // signed out — a normal state, not an error
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as SessionState;
}

export function useSession() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000,
    // A failed check (API down, proxy 502) is NOT "signed out": keep the error
    // so RequireAuth can show a retry screen instead of the landing page.
    // retryOnMount off matters: every screen that reads the session would
    // otherwise refetch the errored query on mount, flipping it back to
    // pending, which unmounts that screen and refetches again — a tight loop.
    retry: 2,
    retryOnMount: false,
    refetchInterval: (query) => (query.state.status === 'error' ? 10_000 : false),
  });
}

export function useCurrentUser() {
  const session = useSession();
  return { ...session, data: session.data?.user ?? null };
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiFetch<AuthResponse>('/v1/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (data) =>
      queryClient.setQueryData(['auth', 'me'], { user: data.user, impersonated: false }),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; username: string; password: string }) =>
      apiFetch<AuthResponse>('/v1/auth/register', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (data) =>
      queryClient.setQueryData(['auth', 'me'], { user: data.user, impersonated: false }),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<{ ok: boolean }>('/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      apiFetch<{ ok: boolean }>('/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ ok: boolean }>('/v1/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    // If the verifier is signed in, their cached user still says unverified.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }),
  });
}

export function useSendVerification() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; alreadyVerified?: boolean }>('/v1/auth/send-verification', {
        method: 'POST',
      }),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { password?: string; confirm?: string }) =>
      apiFetch<{ ok: boolean; graceDays: number }>('/v1/auth/delete-account', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    // Same hygiene as logout: nothing of this account stays in memory.
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>('/v1/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      // Evict all personal data from memory, not just the session — the next
      // user of this browser must not see the previous user's cached responses.
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.removeQueries({ queryKey: ['billing'] });
      queryClient.removeQueries({ queryKey: ['notifications'] });
      queryClient.removeQueries({ queryKey: ['admin'] });
      queryClient.removeQueries({ queryKey: ['workouts'] });
      queryClient.removeQueries({ queryKey: ['diary'] });
      queryClient.removeQueries({ queryKey: ['shopping'] });
    },
  });
}
