import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, RotateCcw, ShoppingCart, Trash2 } from 'lucide-react';
import type { ShoppingItem } from '@arcadia/shared';
import {
  addNeededItem,
  deleteShoppingItem,
  listShoppingItems,
  markBought,
  rebuyItem,
} from '../repository';

function lastBoughtLabel(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export function ShoppingPage() {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
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

  const needed = (itemsQuery.data ?? []).filter((i) => i.status === 'needed');
  const bought = (itemsQuery.data ?? []).filter((i) => i.status === 'bought');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addMutation.mutate({ itemName: trimmed, qty: quantity.trim() || undefined });
    setName('');
    setQuantity('');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Shopping</h1>
        <p className="text-sm text-muted">
          One living list — checked-off items move to history so you can re-add them next trip
          instead of starting a new list.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add an item — e.g. Chicken breast…"
          className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Qty"
          aria-label="Quantity (optional)"
          className="w-24 rounded-xl border border-line bg-surface px-3 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90"
        >
          Add
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ShoppingCart size={18} className="text-accent" aria-hidden />
          To buy
          {needed.length > 0 && (
            <span className="text-sm font-normal text-muted tabular-nums">({needed.length})</span>
          )}
        </h2>
        {needed.length === 0 && (
          <p className="text-sm text-muted">
            Nothing on the list. Add items above, rebuy from history below, or generate
            ingredients from your meal plan.
          </p>
        )}
        <ul className="space-y-1.5">
          {needed.map((item: ShoppingItem) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-sm"
            >
              <input
                type="checkbox"
                checked={false}
                onChange={() => boughtMutation.mutate(item.id)}
                aria-label={`Mark ${item.name} as bought`}
                className="h-4 w-4 shrink-0 rounded accent-(--accent)"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {item.name}
                {item.quantity && <span className="text-muted"> — {item.quantity}</span>}
              </span>
              {item.timesBought > 0 && (
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  bought ×{item.timesBought}
                </span>
              )}
              <button
                type="button"
                onClick={() => deleteMutation.mutate(item.id)}
                aria-label={`Remove ${item.name}`}
                className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <History size={18} className="text-muted" aria-hidden />
          Previously bought
        </h2>
        {bought.length === 0 && (
          <p className="text-sm text-muted">
            Check items off the list and they'll collect here for one-tap rebuying.
          </p>
        )}
        <ul className="grid gap-1.5 md:grid-cols-2">
          {bought.map((item: ShoppingItem) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-sm"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="block text-xs text-muted tabular-nums">
                  ×{item.timesBought} · last {lastBoughtLabel(item.lastBoughtAt)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => rebuyMutation.mutate(item.id)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-elev"
              >
                <RotateCcw size={13} aria-hidden />
                Rebuy
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(item.id)}
                aria-label={`Delete ${item.name} from history`}
                className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-elev hover:text-ink"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
