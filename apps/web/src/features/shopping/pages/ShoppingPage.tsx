import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createShoppingList, listShoppingLists, toggleItem } from '../repository';

export function ShoppingPage() {
  const [name, setName] = useState('');
  const queryClient = useQueryClient();

  const listsQuery = useQuery({ queryKey: ['shopping'], queryFn: listShoppingLists });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shopping'] });
  const createMutation = useMutation({ mutationFn: createShoppingList, onSuccess: invalidate });
  const toggleMutation = useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) => toggleItem(id, checked),
    onSuccess: invalidate,
  });

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
    setName('');
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-bold">Shopping</h1>
        <p className="text-sm text-muted">
          Lists you create here — later also generated straight from diet plans.
        </p>
      </header>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="New list name…"
          className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 shadow-sm outline-none placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 font-semibold text-accent-ink shadow-sm transition-opacity hover:opacity-90"
        >
          Add
        </button>
      </div>

      {listsQuery.data?.length === 0 && <p className="text-muted">No shopping lists yet.</p>}

      <ul className="grid gap-3 md:grid-cols-2">
        {listsQuery.data?.map((list) => (
          <li key={list.id} className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <p className="font-semibold">{list.name}</p>
            {list.items.length === 0 ? (
              <p className="text-sm text-muted/70">Empty list</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {list.items.map((item) => (
                  <li key={item.id}>
                    <label className="flex items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) =>
                          toggleMutation.mutate({ id: item.id, checked: e.target.checked })
                        }
                        className="h-4 w-4 rounded accent-(--accent)"
                      />
                      <span className={item.checked ? 'text-muted line-through' : ''}>
                        {item.name}
                        {item.quantity ? ` — ${item.quantity}` : ''}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
