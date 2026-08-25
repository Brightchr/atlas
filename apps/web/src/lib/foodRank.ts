/** Relevance ordering for food search results. Sources return results ranked
 * by their own text relevance — alphabetical re-sorting destroys that
 * ("Cinnamon Biscuit Munchin" beating "Dunkin Donuts" for the query "dunkin
 * donuts"). This ranks name matches first and otherwise preserves the
 * incoming order. */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lower is better: exact name · name prefix · name contains the phrase ·
 * every query word appears somewhere in the name (word-prefix match, so
 * "strawberry oatmeal" claims "Strawberries & Cream Instant Oatmeal") ·
 * everything else. */
function tier(name: string, query: string, queryTokens: string[]): number {
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (queryTokens.length > 1) {
    const nameTokens = name.split(' ');
    const allWordsHit = queryTokens.every((q) => nameTokens.some((n) => n.startsWith(q)));
    if (allWordsHit) return 3;
  }
  return 4;
}

export function rankFoodsByRelevance<T extends { name: string }>(items: T[], term: string): T[] {
  const query = normalize(term);
  if (!query) return items;
  const queryTokens = query.split(' ');
  return items
    .map((item, index) => ({ item, index, tier: tier(normalize(item.name), query, queryTokens) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map((entry) => entry.item);
}
