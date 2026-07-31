import { Check, Dumbbell, Ruler } from 'lucide-react';
import { EQUIPMENT_OPTIONS } from '@/lib/exercise-db/client';
import {
  useSaveTrainingSetup,
  useTrainingSetup,
  type TrainingLocation,
} from '@/lib/trainingSetup';
import { useSetUnits, useUnits, type UnitSystem } from '@/lib/units';

const UNIT_OPTIONS: { id: UnitSystem; label: string; hint: string }[] = [
  { id: 'metric', label: 'Metric', hint: 'Kilograms and centimeters' },
  { id: 'imperial', label: 'Imperial', hint: 'Pounds and inches' },
];

const LOCATION_OPTIONS: { id: TrainingLocation; label: string; hint: string }[] = [
  { id: 'gym', label: 'Gym', hint: 'Full equipment access' },
  { id: 'home', label: 'Home', hint: 'Only what you own' },
  { id: 'both', label: 'Both', hint: 'Gym and a home setup' },
];

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
        Theme lives in the top bar; more preferences will land here over time.
      </p>
    </div>
  );
}
