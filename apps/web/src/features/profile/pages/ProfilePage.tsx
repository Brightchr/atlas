import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Card, PageHeader, buttonClasses } from '@/components/ui';
import { Eye, EyeOff, KeyRound, Palette, Target, UserRound } from 'lucide-react';
import { BANNERS, useChangePassword, useMyProfile, useUpdateProfile, type ProfileDoc } from '../api';
import { AVATAR_ICONS, AVATAR_TONES, AvatarIcon } from '../avatars';
import { GOAL_LABELS, LEVEL_LABELS, useTrainingProfile } from '@/features/training/profile';
import { useExerciseCatalog } from '@/features/exercises/api';
import { useGoalProgress } from '@/features/goals/api';

// 44px tall; text-base (16px) stops iOS Safari zooming in when a field is
// focused. py-2.5 only matters for the multi-line bio.
const fieldClasses =
  'min-h-11 w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-base outline-none placeholder:text-muted/70 focus:border-accent';

const SECTION_LABELS: { key: keyof ProfileDoc['show']; label: string; hint: string }[] = [
  { key: 'online', label: 'Online status', hint: 'Green dot and last-seen, shown to visitors and friends' },
  { key: 'plans', label: 'Published plans', hint: 'The plans you share publicly' },
  { key: 'stats', label: 'Star rating & counts', hint: 'Your overall rating across plans' },
  { key: 'reviews', label: 'Your reviews', hint: 'Reviews you write on other plans' },
  { key: 'activity', label: 'Activity', hint: 'Recent publishes and reviews' },
  { key: 'goals', label: 'Training goals', hint: 'A snapshot of your current goals' },
];

/** Your profile: public identity (display name, bio), training goals, and
 * account security (password change). Public parts appear on /users/:name. */
