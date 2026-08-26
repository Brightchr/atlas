import { env } from './env';

/** Google OAuth 2.0 (authorization-code flow, server-side exchange).
 *
 * The redirect URI rides the web origin (nginx/vite proxy /v1 to this API),
 * so ONE registered URI covers browser and server:
 *   {PUBLIC_URL}/v1/auth/google/callback
 * Both this URI and the local-dev one must be registered on the OAuth client
 * in the Google Cloud console. */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function googleConfigured(): boolean {
  return env.googleClientId.length > 0 && env.googleClientSecret.length > 0;
}

export function googleRedirectUri(): string {
  return `${env.publicUrl}/v1/auth/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', env.googleClientId);
  url.searchParams.set('redirect_uri', googleRedirectUri());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export interface GoogleIdentity {
  /** Google's stable account id ("sub") — the linking key. */
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

/** Exchange the callback code for an identity. The id_token arrives straight
 * from Google's token endpoint over TLS, so per OpenID Connect its signature
 * need not be re-verified — but issuer and audience are still checked so a
 * token minted for some OTHER app can never sign in here. */
export async function exchangeGoogleCode(code: string): Promise<GoogleIdentity | null> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id_token?: string };
  const idToken = data.id_token;
  if (!idToken) return null;

  const payloadPart = idToken.split('.')[1];
  if (!payloadPart) return null;
  let payload: {
    iss?: string;
    aud?: string;
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  try {
    payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (payload.aud !== env.googleClientId) return null;
  if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
    return null;
  }
  if (!payload.sub || !payload.email) return null;
  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name ?? '',
  };
}
