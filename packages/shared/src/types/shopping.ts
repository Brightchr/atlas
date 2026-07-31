/** An entry on the single living shopping list. 'needed' items are the active
 * list; 'bought' items remain as purchase history and can be re-added (rebuy)
 * instead of building a new list every trip. */
export interface ShoppingItem {
  id: string;
  name: string;
  /** Free-form quantity, e.g. "600 g", "2 cans" */
  quantity: string | null;
  status: 'needed' | 'bought';
  position: number;
  timesBought: number;
  lastBoughtAt: string | null;
}

export interface ShoppingList {
  id: string;
  name: string;
  /** Set when generated from a diet plan; null for ad-hoc lists */
  dietPlanId: string | null;
  createdAt: string;
  items: ShoppingListItem[];
}

export interface ShoppingListItem {
  id: string;
  listId: string;
  name: string;
  /** Free-form quantity, e.g. "600 g", "2 cans" */
  quantity: string | null;
  checked: boolean;
  position: number;
}