export function ProfilePage() {
  const profile = useMyProfile();
  const update = useUpdateProfile();
  const changePassword = useChangePassword();
  const training = useTrainingProfile();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [doc, setDoc] = useState<ProfileDoc | null>(null);

  useEffect(() => {
    if (profile.data) {
      setDisplayName(profile.data.displayName ?? '');
      setBio(profile.data.bio);
      setDoc(profile.data.profile);
    }
  }, [profile.data]);

  // Live snapshot of local goals, ready to publish when sharing is on.
  const catalog = useExerciseCatalog();
  const goalProgress = useGoalProgress(catalog.data);
  const goalSnapshot = (goalProgress.data ?? []).slice(0, 6).map((p) => ({
    title: p.goal.title,
    label: p.label,
    pct: Math.round(p.fraction * 100),
  }));

  const savePublicPage = () => {
    if (!doc) return;
    update.mutate({
      profile: { ...doc, sharedGoals: doc.show.goals ? goalSnapshot : [] },
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-6">
      <PageHeader
        title="Your profile"
        back="/you"
        subtitle={
          profile.data &&
          `@${profile.data.username} · member since ${new Date(
            profile.data.memberSince,
          ).toLocaleDateString([], { month: 'long', year: 'numeric' })}`
        }
      />
      {profile.data && (
        <Link
          to={`/users/${profile.data.username}`}
          className={buttonClasses('secondary', 'md', 'w-full')}
        >
          View your public page
        </Link>
      )}

      <Card className="p-4">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <UserRound size={20} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">Public identity</p>
            <p className="text-sm text-muted">
              Shown on your public page and next to plans you publish. Your email is never public.
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name (optional — otherwise your username shows)"
            maxLength={60}
            className={fieldClasses}
          />
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A line about how you train…"
            maxLength={500}
            rows={3}
            className={fieldClasses}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate({ displayName: displayName.trim() || null, bio })}
              className={buttonClasses('primary')}
            >
              Save profile
            </button>
            {update.isSuccess && !update.isPending && (
              <span className="text-sm text-accent">Saved</span>
            )}
            {update.isError && <span className="text-sm text-rose-500">{update.error.message}</span>}
          </div>
        </div>
      </Card>

      {doc && (
        <Card className="p-4">
          <div className="mb-3 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Palette size={20} strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold">Public page</p>
              <p className="text-sm text-muted">
                Your banner, avatar, and exactly what visitors get to see — anything can be
                switched off.
              </p>
            </div>
          </div>

          {/* Live banner + avatar preview */}
          <div className="relative mb-3 h-20 overflow-hidden rounded-xl" style={{ background: (BANNERS.find((b) => b.id === doc.bannerId) ?? BANNERS[0]).css }}>
            <span className="absolute bottom-2 left-3 rounded-2xl border-2 border-white/60 bg-black/25 p-0.5 backdrop-blur-sm">
              <AvatarIcon
                name={profile.data?.username ?? '?'}
                icon={doc.avatarIcon || null}
                tone={doc.avatarTone || null}
                size="lg"
              />
            </span>
          </div>

          <p className="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">Banner</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {BANNERS.map((b) => (
              <button
                key={b.id}
                type="button"
                title={b.label}
                aria-label={`${b.label} banner`}
                aria-pressed={doc.bannerId === b.id}
                onClick={() => setDoc({ ...doc, bannerId: b.id })}
                className={`springy h-11 w-16 rounded-xl border-2 ${doc.bannerId === b.id ? 'border-accent' : 'border-transparent'}`}
                style={{ background: b.css }}
              />
            ))}
          </div>

          <p className="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">Avatar</p>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {AVATAR_ICONS.map(({ id, Icon, label }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={`${label} avatar`}
                aria-pressed={doc.avatarIcon === id}
                onClick={() => setDoc({ ...doc, avatarIcon: id })}
                className={`springy flex h-11 w-11 items-center justify-center rounded-xl border ${
                  doc.avatarIcon === id
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-muted hover:text-ink'
                }`}
              >
                <Icon size={20} strokeWidth={1.8} aria-hidden />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDoc({ ...doc, avatarIcon: '' })}
              className={buttonClasses('ghost')}
            >
              Use initial
            </button>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {AVATAR_TONES.map(({ id, swatch }) => (
              <button
                key={id}
                type="button"
                title={id}
                aria-label={`${id} avatar color`}
                aria-pressed={doc.avatarTone === id}
                onClick={() => setDoc({ ...doc, avatarTone: id })}
                className={`springy h-11 w-11 rounded-full border-2 ${swatch} ${
                  doc.avatarTone === id ? 'border-ink' : 'border-transparent'
                }`}
              />
            ))}
          </div>

          <p className="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">
            What visitors can see
          </p>
          <div className="space-y-2">
            {SECTION_LABELS.map(({ key, label, hint }) => {
              const on = doc.show[key];
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDoc({ ...doc, show: { ...doc.show, [key]: !on } })}
                  className="springy flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left hover:bg-elev"
                >
                  {on ? (
                    <Eye size={18} className="shrink-0 text-accent" aria-hidden />
                  ) : (
                    <EyeOff size={18} className="shrink-0 text-muted" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-sm text-muted">{hint}</span>
                  </span>
                  <span className={`shrink-0 text-sm font-bold ${on ? 'text-accent' : 'text-muted'}`}>
                    {on ? 'Public' : 'Private'}
                  </span>
                </button>
              );
            })}
          </div>
          {doc.show.goals && (
            <p className="mt-2 text-sm text-muted">
              Sharing {goalSnapshot.length} goal{goalSnapshot.length === 1 ? '' : 's'} as a
              snapshot — saved when you save this card, refreshed each time you save again.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={update.isPending}
              onClick={savePublicPage}
              className={buttonClasses('primary')}
            >
              Save public page
            </button>
            {update.isSuccess && !update.isPending && (
              <span className="text-sm text-accent">Saved</span>
            )}
            {profile.data && (
              <Link
                to={`/users/${profile.data.username}`}
                className="ml-auto flex min-h-11 items-center text-sm font-medium text-accent hover:underline"
              >
                Preview your page
              </Link>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Target size={20} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">Training goals</p>
            <p className="text-sm text-muted">
              {training.data
                ? `${GOAL_LABELS[training.data.goal]} · ${LEVEL_LABELS[training.data.level]} · ${training.data.daysPerWeek} days/week`
                : 'Not set yet.'}
            </p>
          </div>
        </div>
        <Link
          to="/welcome"
          className={buttonClasses('secondary')}
        >
          Change goals
        </Link>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <KeyRound size={20} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">Change password</p>
            <p className="text-sm text-muted">
              Changing it signs out every other device you're logged in on.
            </p>
          </div>
        </div>
        <div className="space-y-2.5">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            className={fieldClasses}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (8+ characters)"
            autoComplete="new-password"
            className={fieldClasses}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={
                changePassword.isPending || currentPassword.length === 0 || newPassword.length < 8
              }
              onClick={() =>
                changePassword.mutate(
                  { currentPassword, newPassword },
                  {
                    onSuccess: () => {
                      setCurrentPassword('');
                      setNewPassword('');
                    },
                  },
                )
              }
              className={buttonClasses('primary')}
            >
              Change password
            </button>
            {changePassword.isSuccess && !changePassword.isPending && (
              <span className="text-sm text-accent">Changed — other devices signed out</span>
            )}
            {changePassword.isError && (
              <span className="text-sm text-rose-500">{changePassword.error.message}</span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
