import { Check, Ruler } from 'lucide-react';
import { useSetUnits, useUnits, type UnitSystem } from '@/lib/units';

const UNIT_OPTIONS: { id: UnitSystem; label: string; hint: string }[] = [
  { id: 'metric', label: 'Metric', hint: 'Kilograms and centimeters' },
  { id: 'imperial', label: 'Imperial', hint: 'Pounds and inches' },
];

export function SettingsPage() {
  const units = useUnits();
  const setUnits = useSetUnits();

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

      <p className="text-xs text-muted/70">
        Theme lives in the top bar; more preferences will land here over time.
      </p>
    </div>
  );
}
