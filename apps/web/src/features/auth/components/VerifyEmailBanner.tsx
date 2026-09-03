import { MailWarning } from 'lucide-react';
import { useCurrentUser, useSendVerification } from '../api';

/** Slim nudge under the top bar for accounts that haven't proven their email.
 * Verification is never required to use the app — but an unverified address
 * can't recover its password, so the nudge stays until it's done. */
export function VerifyEmailBanner() {
  const { data: user } = useCurrentUser();
  const send = useSendVerification();

  if (!user || user.emailVerified) return null;

  return (
    <div className="flex items-center justify-center gap-2.5 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
      <MailWarning size={15} className="shrink-0" aria-hidden />
      {send.isSuccess ? (
        <span>
          New link sent to <span className="font-semibold">{user.email}</span> — check your inbox.
        </span>
      ) : (
        <>
          <span className="min-w-0 truncate">
            We emailed a verification link to{' '}
            <span className="font-semibold">{user.email}</span>. Didn’t receive it?
          </span>
          <button
            type="button"
            disabled={send.isPending}
            onClick={() => send.mutate()}
            className="shrink-0 font-semibold underline-offset-2 hover:underline disabled:opacity-50"
          >
            {send.isPending ? 'Sending…' : 'Resend'}
          </button>
          {send.isError && <span className="shrink-0">{send.error.message}</span>}
        </>
      )}
    </div>
  );
}
