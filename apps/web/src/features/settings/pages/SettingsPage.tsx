import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CloudUpload,
  Dumbbell,
  Palette,
  RefreshCw,
  Ruler,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { THEMES, useTheme } from '@/app/theme';
import { Button, Card, ConfirmSheet, PageHeader, Sheet } from '@/components/ui';
import { EQUIPMENT_OPTIONS } from '@/lib/exercise-db/client';
import {
  adoptCurrentAccount,
  isSyncEnabled,
  isTrainingSyncEnabled,
  setSyncEnabled,
  setTrainingSyncEnabled,
  syncNow,
} from '@/lib/sync/engine';
import { useSyncState } from '@/lib/sync/useSync';
import { useSaveTrainingSetup, useTrainingSetup, type TrainingLocation } from '@/lib/trainingSetup';
import { useSetUnits, useUnits, type UnitSystem } from '@/lib/units';
import { BillingSection } from '@/features/billing/components/BillingSection';
import { DangerZoneSection } from '../components/DangerZoneSection';

const UNIT_OPTIONS: { id: UnitSystem; label: string; hint: string }[] = [
  { id: 'imperial', label: 'US units', hint: 'Pounds, feet & inches (default)' },
  { id: 'metric', label: 'Metric', hint: 'Kilograms and centimeters' },
];

const LOCATION_OPTIONS: { id: TrainingLocation; label: string; hint: string }[] = [
  { id: 'gym', label: 'Gym', hint: 'Full equipment access' },
  { id: 'home', label: 'Home', hint: 'Only what you own' },
  { id: 'both', label: 'Both', hint: 'Gym and a home setup' },
];

/** The card every settings group sits in: icon, title, one line of
 * explanation, then the controls. */
