import { useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';
import { useLogin, useRegister, useSession } from '../api';

type Mode = 'signin' | 'register';

const inputClasses =
  'w-full rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20';

/** Messages for ?error= set by the OAuth callback redirects. */
const OAUTH_ERRORS: Record<string, string> = {
  google: 'Google sign-in didn’t complete — please try again.',
  suspended: 'This account has been suspended.',
  'google-unavailable': 'Google sign-in isn’t available right now.',
};

/** Google's multi-color "G" — inline so no external asset loads. */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function SignInPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const location = useLocation();
  const session = useSession();
  const [params] = useSearchParams();
  const oauthError = OAUTH_ERRORS[params.get('error') ?? ''];

  const login = useLogin();
  const register = useRegister();
  const active = mode === 'signin' ? login : register;

  // Where the user was originally headed (RequireAuth remembers it).
  const destination = (location.state as { from?: string } | null)?.from ?? '/';

  // Signed in — whether just now (the login mutation updated the session cache)
  // or already before visiting this page — go to the destination. Navigation is
  // driven by session state, so it can never race a callback.
  if (session.data) {
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signin') {
      login.mutate({ email, password });
    } else {
      register.mutate({ email, username, password });
    }
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center p-4 pt-10 md:pt-16">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <img src="/assets/logo/atlas_logo.png" alt="Atlas by Arcadia" className="h-14 w-auto" />
        <div>
          <h1 className="text-2xl font-bold">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mode === 'signin'
              ? 'Sign in to sync workouts and join the community.'
              : 'Free forever for your own training data.'}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 rounded-xl border border-line bg-surface p-1 text-sm font-medium shadow-sm">
        {(
          [
            ['signin', 'Sign in'],
            ['register', 'Create account'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`rounded-lg py-2 transition-colors ${
              mode === value ? 'bg-accent text-accent-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className={inputClasses}
        />
        {mode === 'register' && (
          <input
            type="text"
            required
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9_]+"
            title="Letters, numbers and underscores only"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className={inputClasses}
          />
        )}
        <input
          type="password"
          required
          minLength={mode === 'register' ? 8 : 1}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'register' ? 'Password (min. 8 characters)' : 'Password'}
          className={inputClasses}
        />

        {active.isError && <p className="text-sm text-rose-500">{active.error.message}</p>}

        <button
          type="submit"
          disabled={active.isPending}
          className="w-full rounded-xl bg-linear-to-r from-accent to-accent-2 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {active.isPending ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-muted">
        <span className="h-px grow bg-line" />
        or
        <span className="h-px grow bg-line" />
      </div>

      {/* Same-origin path: the web server proxies /v1 to the API, so the
          session cookie lands on this origin when the flow completes. */}
      <a
        href="/v1/auth/google/start"
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface py-2.5 text-sm font-semibold shadow-sm transition-colors hover:bg-elev"
      >
        <GoogleG />
        Continue with Google
      </a>

      {oauthError && <p className="mt-3 text-center text-sm text-rose-500">{oauthError}</p>}
    </div>
  );
}
