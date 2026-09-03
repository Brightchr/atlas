import { useState } from 'react';
import { Link } from 'react-router';
import { KeyRound } from 'lucide-react';
import { useForgotPassword } from '../api';

const inputClasses =
  'w-full rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20';

/** Requests a reset link. The API answers identically whether or not the
 * email is registered, and this page's copy matches that. */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const forgot = useForgotPassword();

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center p-4 pt-10 md:pt-16">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-accent-ink shadow-sm">
          <KeyRound size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="mt-1 text-sm text-muted">
            Enter your account email and we’ll send you a reset link.
          </p>
        </div>
      </div>

      {forgot.isSuccess ? (
        <div className="rounded-2xl border border-line bg-surface p-5 text-center shadow-sm">
          <p className="text-sm">
            If an account exists for <span className="font-semibold">{email}</span>, a reset link
            is on its way. The link works once and expires in 30 minutes.
          </p>
          <p className="mt-3 text-sm text-muted">
            Nothing arriving? Check spam, or make sure you entered the email you signed up with.
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            forgot.mutate(email.trim());
          }}
          className="space-y-3"
        >
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={inputClasses}
          />
          {forgot.isError && <p className="text-sm text-rose-500">{forgot.error.message}</p>}
          <button
            type="submit"
            disabled={forgot.isPending}
            className="w-full rounded-xl bg-linear-to-r from-accent to-accent-2 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {forgot.isPending ? 'One moment…' : 'Send reset link'}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm">
        <Link to="/signin" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
