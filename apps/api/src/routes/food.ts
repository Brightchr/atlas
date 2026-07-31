import { Hono } from 'hono';
import { env } from '../lib/env';
import { rateLimit } from '../lib/rate-limit';

/** Server-side food search across two sources, merged per page:
 *
 * - USDA FoodData Central — curated data (FNDDS survey foods, SR Legacy fast
 *   foods, branded groceries). Listed first: the numbers are trustworthy.
 * - Open Food Facts — community barcode data, broad international coverage
 *   but noisy. Proxied server-side because its search service doesn't serve
 *   CORS for third-party origins (and the legacy endpoint 503s).
 *
 * Responses use the legacy OFF `{ products: [...] }` shape the web client
 * maps, each product tagged with its `source`. Cached briefly per term+page. */

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
  serving_size?: string;
  serving_quantity?: number | string;
}

/** Legacy-shaped product: `brands` as a comma-separated string. */
interface Product extends Omit<SearchHit, 'brands'> {
  brands?: string;
  source: 'usda' | 'off';
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

interface SourcePage {
  products: Product[];
  pageCount: number;
}

async function searchOff(term: string, page: number): Promise<SourcePage> {
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
  const data = (await res.json()) as { hits?: SearchHit[]; page_count?: number };

  return {
    products: (data.hits ?? []).map(
      (h): Product => ({
        ...h,
        brands: Array.isArray(h.brands) ? h.brands.join(',') : h.brands,
        source: 'off',
      }),
    ),
    pageCount: Math.min(data.page_count ?? 1, MAX_PAGES),
  };
}

/* ------------------------- USDA FoodData Central ------------------------- */

const FDC_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
/** FNDDS = curated survey foods (incl. generic fast food), SR Legacy = the
 * classic USDA table (incl. chain items), Branded = packaged groceries. */
const FDC_DATA_TYPES = 'Survey (FNDDS),SR Legacy,Branded';

interface FdcNutrient {
  nutrientNumber?: string | number;
  value?: number;
}

interface FdcFood {
  fdcId: number;
  description?: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: FdcNutrient[];
}

/** Branded descriptions arrive ALL CAPS; make them readable. */
function titleCaseIfShouty(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

function fdcToProduct(f: FdcFood): Product | null {
  if (!f.description) return null;
  // Search results report nutrients per 100 g, keyed by legacy USDA numbers.
  const byNumber = new Map(
    (f.foodNutrients ?? []).map((n) => [String(n.nutrientNumber), n.value]),
  );
  const kcal = byNumber.get('208');
  if (kcal === undefined) return null;
  const sodiumMg = byNumber.get('307');

  const servingIsGrams = /^(g|grm)$/i.test(f.servingSizeUnit ?? '');
  return {
    code: f.gtinUpc?.trim() || `fdc-${f.fdcId}`,
    product_name: titleCaseIfShouty(f.description),
    brands: f.brandName || f.brandOwner || (f.dataType === 'Branded' ? undefined : 'USDA'),
    nutriments: {
      'energy-kcal_100g': kcal,
      proteins_100g: byNumber.get('203') ?? 0,
      carbohydrates_100g: byNumber.get('205') ?? 0,
      fat_100g: byNumber.get('204') ?? 0,
      ...(byNumber.get('269') !== undefined && { sugars_100g: byNumber.get('269')! }),
      ...(byNumber.get('291') !== undefined && { fiber_100g: byNumber.get('291')! }),
      ...(byNumber.get('606') !== undefined && { 'saturated-fat_100g': byNumber.get('606')! }),
      ...(sodiumMg !== undefined && { sodium_100g: sodiumMg / 1000 }),
    },
    ...(servingIsGrams &&
      f.servingSize && {
        serving_quantity: f.servingSize,
        serving_size: f.householdServingFullText || `${f.servingSize} g`,
      }),
    source: 'usda',
  };
}

async function searchFdc(term: string, page: number): Promise<SourcePage> {
  const url = new URL(FDC_URL);
  url.searchParams.set('api_key', env.fdcApiKey);
  url.searchParams.set('query', term);
  url.searchParams.set('pageSize', '20');
  url.searchParams.set('pageNumber', String(page));
  url.searchParams.set('dataType', FDC_DATA_TYPES);

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`FoodData Central responded ${res.status}`);
  const data = (await res.json()) as { foods?: FdcFood[]; totalPages?: number };

  return {
    products: (data.foods ?? [])
      .map(fdcToProduct)
      .filter((p): p is Product => p !== null),
    pageCount: Math.min(data.totalPages ?? 1, MAX_PAGES),
  };
}

/* --------------------------------- Merge --------------------------------- */

/** Query both sources concurrently; either failing alone is fine. USDA rows
 * lead (curated data beats community data on ties). */
async function searchFood(term: string, page: number): Promise<SearchResult> {
  const key = `${page}:${term}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;

  const [fdc, off] = await Promise.allSettled([searchFdc(term, page), searchOff(term, page)]);
  if (fdc.status === 'rejected') console.warn('FDC search failed:', String(fdc.reason));
  if (off.status === 'rejected') console.warn('OFF search failed:', String(off.reason));
  if (fdc.status === 'rejected' && off.status === 'rejected') {
    throw new Error('All food sources unavailable');
  }
  const fdcPage = fdc.status === 'fulfilled' ? fdc.value : { products: [], pageCount: 1 };
  const offPage = off.status === 'fulfilled' ? off.value : { products: [], pageCount: 1 };

  const seen = new Set<string>();
  const products = [...fdcPage.products, ...offPage.products].filter((p) => {
    if (seen.has(p.code)) return false;
    seen.add(p.code);
    return true;
  });

  const result: SearchResult = {
    products,
    page,
    pageCount: Math.min(Math.max(fdcPage.pageCount, offPage.pageCount), MAX_PAGES),
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
    return c.json(await searchFood(term, page));
  } catch {
    return c.json({ error: 'Food database unreachable' }, 502);
  }
});
