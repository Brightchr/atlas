import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@arcadia/shared';
import { env } from '@/lib/env';

/** Auth uses the httpOnly session cookie — the token is never stored in
 * localStorage (XSS cannot steal what JS cannot read). credentials: 'include'
 * makes the browser attach the cookie on every API call. */

interface AuthResponse {
  user: AuthUser;
  token: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.apiUrl}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = (await res.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch(`${env.apiUrl}/v1/auth/me`, { credentials: 'include' });
  if (res.status === 401) return null; // signed out — a normal state, not an error
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return ((await res.json()) as { user: AuthUser }).user;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      apiFetch<AuthResponse>('/v1/auth/login', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (data) => queryClient.setQueryData(['auth', 'me'], data.user),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; username: string; password: string }) =>
      apiFetch<AuthResponse>('/v1/auth/register', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (data) => queryClient.setQueryData(['auth', 'me'], data.user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>('/v1/auth/logout', { method: 'POST' }),
    onSuccess: () => queryClient.setQueryData(['auth', 'me'], null),
  });
}
