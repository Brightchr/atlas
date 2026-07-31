import type { ShoppingItem } from '@arcadia/shared';
import { getDb, newId, persist } from '@/lib/db';

/** The single living shopping list. 'needed' rows are the active list;
 * 'bought' rows are purchase history that can be re-added (rebuy) — one list
 * forever instead of a new list per trip. */

interface ItemRow {
  id: string;
  name: string;
  quantity: string | null;
  status: 'needed' | 'bought';
  position: number;
  times_bought: number;
  last_bought_at: string | null;
}

function toItem(r: ItemRow): ShoppingItem {
  return {
    id: r.id,
    name: r.name,
    quantity: r.quantity,
    status: r.status,
    position: r.position,
    timesBought: r.times_bought,
    lastBoughtAt: r.last_bought_at,
  };
}

export async function listShoppingItems(): Promise<ShoppingItem[]> {
  const db = await getDb();
  const rows = (
    await db.query(
      `SELECT * FROM shopping_items
        ORDER BY CASE status WHEN 'needed' THEN 0 ELSE 1 END,
                 position,
                 last_bought_at DESC`,
    )
  ).values as ItemRow[];
  return rows.map(toItem);
}

/** Combine two quantity strings: "300 g" + "200 g" → "500 g"; otherwise join. */
function mergeQuantities(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  const grams = /^(\d+(?:\.\d+)?)\s*g$/i;
  const ma = grams.exec(a.trim());
  const mb = grams.exec(b.trim());
  if (ma?.[1] && mb?.[1]) return `${Math.round((Number(ma[1]) + Number(mb[1])) * 10) / 10} g`;
  return `${a} + ${b}`;
}

/** Add something to buy. If it's already on the needed list (same name,
 * case-insensitive) the quantities merge instead of duplicating the row —
 * this is also what meal-plan generation calls per ingredient. */
export async function addNeededItem(name: string, quantity?: string | null): Promise<void> {
  const db = await getDb();
  const existing = (
    await db.query(
      `SELECT * FROM shopping_items WHERE status = 'needed' AND lower(name) = lower(?) LIMIT 1`,
      [name],
    )
  ).values as ItemRow[];

  if (existing[0]) {
    await db.run('UPDATE shopping_items SET quantity = ? WHERE id = ?', [
      mergeQuantities(existing[0].quantity, quantity ?? null),
      existing[0].id,
    ]);
  } else {
    const positionRes = await db.query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM shopping_items WHERE status = 'needed'`,
    );
    const position = (positionRes.values?.[0]?.next as number) ?? 0;
    await db.run(
      `INSERT INTO shopping_items (id, name, quantity, status, position, times_bought, last_bought_at)
       VALUES (?, ?, ?, 'needed', ?, 0, NULL)`,
      [newId(), name, quantity ?? null, position],
    );
  }
  await persist();
}

/** Check an item off: it moves to history and its purchase count ticks up. */
export async function markBought(id: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE shopping_items
        SET status = 'bought', times_bought = times_bought + 1, last_bought_at = ?
      WHERE id = ?`,
    [new Date().toISOString(), id],
  );
  await persist();
}

/** Put a past purchase back on the list (rebuy). The purchase count is left
 * alone — it only counts completed buys. */
export async function rebuyItem(id: string): Promise<void> {
  const db = await getDb();
  const positionRes = await db.query(
    `SELECT COALESCE(MAX(position), -1) + 1 AS next FROM shopping_items WHERE status = 'needed'`,
  );
  await db.run(`UPDATE shopping_items SET status = 'needed', position = ? WHERE id = ?`, [
    (positionRes.values?.[0]?.next as number) ?? 0,
    id,
  ]);
  await persist();
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM shopping_items WHERE id = ?', [id]);
  await persist();
}
