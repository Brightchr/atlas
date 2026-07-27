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
