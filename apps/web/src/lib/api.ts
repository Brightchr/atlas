import { queryClient } from '@/app/providers';
import { env } from '@/lib/env';

const AUTH_PATHS = ['/v1/auth/login', '/v1/auth/register'];

/** Fetch wrapper for the Arcadia API. Always sends credentials so the
 * httpOnly session cookie rides along; throws the server's error message.
 * A 401 on any authenticated route means the session died (expired, revoked) —
 * the cached session is cleared so route guards send the user to sign-in. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.apiUrl}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = (await res.json().catch(() => null)) as ({ error?: string } & T) | null;
  if (!res.ok) {
    if (res.status === 401 && !AUTH_PATHS.includes(path)) {
      queryClient.setQueryData(['auth', 'me'], null);
      throw new Error(body?.error ?? 'Session expired — please sign in again');
    }
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}
