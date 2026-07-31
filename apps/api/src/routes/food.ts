import { Hono } from 'hono';
import { rateLimit } from '../lib/rate-limit';

/** Server-side proxy for Open Food Facts product search.
 *
 * The browser used to call OFF's legacy /cgi/search.pl directly, but that
 * endpoint now 503s (deprecated). Its replacement, search.openfoodfacts.org
 * (Search-a-licious), does not send CORS headers for third-party origins, so
 * the search has to happen server-side. Barcode lookups still go straight to
 * OFF's v2 API from the browser — that endpoint works and serves CORS.
 *
 * Responses are returned in the legacy `{ products: [...] }` shape the web
 * client already maps, and cached briefly to be polite to OFF. */

const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const FIELDS = 'code,product_name,brands,image_front_small_url,nutriments,serving_size,serving_quantity';
// OFF asks API consumers to identify themselves: app name + contact.
const USER_AGENT = 'ArcadiaAtlas/1.0 (https://github.com/Brightchr/atlas)';

interface SearchHit {
  code: string;
  product_name?: string;
  brands?: string[] | string;
  image_front_small_url?: string;
  nutriments?: Record<string, number>;
}

/** Legacy-shaped product: `brands` as a comma-separated string. */
interface Product extends Omit<SearchHit, 'brands'> {
  brands?: string;
}

/** Deep pages die in OFF's Elasticsearch result window anyway; 50 pages of 20
 * is far past where anyone browses, so both the page param and the reported
 * page count are clamped to it. */
const MAX_PAGES = 50;

interface SearchResult {
  products: Product[];
  page: number;
  pageCount: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; result: SearchResult }>();

async function searchOff(term: string, page: number): Promise<SearchResult> {
  const key = `${page}:${term}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;

  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', term);
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', '20');
  url.searchParams.set('fields', FIELDS);

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Open Food Facts responded ${res.status}`);
  const data = (await res.json()) as { hits?: SearchHit[]; page?: number; page_count?: number };

  const result: SearchResult = {
    products: (data.hits ?? []).map(
      (h): Product => ({
        ...h,
        brands: Array.isArray(h.brands) ? h.brands.join(',') : h.brands,
      }),
    ),
    page,
    pageCount: Math.min(data.page_count ?? 1, MAX_PAGES),
  };

  // Oldest-entry eviction keeps the cache bounded without LRU bookkeeping.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), result });
  return result;
}

export const foodRoutes = new Hono();

// The search box fires a query per keystroke (per-term cached client-side),
// so the ceiling is sized for typing bursts, not one request per search.
foodRoutes.get('/search', rateLimit({ windowMs: 60_000, max: 60 }), async (c) => {
  const term = (c.req.query('q') ?? '').trim();
  if (term.length < 2) return c.json({ products: [], page: 1, pageCount: 1 });
  const page = Math.min(Math.max(Number.parseInt(c.req.query('page') ?? '1', 10) || 1, 1), MAX_PAGES);
  try {
    return c.json(await searchOff(term, page));
  } catch {
    return c.json({ error: 'Food database unreachable' }, 502);
  }
});
