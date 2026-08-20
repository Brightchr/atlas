import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Eye, EyeOff, KeyRound, Palette, Target, UserRound } from 'lucide-react';
import { BANNERS, useChangePassword, useMyProfile, useUpdateProfile, type ProfileDoc } from '../api';
import { GOAL_LABELS, LEVEL_LABELS, useTrainingProfile } from '@/features/training/profile';
import { useExerciseCatalog } from '@/features/exercises/api';
import { useGoalProgress } from '@/features/goals/api';

const SECTION_LABELS: { key: keyof ProfileDoc['show']; label: string; hint: string }[] = [
  { key: 'plans', label: 'Published plans', hint: 'The plans you share publicly' },
  { key: 'stats', label: 'Star rating & counts', hint: 'Your overall rating across plans' },
  { key: 'reviews', label: 'Your reviews', hint: 'Reviews you write on other plans' },
  { key: 'activity', label: 'Activity', hint: 'Recent publishes and reviews' },
  { key: 'goals', label: 'Training goals', hint: 'A snapshot of your current goals' },
];

const AVATAR_SUGGESTIONS = ['💪', '🏋️', '🏃', '🔥', '⚡', '🎯'];

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
      <header>
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="text-sm text-muted">
          {profile.data && (
            <>
              @{profile.data.username} · member since{' '}
              {new Date(profile.data.memberSince).toLocaleDateString([], {
                month: 'long',
                year: 'numeric',
              })}{' '}
              ·{' '}
              <Link to={`/users/${profile.data.username}`} className="text-accent hover:underline">
                view public page
              </Link>
            </>
          )}
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
            <UserRound size={17} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">Public identity</p>
            <p className="text-xs text-muted">
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
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
          />
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A line about how you train…"
            maxLength={500}
            rows={3}
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => update.mutate({ displayName: displayName.trim() || null, bio })}
              className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              Save profile
            </button>
            {update.isSuccess && !update.isPending && (
              <span className="text-xs text-accent">Saved ✓</span>
            )}
            {update.isError && <span className="text-xs text-rose-500">{update.error.message}</span>}
          </div>
        </div>
      </section>

      {doc && (
        <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Palette size={17} strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold">Public page</p>
              <p className="text-xs text-muted">
                Your banner, avatar, and exactly what visitors get to see — anything can be
                switched off.
              </p>
            </div>
          </div>

          {/* Live banner + avatar preview */}
          <div className="relative mb-3 h-20 overflow-hidden rounded-xl" style={{ background: (BANNERS.find((b) => b.id === doc.bannerId) ?? BANNERS[0]).css }}>
            <span className="absolute bottom-2 left-3 flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-white/60 bg-black/25 text-xl backdrop-blur-sm">
              {doc.avatarEmoji || (profile.data?.username[0]?.toUpperCase() ?? '?')}
            </span>
          </div>

          <p className="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">Banner</p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {BANNERS.map((b) => (
              <button
                key={b.id}
                type="button"
                title={b.label}
                aria-pressed={doc.bannerId === b.id}
                onClick={() => setDoc({ ...doc, bannerId: b.id })}
                className={`springy h-9 w-14 rounded-lg border-2 ${doc.bannerId === b.id ? 'border-accent' : 'border-transparent'}`}
                style={{ background: b.css }}
              />
            ))}
          </div>

          <p className="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">Avatar</p>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {AVATAR_SUGGESTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-pressed={doc.avatarEmoji === emoji}
                onClick={() => setDoc({ ...doc, avatarEmoji: emoji })}
                className={`springy flex h-9 w-9 items-center justify-center rounded-lg border text-base ${
                  doc.avatarEmoji === emoji ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
                }`}
              >
                {emoji}
              </button>
            ))}
            <input
              value={doc.avatarEmoji}
              onChange={(e) => setDoc({ ...doc, avatarEmoji: e.target.value.slice(0, 8) })}
              placeholder="Or type any emoji"
              className="w-36 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
            />
            <button
              type="button"
              onClick={() => setDoc({ ...doc, avatarEmoji: '' })}
              className="text-xs text-muted hover:text-ink"
            >
              Use initial
            </button>
          </div>

          <p className="mb-1.5 text-xs font-bold tracking-wide text-muted uppercase">
            What visitors can see
          </p>
          <div className="space-y-1.5">
            {SECTION_LABELS.map(({ key, label, hint }) => {
              const on = doc.show[key];
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDoc({ ...doc, show: { ...doc.show, [key]: !on } })}
                  className="springy flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-left hover:bg-elev"
                >
                  {on ? (
                    <Eye size={15} className="shrink-0 text-accent" aria-hidden />
                  ) : (
                    <EyeOff size={15} className="shrink-0 text-muted" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted">{hint}</span>
                  </span>
                  <span className={`text-xs font-bold ${on ? 'text-accent' : 'text-muted'}`}>
                    {on ? 'Public' : 'Private'}
                  </span>
                </button>
              );
            })}
          </div>
          {doc.show.goals && (
            <p className="mt-2 text-xs text-muted">
              Sharing {goalSnapshot.length} goal{goalSnapshot.length === 1 ? '' : 's'} as a
              snapshot — saved when you save this card, refreshed each time you save again.
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={update.isPending}
              onClick={savePublicPage}
              className="springy rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              Save public page
            </button>
            {update.isSuccess && !update.isPending && (
              <span className="text-xs text-accent">Saved ✓</span>
            )}
            {profile.data && (
              <Link
                to={`/users/${profile.data.username}`}
                className="ml-auto text-xs font-medium text-accent hover:underline"
              >
                Preview your page →
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Target size={17} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">Training goals</p>
            <p className="text-xs text-muted">
              {training.data
                ? `${GOAL_LABELS[training.data.goal]} · ${LEVEL_LABELS[training.data.level]} · ${training.data.daysPerWeek} days/week`
                : 'Not set yet.'}
            </p>
          </div>
        </div>
        <Link
          to="/welcome"
          className="inline-block rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold shadow-sm hover:bg-elev"
        >
          Change goals
        </Link>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
            <KeyRound size={17} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">Change password</p>
            <p className="text-xs text-muted">
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
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (8+ characters)"
            autoComplete="new-password"
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none placeholder:text-muted/70 focus:border-accent"
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
              className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              Change password
            </button>
            {changePassword.isSuccess && !changePassword.isPending && (
              <span className="text-xs text-accent">Changed — other devices signed out ✓</span>
            )}
            {changePassword.isError && (
              <span className="text-xs text-rose-500">{changePassword.error.message}</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
