/** Relevance ordering for food search results. Open Food Facts returns
 * results ranked by its own text relevance — alphabetical re-sorting destroys
 * that ("Cinnamon Biscuit Munchin" beating "Dunkin Donuts" for the query
 * "dunkin donuts"). This ranks name matches first and otherwise preserves the
 * incoming order. */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lower is better: exact name, name prefix, name contains, everything else. */
function tier(name: string, query: string): number {
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  return 3;
}

export function rankFoodsByRelevance<T extends { name: string }>(items: T[], term: string): T[] {
  const query = normalize(term);
  if (!query) return items;
  return items
    .map((item, index) => ({ item, index, tier: tier(normalize(item.name), query) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map((entry) => entry.item);
}
