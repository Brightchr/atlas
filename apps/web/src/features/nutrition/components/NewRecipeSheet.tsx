import { useState } from 'react';
import { Button, Sheet, Stepper } from '@/components/ui';

/** Name + servings for a new recipe. A sheet, so opening it doesn't shove
 * the recipe grid down the page. Mounted only while open, which is what
 * resets the fields for next time.
 *
 * It only collects the two values — the page owns the mutation and decides
 * what happens after (it jumps straight into the new recipe). */
export function NewRecipeSheet({
  pending,
  failed,
  onCreate,
  onClose,
}: {
  pending: boolean;
  failed: boolean;
  onCreate: (name: string, servings: number) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const valid = name.trim() !== '';

  return (
    <Sheet
      title="New recipe"
      onClose={onClose}
      footer={
        // `form` links the button to the form below (the footer is rendered
        // outside it), so pressing Enter in the name field does the same.
        <Button type="submit" form="new-recipe" size="lg" block disabled={!valid || pending}>
          Create recipe
        </Button>
      }
    >
      <form
        id="new-recipe"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          // An empty or zero servings field falls back to 1.
          if (valid && !pending) onCreate(name.trim(), Number(servings) || 1);
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="new-recipe-name" className="text-sm font-semibold">
            Name
          </label>
          <input
            id="new-recipe-name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Turkey sandwich"
            // text-base (16px) stops iOS Safari zooming in on focus.
            className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-base outline-none placeholder:text-muted/70 focus:border-accent"
          />
        </div>
        <div className="mx-auto max-w-56">
          <Stepper
            label="Servings it makes"
            value={servings}
            onChange={setServings}
            step={1}
            min={1}
            placeholder="1"
          />
        </div>
        <p className="text-sm text-muted">You'll add the ingredients on the next screen.</p>
        {failed && <p className="text-sm text-rose-500">Couldn't create the recipe. Try again.</p>}
      </form>
    </Sheet>
  );
}
