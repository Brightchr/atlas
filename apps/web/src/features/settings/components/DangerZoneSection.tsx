import { useState } from 'react';
import { useNavigate } from 'react-router';
import { TriangleAlert } from 'lucide-react';
import { Button, Card, Sheet } from '@/components/ui';
import { useCurrentUser, useDeleteAccount } from '@/features/auth/api';

const inputClasses =
  'min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base outline-none placeholder:text-muted/70 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20';

/** Account deletion. The button only opens a sheet; the sheet then asks for
 * the password (or the word DELETE for accounts without one) before anything
 * happens. That typed proof is a stronger check than a plain yes/no, which is
 * why this uses its own Sheet rather than ConfirmSheet. Soft delete with a
 * 14-day grace window — signing back in restores everything. */
export function DangerZoneSection() {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const deleteAccount = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState('');

  if (!user || user.role === 'admin') return null;
  const needsPassword = user.hasPassword;

  const close = () => {
    setOpen(false);
    setSecret('');
    deleteAccount.reset();
  };

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    deleteAccount.mutate(needsPassword ? { password: secret } : { confirm: secret }, {
      onSuccess: () => navigate('/signin?notice=account-deleted', { replace: true }),
    });
  };

  return (
    <Card className="border-rose-500/30 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
          <TriangleAlert size={20} strokeWidth={1.8} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Delete account</h2>
          <p className="text-sm text-muted">
            Cancels any subscription immediately. Your account and data are recoverable for 14 days
            — just sign back in — then permanently deleted.
          </p>
        </div>
      </div>

      <Button variant="danger" block onClick={() => setOpen(true)}>
        Delete my account…
      </Button>

      {open && (
        <Sheet title="Delete your account?" onClose={close}>
          <form onSubmit={handleDelete} className="space-y-3">
            <p className="text-sm text-muted">
              Any subscription is cancelled now. You have 14 days to change your mind by signing
              back in; after that everything is permanently deleted.
            </p>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                {needsPassword
                  ? 'Enter your password to confirm'
                  : 'Type DELETE (all caps) to confirm'}
              </span>
              <input
                type={needsPassword ? 'password' : 'text'}
                required
                autoComplete={needsPassword ? 'current-password' : 'off'}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={needsPassword ? 'Password' : 'DELETE'}
                className={inputClasses}
              />
            </label>
            {deleteAccount.isError && (
              <p className="text-sm text-rose-500">{deleteAccount.error.message}</p>
            )}
            <div className="grid gap-2 pt-2">
              {/* Solid rose (not the tinted `danger` Button) to match the
                  confirm button in ConfirmSheet: this is the point of no
                  return. */}
              <button
                type="submit"
                disabled={deleteAccount.isPending || secret.length === 0}
                className="springy min-h-12 rounded-xl bg-rose-500 px-5 text-base font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
              >
                {deleteAccount.isPending ? 'Deleting…' : 'Delete account'}
              </button>
              <Button variant="secondary" size="lg" onClick={close}>
                Cancel
              </Button>
            </div>
          </form>
        </Sheet>
      )}
    </Card>
  );
}
