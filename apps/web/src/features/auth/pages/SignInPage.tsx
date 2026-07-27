import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Mountain } from 'lucide-react';
import type { AuthUser } from '@arcadia/shared';
import { seedDemoLocalData } from '@/features/demo/seedLocalData';
import { useLogin, useRegister } from '../api';

type Mode = 'signin' | 'register';

const inputClasses =
  'w-full rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20';

export function SignInPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const login = useLogin();
  const register = useRegister();
  const queryClient = useQueryClient();
  const active = mode === 'signin' ? login : register;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const onSuccess = async (data: { user: AuthUser }) => {
      // The demo account arrives "fully loaded": populate the local database
      // once. Time-boxed so a slow/unavailable seed never blocks sign-in.
      if (data.user.username === 'demo') {
        try {
          await Promise.race([
            seedDemoLocalData(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000)),
          ]);
          await queryClient.invalidateQueries();
        } catch (err) {
          console.warn('Demo data seeding skipped:', err);
        }
      }
      navigate('/');
    };
    if (mode === 'signin') {
      login.mutate({ email, password }, { onSuccess });
    } else {
      register.mutate({ email, username, password }, { onSuccess });
    }
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center p-4 pt-10 md:pt-16">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-accent-ink shadow-md">
          <Mountain size={22} aria-hidden />
        </span>
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
