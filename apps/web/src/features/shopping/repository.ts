import type { ShoppingList, ShoppingListItem } from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';

export async function listShoppingLists(): Promise<ShoppingList[]> {
  const db = await getDb();
  const lists = (await db.query('SELECT * FROM shopping_lists ORDER BY created_at DESC'))
    .values as Record<string, unknown>[];
  const items = (await db.query('SELECT * FROM shopping_list_items ORDER BY position'))
    .values as Record<string, unknown>[];

  const toItem = (r: Record<string, unknown>): ShoppingListItem => ({
    id: r.id as string,
    listId: r.list_id as string,
    name: r.name as string,
    quantity: r.quantity as string | null,
    checked: Boolean(r.checked),
    position: r.position as number,
  });

  return lists.map((l) => ({
    id: l.id as string,
    name: l.name as string,
    dietPlanId: l.diet_plan_id as string | null,
    createdAt: l.created_at as string,
    items: items.filter((i) => i.list_id === l.id).map(toItem),
  }));
}

export async function createShoppingList(name: string): Promise<string> {
  const db = await getDb();
  const id = newId();
  await db.run(
    'INSERT INTO shopping_lists (id, name, diet_plan_id, created_at) VALUES (?, ?, NULL, ?)',
    [id, name, new Date().toISOString()],
  );
  await persist();
  return id;
}

export async function addItem(listId: string, name: string, quantity?: string): Promise<void> {
  const db = await getDb();
  const positionRes = await db.query(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM shopping_list_items WHERE list_id = ?',
    [listId],
  );
  const position = (positionRes.values?.[0]?.next as number) ?? 0;
  await db.run(
    'INSERT INTO shopping_list_items (id, list_id, name, quantity, checked, position) VALUES (?, ?, ?, ?, 0, ?)',
    [newId(), listId, name, quantity ?? null, position],
  );
  await persist();
}

export async function toggleItem(itemId: string, checked: boolean): Promise<void> {
  const db = await getDb();
  await db.run('UPDATE shopping_list_items SET checked = ? WHERE id = ?', [
    checked ? 1 : 0,
    itemId,
  ]);
  await persist();
}
