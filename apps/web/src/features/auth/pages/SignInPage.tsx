import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useLogin, useRegister, useSession } from '../api';

type Mode = 'signin' | 'register';

const inputClasses =
  'w-full rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20';

export function SignInPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const location = useLocation();
  const session = useSession();

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
    </div>
  );
}
