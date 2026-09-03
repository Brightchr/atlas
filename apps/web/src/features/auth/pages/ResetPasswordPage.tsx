import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { LockKeyhole } from 'lucide-react';
import { useResetPassword } from '../api';

const inputClasses =
  'w-full rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20';

/** Landing page for the emailed reset link (?token=...). A successful reset
 * signs every device out, so the user is sent to sign in fresh. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const reset = useResetPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    reset.mutate({ token, password });
  };

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center p-4 pt-10 md:pt-16">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-accent-ink shadow-sm">
          <LockKeyhole size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted">
            You’ll be signed out everywhere and can sign back in with the new one.
          </p>
        </div>
      </div>

      {!token ? (
        <div className="rounded-2xl border border-line bg-surface p-5 text-center shadow-sm">
          <p className="text-sm">
            This page needs the link from your reset email.{' '}
            <Link to="/forgot-password" className="font-medium text-accent hover:underline">
              Request a new one
            </Link>
            .
          </p>
        </div>
      ) : reset.isSuccess ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
          <p className="text-sm text-emerald-500">Password updated.</p>
          <Link
            to="/signin"
            className="mt-3 inline-block rounded-xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min. 8 characters)"
            className={inputClasses}
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat new password"
            className={inputClasses}
          />
          {mismatch && <p className="text-sm text-rose-500">Passwords don’t match.</p>}
          {reset.isError && <p className="text-sm text-rose-500">{reset.error.message}</p>}
          <button
            type="submit"
            disabled={reset.isPending}
            className="w-full rounded-xl bg-linear-to-r from-accent to-accent-2 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {reset.isPending ? 'One moment…' : 'Set new password'}
          </button>
        </form>
      )}
    </div>
  );
}
