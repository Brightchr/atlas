/** Shared query tokenization for user-facing search endpoints: lowercase,
 * punctuation stripped (dunkin' → dunkin), naive plural fold (donuts →
 * donut), filler words dropped — they carry no signal and would veto good
 * matches ("chocolate frosted WITH sprinkles"). */

const SEARCH_STOPWORDS = new Set(['with', 'and', 'the', 'for', 'of', 'on', 'in', 'an', 'a']);

export function foldToken(raw: string): string {
  const bare = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (bare.length < 2 || SEARCH_STOPWORDS.has(bare)) return '';
  return bare.length > 3 && bare.endsWith('s') ? bare.slice(0, -1) : bare;
}

/** Distinct meaningful tokens, capped so a pasted paragraph can't explode a
 * query. Empty result = nothing worth matching. */
export function tokenizeSearch(term: string): string[] {
  return [...new Set(term.split(/\s+/).map(foldToken).filter(Boolean))].slice(0, 6);
}

/** How many tokens must hit: all of a short query, all-but-one of a longer
 * one (real queries carry brand noise the data doesn't). */
export function minTokenHits(tokenCount: number): number {
  return tokenCount <= 2 ? tokenCount : tokenCount - 1;
}
