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

/** Word-level hit: prefix either way, so "milkshake" claims "milk"/"shake"
 * and "chocolate" claims "chocolat". The reverse direction needs 4+ chars so
 * short fragments can't fake matches. */
function tokenHit(target: string, queryWord: string): boolean {
  return (
    target.startsWith(queryWord) || (target.length >= 4 && queryWord.startsWith(target))
  );
}

/** Phrase tiers (lower is better): exact name · name prefix · name contains
 * the phrase · everything else, which competes on SCORE — the fraction of
 * meaningful query words found in the name or brand. A stray word the data
 * doesn't carry ("fairlife" on a product filed as Core Power) costs a
 * fraction instead of vetoing the match outright. */
function rank(
  name: string,
  nameAndBrand: string,
  query: string,
  queryTokens: string[],
): { tier: number; score: number } {
  if (name === query) return { tier: 0, score: 1 };
  if (name.startsWith(query)) return { tier: 1, score: 1 };
  if (name.includes(query)) return { tier: 2, score: 1 };
  if (queryTokens.length === 0) return { tier: 3, score: 0 };
  const targetTokens = nameAndBrand.split(' ').map(fold);
  const hits = queryTokens.filter((q) => targetTokens.some((n) => tokenHit(n, q))).length;
  return { tier: 3, score: hits / queryTokens.length };
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
      ...rank(
        normalize(item.name),
        normalize(`${item.name} ${item.brand ?? ''}`),
        query,
        queryTokens,
      ),
    }))
    .sort((a, b) => a.tier - b.tier || b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
