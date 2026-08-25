/** The dashboard's rearrangeable cards, in default order. The promo banner
 * and the greeting header are deliberately NOT here — the hero slot is ours
 * (promotions/announcements), everything else is the user's to arrange. */
export const DASHBOARD_CARDS = [
  'today',
  'week',
  'pulse',
  'glance',
  'progress',
  'logfood',
  'planned',
  'suggested',
  'actions',
] as const;

export type DashboardCardId = (typeof DASHBOARD_CARDS)[number];

const KEY = 'arcadia-dashboard-order';

/** Saved order, reconciled against the current card set: unknown ids drop
 * out, cards shipped since the save append in their default slot. */
export function loadCardOrder(): DashboardCardId[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    const known = (Array.isArray(saved) ? saved : []).filter((id): id is DashboardCardId =>
      (DASHBOARD_CARDS as readonly string[]).includes(String(id)),
    );
    const missing = DASHBOARD_CARDS.filter((id) => !known.includes(id));
    return [...known, ...missing];
  } catch {
    return [...DASHBOARD_CARDS];
  }
}

export function saveCardOrder(order: DashboardCardId[]): void {
  localStorage.setItem(KEY, JSON.stringify(order));
}

export function resetCardOrder(): void {
  localStorage.removeItem(KEY);
}

export function isDefaultOrder(order: DashboardCardId[]): boolean {
  return order.length === DASHBOARD_CARDS.length && order.every((id, i) => DASHBOARD_CARDS[i] === id);
}
