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
    retry: false,
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

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>('/v1/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      // Evict all personal data from memory, not just the session — the next
      // user of this browser must not see the previous user's cached responses.
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.removeQueries({ queryKey: ['notifications'] });
      queryClient.removeQueries({ queryKey: ['admin'] });
      queryClient.removeQueries({ queryKey: ['workouts'] });
      queryClient.removeQueries({ queryKey: ['diary'] });
      queryClient.removeQueries({ queryKey: ['shopping'] });
    },
  });
}
