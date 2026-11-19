import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus } from 'lucide-react';
import { Button, Card, ConfirmSheet, SectionLabel, buttonClasses } from '@/components/ui';
import {
  addNeededItem,
  clearBoughtItems,
  deleteShoppingItem,
  listShoppingItems,
  markBought,
  rebuyItem,
} from '../repository';
import { BoughtRow, NeededRow } from '../components/ShoppingRows';

// 44px on phones, tighter with a mouse. text-base (16px) on phones stops iOS
// Safari zooming the page when the field is focused.
const fieldClasses =
  'min-h-11 min-w-0 rounded-xl border border-line bg-surface px-3 text-base outline-none placeholder:text-muted/70 focus:border-accent md:min-h-9 md:text-sm';

/** One living list: ticked-off items move to "Bought", where a tap puts them
 * back on the list for the next trip. */
export function ShoppingPage() {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  // "Bought" is secondary: closed on phones so the list to buy owns the
  // screen, open on desktop where it has its own column. Read once on mount;
  // after that the header button is in charge.
  const [showBought, setShowBought] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches,
  );
  const [confirmingClear, setConfirmingClear] = useState(false);
  const queryClient = useQueryClient();

  const itemsQuery = useQuery({ queryKey: ['shopping'], queryFn: listShoppingItems });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shopping'] });
  const addMutation = useMutation({
    mutationFn: ({ itemName, qty }: { itemName: string; qty?: string }) =>
      addNeededItem(itemName, qty || null),
    onSuccess: invalidate,
  });
  const boughtMutation = useMutation({ mutationFn: markBought, onSuccess: invalidate });
  const rebuyMutation = useMutation({ mutationFn: rebuyItem, onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: deleteShoppingItem, onSuccess: invalidate });
  const clearMutation = useMutation({
    mutationFn: clearBoughtItems,
    onSuccess: invalidate,
    // Close whether it worked or not, so a failure never leaves the sheet stuck.
    onSettled: () => setConfirmingClear(false),
  });

  const needed = (itemsQuery.data ?? []).filter((i) => i.status === 'needed');
  const bought = (itemsQuery.data ?? []).filter((i) => i.status === 'bought');

  // A real <form>, so Enter in either field adds the item without a key handler.
  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addMutation.mutate({ itemName: trimmed, qty: quantity.trim() || undefined });
    setName('');
    setQuantity('');
  };

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      {/* The pill bar above already says "Shopping". */}
      <h1 className="sr-only">Shopping list</h1>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <section className="min-w-0 space-y-2 lg:col-span-3">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Add an item, e.g. chicken breast"
              aria-label="Item to add"
              enterKeyHint="done"
              className={`${fieldClasses} flex-1`}
            />
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
              aria-label="Quantity (optional)"
              enterKeyHint="done"
              className={`${fieldClasses} w-20`}
            />
            <Button type="submit" className="shrink-0" disabled={!name.trim()}>
              <Plus size={18} aria-hidden />
              Add
            </Button>
          </form>

          <SectionLabel>To buy{needed.length > 0 && ` · ${needed.length}`}</SectionLabel>
          {needed.length === 0 ? (
            // Wait for the first load, so the empty state does not flash up
            // before the list arrives.
            itemsQuery.isSuccess && (
              <div className="rounded-2xl border border-dashed border-line p-6 text-center">
                <p className="text-sm text-muted">
                  Nothing to buy. Add items above, rebuy something you bought before, or fill the
                  list from your meal plan.
                </p>
                <Link to="/eat/meal-plan" className={buttonClasses('soft', 'md', 'mt-3')}>
                  Open meal plan
                </Link>
              </div>
            )
          ) : (
            <Card className="overflow-hidden">
              <ul>
                {needed.map((item) => (
                  <NeededRow
                    key={item.id}
                    item={item}
                    onBought={() => boughtMutation.mutate(item.id)}
                    onRemove={() => deleteMutation.mutate(item.id)}
                  />
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section className="min-w-0 space-y-2 lg:col-span-2">
          <div className="flex min-h-11 items-center justify-between gap-2 md:min-h-9">
            <button
              type="button"
              aria-expanded={showBought}
              onClick={() => setShowBought((open) => !open)}
              className="flex min-h-11 flex-1 items-center gap-1.5 rounded-xl px-1 text-left text-xs font-semibold tracking-wide text-muted uppercase hover:text-ink md:min-h-9"
            >
              <ChevronDown
                size={16}
                className={`shrink-0 transition-transform ${showBought ? '' : '-rotate-90'}`}
                aria-hidden
              />
              Bought{bought.length > 0 && ` · ${bought.length}`}
            </button>
            {showBought && bought.length > 0 && (
              <Button variant="ghost" onClick={() => setConfirmingClear(true)}>
                Clear
              </Button>
            )}
          </div>

          {showBought &&
            (bought.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
                Tick items off the list and they collect here, ready to rebuy with one tap.
              </p>
            ) : (
              <Card className="overflow-hidden">
                <ul>
                  {bought.map((item) => (
                    <BoughtRow
                      key={item.id}
                      item={item}
                      onRebuy={() => rebuyMutation.mutate(item.id)}
                      onRemove={() => deleteMutation.mutate(item.id)}
                    />
                  ))}
                </ul>
              </Card>
            ))}
        </section>
      </div>

      {confirmingClear && (
        <ConfirmSheet
          title="Clear bought items?"
          body={`This deletes ${bought.length === 1 ? 'the 1 item' : `all ${bought.length} items`} under Bought, along with how often you bought them. Your "To buy" list is not affected.`}
          confirmLabel="Clear bought"
          pending={clearMutation.isPending}
          onConfirm={() => clearMutation.mutate()}
          onClose={() => setConfirmingClear(false)}
        />
      )}
    </div>
  );
}
