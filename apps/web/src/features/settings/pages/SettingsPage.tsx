import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CloudUpload, Dumbbell, RefreshCw, Ruler, TriangleAlert } from 'lucide-react';
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
import {
  useSaveTrainingSetup,
  useTrainingSetup,
  type TrainingLocation,
} from '@/lib/trainingSetup';
import { useSetUnits, useUnits, type UnitSystem } from '@/lib/units';

const UNIT_OPTIONS: { id: UnitSystem; label: string; hint: string }[] = [
  { id: 'imperial', label: 'US units', hint: 'Pounds, feet & inches (default)' },
  { id: 'metric', label: 'Metric', hint: 'Kilograms and centimeters' },
];

const LOCATION_OPTIONS: { id: TrainingLocation; label: string; hint: string }[] = [
  { id: 'gym', label: 'Gym', hint: 'Full equipment access' },
  { id: 'home', label: 'Home', hint: 'Only what you own' },
  { id: 'both', label: 'Both', hint: 'Gym and a home setup' },
];

/** Sync & backup: on by default; local-only is an explicit, warned choice.
 * Turning sync off offers to also erase the server copy (the privacy case). */
function SyncSection() {
  const queryClient = useQueryClient();
  const sync = useSyncState();
  const enabledQuery = useQuery({ queryKey: ['sync', 'enabled'], queryFn: isSyncEnabled });
  const enabled = enabledQuery.data ?? true;
  const [confirming, setConfirming] = useState(false);

  const toggle = useMutation({
    mutationFn: (args: { enabled: boolean; deleteServerCopy?: boolean }) =>
      setSyncEnabled(args.enabled, { deleteServerCopy: args.deleteServerCopy }),
    onSuccess: () => {
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ['sync', 'enabled'] });
    },
  });

  const trainingQuery = useQuery({
    queryKey: ['sync', 'training'],
    queryFn: isTrainingSyncEnabled,
  });
  const trainingOn = trainingQuery.data ?? false;
  const toggleTraining = useMutation({
    mutationFn: setTrainingSyncEnabled,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sync', 'training'] }),
  });

  const lastSynced = sync.lastSyncAt
    ? new Date(sync.lastSyncAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
          <CloudUpload size={17} strokeWidth={1.8} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold">Sync &amp; backup</p>
          <p className="text-xs text-muted">
            Keeps your diet, recipes, meal plan and shopping list
            {trainingOn ? ' — plus your workouts and training plans —' : ''} the same on every
            device you sign in on, syncing whenever you're online. Health data from watches never
            syncs — it stays on the device that recorded it.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          aria-pressed={enabled}
          onClick={() => {
            if (!enabled) toggle.mutate({ enabled: true });
          }}
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
            enabled ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface hover:bg-elev'
          }`}
        >
          <span>
            <span className="block text-sm font-semibold">Sync on</span>
            <span className="block text-xs text-muted">Backed up and shared across devices</span>
          </span>
          {enabled && <Check size={16} className="shrink-0 text-accent" aria-hidden />}
        </button>
        <button
          type="button"
          aria-pressed={!enabled}
          onClick={() => {
            if (enabled) setConfirming(true);
          }}
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
            !enabled ? 'border-accent/40 bg-accent-soft' : 'border-line bg-surface hover:bg-elev'
          }`}
        >
          <span>
            <span className="block text-sm font-semibold">Local only</span>
            <span className="block text-xs text-muted">Data never leaves this device</span>
          </span>
          {!enabled && <Check size={16} className="shrink-0 text-accent" aria-hidden />}
        </button>
      </div>

      {enabled && (
        <div className="mt-3 rounded-xl border border-line bg-elev/40 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Also sync training</p>
              <p className="text-xs text-muted">
                Off by default — workout plans, workouts and logged sessions stay on this device
                unless you opt in. Turn it on and they follow you across devices too (private to
                your account; sharing stays a separate, per-plan choice).
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={trainingOn}
              aria-label="Sync training data"
              disabled={toggleTraining.isPending || trainingQuery.isLoading}
              onClick={() => toggleTraining.mutate(!trainingOn)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                trainingOn ? 'bg-accent' : 'bg-line'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${
                  trainingOn ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>
          {trainingOn && (
            <p className="mt-2 text-xs text-muted">
              Individual plans can still be pinned to one device from the Plans page. Turning this
              off stops future syncing but leaves what's already backed up.
            </p>
          )}
        </div>
      )}

      {confirming && (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="flex items-start gap-2">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
            <p className="text-xs">
              Your diet, recipes, meal plan and shopping list will exist only on this device. If
              you lose it, they're gone — and your other devices will stop getting updates.
            </p>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ enabled: false })}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-elev"
            >
              Go local, keep server backup
            </button>
            <button
              type="button"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ enabled: false, deleteServerCopy: true })}
              className="rounded-lg border border-rose-500/40 bg-surface px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-elev"
            >
              Go local and delete server copy
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {sync.accountMismatch && (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <p>
            The data on this device was synced by a different account, so syncing is paused to
            keep accounts separate.
          </p>
          <button
            type="button"
            onClick={() => void adoptCurrentAccount()}
            className="mt-2 rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold hover:bg-elev"
          >
            Sync this device with the current account
          </button>
        </div>
      )}

      {enabled && !sync.accountMismatch && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span aria-live="polite">
            {sync.status === 'syncing' && 'Syncing…'}
            {sync.status === 'error' && `Sync problem: ${sync.error ?? 'unknown error'} — will retry`}
            {sync.status !== 'syncing' &&
              sync.status !== 'error' &&
              (lastSynced ? `Last synced ${lastSynced}` : 'Waiting for first sync')}
          </span>
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={sync.status === 'syncing'}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 font-semibold text-ink hover:bg-elev disabled:opacity-50"
          >
            <RefreshCw
              size={13}
              className={sync.status === 'syncing' ? 'animate-spin' : ''}
              aria-hidden
            />
            Sync now
          </button>
        </div>
      )}
      {!enabled && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
          <TriangleAlert size={14} aria-hidden />
          Local only — this device's data isn't backed up.
        </p>
      )}
    </section>
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
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted">Preferences for how the app displays your data.</p>
      </header>

      <SyncSection />

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Ruler size={17} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">Units</p>
            <p className="text-xs text-muted">
              Applies to body weight, height and workout weights. Your data is stored the same
              either way — switching converts what you see, not what's saved.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {UNIT_OPTIONS.map(({ id, label, hint }) => (
            <button
              key={id}
              type="button"
              aria-pressed={units === id}
              onClick={() => setUnits.mutate(id)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                units === id
                  ? 'border-accent/40 bg-accent-soft'
                  : 'border-line bg-surface hover:bg-elev'
              }`}
            >
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
              {units === id && <Check size={16} className="shrink-0 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Dumbbell size={17} strokeWidth={1.8} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">Where you train</p>
            <p className="text-xs text-muted">
              Training at home? Tell us what your setup has and the exercise search can filter to
              just what you own (bodyweight always counts).
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {LOCATION_OPTIONS.map(({ id, label, hint }) => (
            <button
              key={id}
              type="button"
              aria-pressed={setup.location === id}
              onClick={() => saveSetup.mutate({ ...setup, location: id })}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                setup.location === id
                  ? 'border-accent/40 bg-accent-soft'
                  : 'border-line bg-surface hover:bg-elev'
              }`}
            >
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
              {setup.location === id && (
                <Check size={16} className="shrink-0 text-accent" aria-hidden />
              )}
            </button>
          ))}
        </div>

        {setup.location !== 'gym' && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium text-muted">Home equipment</p>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT_OPTIONS.filter((e) => e.name !== 'Body only').map(({ id, name }) => {
                const active = setup.homeEquipmentIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleEquipment(id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
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
      </section>

      <p className="text-xs text-muted/70">
        Theme lives in the top bar. Training goals and password live under{' '}
        <Link to="/profile" className="text-accent hover:underline">
          your profile
        </Link>
        .
      </p>
    </div>
  );
}