function SettingsCard({
  title,
  hint,
  Icon,
  children,
}: {
  title: string;
  hint: ReactNode;
  Icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon size={20} strokeWidth={1.8} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted">{hint}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

/** One choice in a pick-one group (units, location, sync mode, theme): a
 * 56px row with a check on the selected one. `aria-pressed` tells screen
 * readers which is active. */
function OptionButton({
  selected,
  onClick,
  label,
  hint,
  leading,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
  /** Optional element before the label (the theme swatch). */
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-2 text-left transition-colors ${
        selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-elev'
      }`}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      {selected && <Check size={18} className="shrink-0 text-accent" aria-hidden />}
    </button>
  );
}

/** Theme picker. It used to live in the top bar; on phones that menu is gone,
 * so this is now the one place to change it. The swatch colors come from the
 * THEMES list itself (each theme's own background + accent), which is why
 * they are inline styles rather than theme-token classes: a swatch has to
 * show a theme that is NOT the active one. */
function ThemeSection() {
  const { theme, setTheme } = useTheme();
  return (
    <SettingsCard title="Theme" hint="Saved on this device." Icon={Palette}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {THEMES.map((t) => (
          <OptionButton
            key={t.id}
            selected={theme === t.id}
            onClick={() => setTheme(t.id)}
            label={t.label}
            hint={t.mode === 'dark' ? 'Dark' : 'Light'}
            leading={
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line"
                style={{ background: t.swatch[0] }}
              >
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: t.swatch[1] }} />
              </span>
            }
          />
        ))}
      </div>
    </SettingsCard>
  );
}

/** Sync & backup: on by default; local-only is an explicit, warned choice.
 * Turning sync off offers to also erase the server copy (the privacy case). */
function SyncSection() {
  const queryClient = useQueryClient();
  const sync = useSyncState();
  const enabledQuery = useQuery({ queryKey: ['sync', 'enabled'], queryFn: isSyncEnabled });
  const enabled = enabledQuery.data ?? true;
  // Going local is a two-step conversation: 'choose' asks what to do with the
  // server copy; picking "delete it" moves to 'delete', a second, explicit
  // confirmation, because that one cannot be undone.
  const [confirming, setConfirming] = useState<'choose' | 'delete' | null>(null);

  const toggle = useMutation({
    mutationFn: (args: { enabled: boolean; deleteServerCopy?: boolean }) =>
      setSyncEnabled(args.enabled, { deleteServerCopy: args.deleteServerCopy }),
    onSuccess: () => {
      setConfirming(null);
      void queryClient.invalidateQueries({ queryKey: ['sync', 'enabled'] });
    },
  });

  const trainingQuery = useQuery({
    queryKey: ['sync', 'training'],
    queryFn: isTrainingSyncEnabled,
  });
  const trainingOn = trainingQuery.data ?? true;
  const toggleTraining = useMutation({
    mutationFn: setTrainingSyncEnabled,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sync', 'training'] }),
  });

  const lastSynced = sync.lastSyncAt
    ? new Date(sync.lastSyncAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <SettingsCard
      title="Sync & backup"
      Icon={CloudUpload}
      hint={
        <>
          Keeps your diet, recipes, meal plan and shopping list
          {trainingOn ? ' — plus your workouts and training plans —' : ''} the same on every device
          you sign in on, syncing whenever you're online. Health data from watches never syncs — it
          stays on the device that recorded it.
        </>
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <OptionButton
          selected={enabled}
          onClick={() => {
            if (!enabled) toggle.mutate({ enabled: true });
          }}
          label="Sync on"
          hint="Backed up and shared across devices"
        />
        <OptionButton
          selected={!enabled}
          onClick={() => {
            if (enabled) setConfirming('choose');
          }}
          label="Local only"
          hint="Data never leaves this device"
        />
      </div>

      {enabled && (
        <div className="mt-3 rounded-xl border border-line bg-elev/40 p-3">
          {/* The whole row is the switch, so the tap target is the full width
              rather than just the 44px-wide track. */}
          <button
            type="button"
            role="switch"
            aria-checked={trainingOn}
            disabled={toggleTraining.isPending || trainingQuery.isLoading}
            onClick={() => toggleTraining.mutate(!trainingOn)}
            className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
          >
            <span className="text-sm font-semibold">Sync training data</span>
            <span
              aria-hidden
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                trainingOn ? 'bg-accent' : 'bg-line'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${
                  trainingOn ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </span>
          </button>
          <p className="text-sm text-muted">
            On by default — workout plans, workouts and logged sessions follow you across devices,
            private to your account. Turn it off to keep training on this device only; individual
            plans can also be pinned per-plan from the Plans page.
          </p>
          {!trainingOn && (
            <p className="mt-2 text-sm text-amber-500">
              Training sync is off — new workouts, plans and sessions stay on this device. What's
              already backed up stays on the server.
            </p>
          )}
        </div>
      )}

      {sync.accountMismatch && (
        <div className="mt-3 space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p>
            The data on this device was synced by a different account, so syncing is paused to keep
            accounts separate.
          </p>
          <Button variant="secondary" block onClick={() => void adoptCurrentAccount()}>
            Sync this device with the current account
          </Button>
        </div>
      )}

      {enabled && !sync.accountMismatch && (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
          <span aria-live="polite" className="min-w-0">
            {sync.status === 'syncing' && 'Syncing…'}
            {sync.status === 'error' &&
              `Sync problem: ${sync.error ?? 'unknown error'} — will retry`}
            {sync.status !== 'syncing' &&
              sync.status !== 'error' &&
              (lastSynced ? `Last synced ${lastSynced}` : 'Waiting for first sync')}
          </span>
          <Button
            variant="secondary"
            className="shrink-0"
            onClick={() => void syncNow()}
            disabled={sync.status === 'syncing'}
          >
            <RefreshCw
              size={18}
              className={sync.status === 'syncing' ? 'animate-spin' : ''}
              aria-hidden
            />
            Sync now
          </Button>
        </div>
      )}
      {!enabled && (
        <p className="mt-3 flex items-center gap-2 text-sm text-amber-500">
          <TriangleAlert size={18} className="shrink-0" aria-hidden />
          Local only — this device's data isn't backed up.
        </p>
      )}

      {confirming === 'choose' && (
        <Sheet title="Go local only?" onClose={() => setConfirming(null)}>
          <p className="text-sm text-muted">
            Your diet, recipes, meal plan and shopping list will exist only on this device. If you
            lose it, they're gone — and your other devices will stop getting updates.
          </p>
          <div className="mt-5 grid gap-2">
            <Button
              variant="secondary"
              size="lg"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ enabled: false })}
            >
              Go local, keep server backup
            </Button>
            <Button variant="danger" size="lg" onClick={() => setConfirming('delete')}>
              Go local and delete server copy…
            </Button>
            <Button variant="ghost" size="lg" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
          {toggle.isError && (
            <p className="mt-3 text-sm text-rose-500">Couldn't change sync — try again.</p>
          )}
        </Sheet>
      )}
      {confirming === 'delete' && (
        <ConfirmSheet
          title="Delete the server copy?"
          body="Sync turns off and the backup on the server is erased. This device will hold the only copy of your data, and the deletion can't be undone."
          confirmLabel="Go local and delete server copy"
          pending={toggle.isPending}
          onConfirm={() => toggle.mutate({ enabled: false, deleteServerCopy: true })}
          onClose={() => setConfirming(null)}
        />
      )}
    </SettingsCard>
  );
}

export function SettingsPage() {
  const units = useUnits();
  const setUnits = useSetUnits();
  const setup = useTrainingSetup();
  const saveSetup = useSaveTrainingSetup();

  const toggleEquipment = (id: number) => {
    const has = setup.homeEquipmentIds.includes(id);
    saveSetup.mutate({
      ...setup,
      homeEquipmentIds: has
        ? setup.homeEquipmentIds.filter((x) => x !== id)
        : [...setup.homeEquipmentIds, id],
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <PageHeader title="Settings" back="/you" />

      <BillingSection />

      <SyncSection />

      <ThemeSection />

      <SettingsCard
        title="Units"
        Icon={Ruler}
        hint="Applies to body weight, height and workout weights. Your data is stored the same either way — switching converts what you see, not what's saved."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {UNIT_OPTIONS.map(({ id, label, hint }) => (
            <OptionButton
              key={id}
              selected={units === id}
              onClick={() => setUnits.mutate(id)}
              label={label}
              hint={hint}
            />
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Where you train"
        Icon={Dumbbell}
        hint="Training at home? Tell us what your setup has and the exercise search can filter to just what you own (bodyweight always counts)."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {LOCATION_OPTIONS.map(({ id, label, hint }) => (
            <OptionButton
              key={id}
              selected={setup.location === id}
              onClick={() => saveSetup.mutate({ ...setup, location: id })}
              label={label}
              hint={hint}
            />
          ))}
        </div>

        {setup.location !== 'gym' && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-muted">Home equipment</p>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.filter((e) => e.name !== 'Body only').map(({ id, name }) => {
                const active = setup.homeEquipmentIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleEquipment(id)}
                    className={`min-h-11 rounded-full border px-4 text-sm font-medium transition-colors ${
                      active
                        ? 'border-transparent bg-accent text-accent-ink shadow-sm'
                        : 'border-line bg-surface text-muted hover:text-ink'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </SettingsCard>

      <DangerZoneSection />

      <p className="px-1 text-sm text-muted">
        <Link to="/welcome" className="text-accent hover:underline">
          Training profile
        </Link>{' '}
        (goal, level, days per week) and password live under{' '}
        <Link to="/profile" className="text-accent hover:underline">
          your profile
        </Link>
        .
      </p>
    </div>
  );
}
