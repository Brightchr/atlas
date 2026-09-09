import { useState } from 'react';
import { useNavigate } from 'react-router';
import { TriangleAlert } from 'lucide-react';
import { useCurrentUser, useDeleteAccount } from '@/features/auth/api';

const inputClasses =
  'w-full rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20';

/** Account deletion, collapsed behind an explicit first click. Soft delete
 * with a 14-day grace window — signing back in restores everything. */
export function DangerZoneSection() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const deleteAccount = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState('');

  if (!user || user.role === 'admin') return null;
  const needsPassword = user.hasPassword;

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    deleteAccount.mutate(needsPassword ? { password: secret } : { confirm: secret }, {
      onSuccess: () => navigate('/signin?notice=account-deleted', { replace: true }),
    });
  };

  return (
    <section className="rounded-2xl border border-rose-500/30 bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
          <TriangleAlert size={17} strokeWidth={1.8} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold">Delete account</p>
          <p className="text-xs text-muted">
            Cancels any subscription immediately. Your account and data are recoverable for 14
            days — just sign back in — then permanently deleted.
          </p>
        </div>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-rose-500/40 px-4 py-2 text-sm font-semibold text-rose-500 transition-colors hover:bg-rose-500/10"
        >
          Delete my account…
        </button>
      ) : (
        <form onSubmit={handleDelete} className="space-y-2.5">
          <p className="text-sm">
            {needsPassword
              ? 'Enter your password to confirm.'
              : 'Type DELETE (all caps) to confirm.'}
          </p>
          <input
            type={needsPassword ? 'password' : 'text'}
            required
            autoComplete={needsPassword ? 'current-password' : 'off'}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={needsPassword ? 'Password' : 'DELETE'}
            className={inputClasses}
          />
          {deleteAccount.isError && (
            <p className="text-sm text-rose-500">{deleteAccount.error.message}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={deleteAccount.isPending || secret.length === 0}
              className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {deleteAccount.isPending ? 'Deleting…' : 'Delete account'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSecret('');
                deleteAccount.reset();
              }}
              className="rounded-xl border border-line px-4 py-2 text-sm font-semibold transition-colors hover:bg-elev"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
