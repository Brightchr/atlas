import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { MailCheck } from 'lucide-react';
import { useVerifyEmail } from '../api';

/** Landing page for the emailed verification link (?token=...). Works signed
 * in or out — the token alone proves ownership. */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const verify = useVerifyEmail();
  // StrictMode mounts effects twice in dev; the token is single-use, so the
  // second fire would wrongly report "invalid link".
  const fired = useRef(false);

  useEffect(() => {
    if (!token || fired.current) return;
    fired.current = true;
    verify.mutate(token);
    // verify is a stable mutation object from useMutation; firing once is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center p-4 pt-10 md:pt-16">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-accent-ink shadow-sm">
          <MailCheck size={22} aria-hidden />
        </span>
        <h1 className="text-2xl font-bold">Email verification</h1>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 text-center shadow-sm">
        {!token && (
          <p className="text-sm">This page needs the link from your verification email.</p>
        )}
        {token && verify.isPending && <p className="text-sm text-muted">Verifying…</p>}
        {verify.isSuccess && (
          <>
            <p className="text-sm font-medium text-emerald-500">Your email is verified.</p>
            <Link
              to="/"
              className="mt-3 inline-block rounded-xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 text-sm font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90"
            >
              Open Atlas
            </Link>
          </>
        )}
        {verify.isError && (
          <p className="text-sm text-rose-500">
            {verify.error.message} — you can request a fresh link from Settings.
          </p>
        )}
      </div>
    </div>
  );
}
