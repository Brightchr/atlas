import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookmarkPlus, Check, NotebookPen, ShoppingCart } from 'lucide-react';
import { Button, Card, Sheet } from '@/components/ui';
import { localIsoDate } from '@/lib/dates';
import {
  addPlanRangeToShoppingList,
  getShoppingCadenceDays,
  logPlanDayToDiary,
  setShoppingCadenceDays,
} from '../../mealPlan';
import { saveCurrentWeekAsPlan } from '../../savedMealPlans';

/** The cadences offered in the dropdown; anything else is "custom". */
const PRESET_CADENCES = [3, 7, 14, 30];

const fieldClass =
  'h-11 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent md:h-9';

/** The result of an action, shown right under the button that caused it
 * (they used to pile up at the very bottom of the page). */
function Status({ tone, children }: { tone: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p
      role="status"
      className={`flex items-start gap-1.5 text-sm ${
        tone === 'ok' ? 'text-emerald-500' : 'text-rose-500'
      }`}
    >
      {tone === 'ok' && <Check size={16} className="mt-0.5 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}

/** The name form for "Save week as plan", in a sheet instead of an input
 * that appeared in the middle of the button row. */
function SavePlanSheet({
  initialName,
  pending,
  failed,
  onSave,
  onClose,
}: {
  initialName: string;
  pending: boolean;
  failed: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const valid = name.trim() !== '';
  return (
    <Sheet
      title="Save week as plan"
      onClose={onClose}
      footer={
        // `form="save-plan"` ties this button to the form below even though
        // the footer is rendered outside it, so Enter and the button agree.
        <Button type="submit" form="save-plan" size="lg" block disabled={!valid || pending}>
          Save plan
        </Button>
      }
    >
      <form
        id="save-plan"
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !pending) onSave(name);
        }}
      >
        <label htmlFor="save-plan-name" className="text-sm font-semibold">
          Plan name
        </label>
        <input
          id="save-plan-name"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My cutting week"
          // text-base (16px) stops iOS Safari zooming in on focus.
          className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-base outline-none placeholder:text-muted/70 focus:border-accent"
        />
        <p className="text-sm text-muted">
          You'll find it under Browse plans, in My plans. Saving the same name again updates it.
        </p>
        {failed && <Status tone="error">Couldn't save the plan. Try again.</Status>}
      </form>
    </Sheet>
  );
}

/** Everything you can do WITH the week once it has meals in it: log a day,
 * send it to the shopping list, keep it as a reusable plan. One card, one
 * primary button, each result reported next to its own button.
 *
 * This component owns its own queries and mutations — the page only tells
 * it which day "log" means. */
export function PlanActions({
  logDay,
  logLabel,
  canLog,
  defaultPlanName,
}: {
  /** Plan day (0 = Monday) the log button copies into today's diary. */
  logDay: number;
  /** "today" in the week view, the weekday name in the day view. */
  logLabel: string;
  /** False when that day has nothing planned. */
  canLog: boolean;
  /** Pre-fills the save sheet (the current custom plan's name, or empty). */
  defaultPlanName: string;
}) {
  const queryClient = useQueryClient();

  const logMutation = useMutation({
    // Always logs into TODAY's diary, whichever plan day is being copied.
    mutationFn: () => logPlanDayToDiary(logDay, localIsoDate()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['diary'] });
      void queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });

  // The grocery cadence: how many days each shopping trip should cover.
  const cadenceQuery = useQuery({
    queryKey: ['settings', 'shopping_cadence'],
    queryFn: getShoppingCadenceDays,
  });
  const cadence = cadenceQuery.data ?? 7;
  const [customCadence, setCustomCadence] = useState(false);
  const showCustom = customCadence || !PRESET_CADENCES.includes(cadence);
  const cadenceMutation = useMutation({
    mutationFn: setShoppingCadenceDays,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['settings', 'shopping_cadence'] }),
  });
  const shoppingMutation = useMutation({
    mutationFn: () => addPlanRangeToShoppingList(cadence),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['shopping'] }),
  });

  // Saving the current week as a reusable named plan (Browse → My plans).
  const [saving, setSaving] = useState(false);
  const saveMutation = useMutation({
    mutationFn: saveCurrentWeekAsPlan,
    onSuccess: () => {
      setSaving(false);
      void queryClient.invalidateQueries({ queryKey: ['mealPlan', 'saved'] });
    },
  });

  const days = `${cadence} day${cadence === 1 ? '' : 's'}`;

  // The log button is drawn in two places (see below), so build it once.
  const logButton = (extraClass = '') => (
    <Button
      size="lg"
      block
      className={extraClass}
      disabled={!canLog || logMutation.isPending}
      onClick={() => logMutation.mutate()}
    >
      <NotebookPen size={18} aria-hidden />
      Log {logLabel} to today's diary
    </Button>
  );
  const logStatus = logMutation.isSuccess ? (
    <Status tone="ok">Planned meals logged to today's diary.</Status>
  ) : logMutation.isError ? (
    <Status tone="error">Couldn't log the day. Try again.</Status>
  ) : null;

  return (
    <>
      {/* Phones: the primary action rides at the bottom of the screen while
          the week scrolls (same pattern as the diary's "Add food"). `sticky`
          rather than `fixed`, so it stays inside the scroll area and never
          covers the tab bar. The `order-*` classes only matter on phones,
          where the page stacks everything in one flex column. */}
      {canLog && (
        <div className="sticky bottom-3 z-10 order-3 space-y-2 lg:hidden">
          {logStatus && (
            <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-lg">
              {logStatus}
            </div>
          )}
          {logButton('shadow-lg')}
        </div>
      )}

      <Card className="order-4 divide-y divide-line">
        {/* Wide screens: the same button lives here, at the top of the card.
            It also shows on phones when there is nothing to log, to say why. */}
        <div className={`space-y-2 p-4 ${canLog ? 'hidden lg:block' : ''}`}>
          {logButton()}
          {!canLog && <p className="text-sm text-muted">Nothing is planned for {logLabel} yet.</p>}
          {logStatus}
        </div>

        <div className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="shop-cadence" className="text-sm font-semibold">
              I shop
            </label>
            <select
              id="shop-cadence"
              value={showCustom ? 'custom' : String(cadence)}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setCustomCadence(true);
                } else {
                  setCustomCadence(false);
                  cadenceMutation.mutate(Number(e.target.value));
                }
              }}
              className={`min-w-0 flex-1 ${fieldClass}`}
            >
              <option value="3">every 3 days</option>
              <option value="7">weekly</option>
              <option value="14">every 2 weeks</option>
              <option value="30">monthly</option>
              <option value="custom">custom…</option>
            </select>
            {showCustom && (
              <>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="90"
                  value={cadence}
                  onChange={(e) => cadenceMutation.mutate(Number(e.target.value) || 1)}
                  aria-label="Days between shopping trips"
                  className={`w-16 text-center ${fieldClass}`}
                />
                <span className="text-sm text-muted">days</span>
              </>
            )}
          </div>
          <Button
            variant="secondary"
            block
            disabled={shoppingMutation.isPending}
            onClick={() => shoppingMutation.mutate()}
          >
            <ShoppingCart size={16} aria-hidden />
            Add next {days} to shopping list
          </Button>
          {shoppingMutation.isSuccess && (
            <Status tone="ok">
              {shoppingMutation.data} ingredient{shoppingMutation.data === 1 ? '' : 's'} added. That
              covers you until your next trip in {days}.
            </Status>
          )}
          {shoppingMutation.isError && (
            <Status tone="error">Couldn't add to the shopping list. Try again.</Status>
          )}
        </div>

        <div className="space-y-2 p-4">
          <Button variant="ghost" block onClick={() => setSaving(true)}>
            <BookmarkPlus size={16} aria-hidden />
            Save week as plan
          </Button>
          {saveMutation.isSuccess && !saving && (
            <Status tone="ok">Saved. Find it under Browse plans, in My plans.</Status>
          )}
        </div>

        {saving && (
          <SavePlanSheet
            initialName={defaultPlanName}
            pending={saveMutation.isPending}
            failed={saveMutation.isError}
            onSave={(name) => saveMutation.mutate(name)}
            onClose={() => setSaving(false)}
          />
        )}
      </Card>
    </>
  );
}
