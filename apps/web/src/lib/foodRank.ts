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

/** Filler words would veto good matches ("chocolate frosted WITH sprinkles"). */
const STOPWORDS = new Set(['with', 'and', 'the', 'for', 'of', 'on', 'in', 'an', 'a']);

/** Naive plural fold so "donuts" claims "Donut". */
function fold(token: string): string {
  return token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token;
}

/** Lower is better: exact name · name prefix · name contains the phrase ·
 * every meaningful query word appears in the name OR BRAND (word-prefix
 * match, plural-folded — "dunkin donuts sprinkles" claims a brandless
 * "…Sprinkles Donut" under brand Dunkin') · everything else. */
function tier(name: string, nameAndBrand: string, query: string, queryTokens: string[]): number {
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (queryTokens.length > 1) {
    const targetTokens = nameAndBrand.split(' ').map(fold);
    const allWordsHit = queryTokens.every((q) => targetTokens.some((n) => n.startsWith(q)));
    if (allWordsHit) return 3;
  }
  return 4;
}

export function rankFoodsByRelevance<T extends { name: string; brand?: string | null }>(
  items: T[],
  term: string,
): T[] {
  const query = normalize(term);
  if (!query) return items;
  const queryTokens = query
    .split(' ')
    .filter((t) => !STOPWORDS.has(t))
    .map(fold);
  return items
    .map((item, index) => ({
      item,
      index,
      tier: tier(
        normalize(item.name),
        normalize(`${item.name} ${item.brand ?? ''}`),
        query,
        queryTokens,
      ),
    }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .map((entry) => entry.item);
}
