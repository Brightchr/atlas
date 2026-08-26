import { Hono } from 'hono';
import { env } from '../lib/env';
import {
  autocompleteFatSecret,
  fatSecretConfigured,
  findFoodByBarcode,
  searchFatSecret,
  type FsFood,
} from '../lib/fatsecret';
import { rateLimit } from '../lib/rate-limit';
import { requireActiveMember, requireAuth, type AppEnv } from '../middleware/auth';

/** Server-side food search, merged per page from up to three sources:
 *
 * - FatSecret Platform — the primary when credentials are configured:
 *   curated US branded + restaurant foods with images and clean servings.
 * - USDA FoodData Central — the backup (and the primary without FatSecret):
 *   public-domain curated data (FNDDS survey foods, SR Legacy, Branded).
 * - Open Food Facts — community barcode data; last-resort filler only.
 *   Proxied server-side because its search service doesn't serve CORS for
 *   third-party origins (and the legacy endpoint 503s).
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
  source: 'usda' | 'off' | 'fatsecret';
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
  // US-market filter: OFF's international community data is where the noisy
  // entries and stray photos come from; the app's audience is US-first.
  url.searchParams.set('q', `${term} countries_tags:"en:united-states"`);
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

/* ------------------------------- FatSecret -------------------------------- */

function fsToProduct(f: FsFood): Product {
  return {
    code: `fs-${f.foodId}`,
    product_name: f.name,
    brands: f.brand ?? undefined,
    image_front_small_url: f.imageUrl ?? undefined,
    nutriments: {
      'energy-kcal_100g': f.per100g.kcal,
      proteins_100g: f.per100g.proteinG,
      carbohydrates_100g: f.per100g.carbsG,
      fat_100g: f.per100g.fatG,
      ...(f.per100g.sugarG !== undefined && { sugars_100g: f.per100g.sugarG }),
      ...(f.per100g.fiberG !== undefined && { fiber_100g: f.per100g.fiberG }),
      ...(f.per100g.saturatedFatG !== undefined && {
        'saturated-fat_100g': f.per100g.saturatedFatG,
      }),
      ...(f.per100g.sodiumG !== undefined && { sodium_100g: f.per100g.sodiumG }),
    },
    ...(f.servingGrams && {
      serving_quantity: f.servingGrams,
      serving_size: f.servingName ?? `${f.servingGrams} g`,
    }),
    source: 'fatsecret',
  };
}

async function searchFs(term: string, page: number): Promise<SourcePage> {
  const result = await searchFatSecret(term, page);
  return {
    products: result.foods.map(fsToProduct),
    pageCount: Math.min(result.pageCount, MAX_PAGES),
  };
}

/* --------------------------------- Merge --------------------------------- */

const EMPTY_PAGE: SourcePage = { products: [], pageCount: 1 };

function settle(name: string, r: PromiseSettledResult<SourcePage>): SourcePage {
  if (r.status === 'rejected') {
    console.warn(`${name} search failed:`, String(r.reason));
    return EMPTY_PAGE;
  }
  return r.value;
}

/** Sources queried concurrently, merged primary-first. The backup fills gaps
 * (capped when the primary delivered a real page) and takes over fully when
 * the primary failed or came back thin. */
async function searchFood(term: string, page: number): Promise<SearchResult> {
  const key = `${page}:${term}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.result;

  // Without FatSecret: USDA primary, OFF backup (the original pairing).
  // With FatSecret: FatSecret primary, USDA backup — OFF joins only when the
  // curated pair produced almost nothing.
  const useFs = fatSecretConfigured();
  const [primaryResult, backupResult] = await Promise.allSettled([
    useFs ? searchFs(term, page) : searchFdc(term, page),
    useFs ? searchFdc(term, page) : searchOff(term, page),
  ]);
  const primary = settle(useFs ? 'FatSecret' : 'FDC', primaryResult);
  const backup = settle(useFs ? 'FDC' : 'OFF', backupResult);

  const backupCap = primary.products.length >= 8 ? 6 : 20;
  const seen = new Set<string>();
  let products = [...primary.products, ...backup.products.slice(0, backupCap)].filter((p) => {
    if (seen.has(p.code)) return false;
    seen.add(p.code);
    return true;
  });

  // Last resort in FatSecret mode: both curated sources came back nearly
  // empty — let community data have a go rather than showing nothing.
  if (useFs && products.length < 3) {
    const off = await searchOff(term, page).catch(() => EMPTY_PAGE);
    products = [...products, ...off.products.filter((p) => !seen.has(p.code))];
  }

  const result: SearchResult = {
    products,
    page,
    pageCount: Math.min(Math.max(primary.pageCount, backup.pageCount), MAX_PAGES),
  };

  // Oldest-entry eviction keeps the cache bounded without LRU bookkeeping.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), result });
  return result;
}

// A missing key silently degrades search quality — the exact failure users
// report as "the food database is bad". Make misconfiguration loud.
if (env.fdcApiKey === 'DEMO_KEY') {
  console.warn(
    'FDC_API_KEY is not set — USDA food search runs on DEMO_KEY (~50 requests/day, exhausts in minutes). ' +
      'Get a free key at https://fdc.nal.usda.gov/api-key-signup.html and set FDC_API_KEY.',
  );
}
if (!fatSecretConfigured()) {
  console.warn(
    'FATSECRET_CLIENT_ID / FATSECRET_CLIENT_SECRET are not set — food search runs on USDA + ' +
      'Open Food Facts. Set both to make FatSecret the primary source.',
  );
}

export const foodRoutes = new Hono<AppEnv>();

// Signed-in only: this endpoint spends PAID upstream quota (FatSecret, FDC)
// — an open proxy would let anyone on the internet burn it dry.
foodRoutes.use('*', requireAuth);
foodRoutes.use('*', requireActiveMember);

// The search box fires a query per keystroke (per-term cached client-side),
// so the ceiling is sized for typing bursts, not one request per search.
foodRoutes.get('/search', rateLimit({ windowMs: 60_000, max: 60, by: 'user' }), async (c) => {
  const term = (c.req.query('q') ?? '').trim();
  if (term.length < 2) return c.json({ products: [], page: 1, pageCount: 1 });
  const page = Math.min(Math.max(Number.parseInt(c.req.query('page') ?? '1', 10) || 1, 1), MAX_PAGES);
  try {
    return c.json(await searchFood(term, page));
  } catch {
    return c.json({ error: 'Food database unreachable' }, 502);
  }
});

// Suggestions are decorative — on any failure (no FatSecret, upstream error)
// the box simply shows none, never an error.
foodRoutes.get('/autocomplete', rateLimit({ windowMs: 60_000, max: 120, by: 'user' }), async (c) => {
  const term = (c.req.query('q') ?? '').trim();
  if (term.length < 2 || !fatSecretConfigured()) return c.json({ suggestions: [] });
  try {
    return c.json({ suggestions: await autocompleteFatSecret(term) });
  } catch {
    return c.json({ suggestions: [] });
  }
});

/** Barcode → product, FatSecret's curated data. The client falls back to
 * Open Food Facts (called directly, browser-side) when this returns null. */
foodRoutes.get('/barcode', rateLimit({ windowMs: 60_000, max: 30, by: 'user' }), async (c) => {
  const code = (c.req.query('code') ?? '').replace(/\D/g, '');
  if (code.length < 8 || code.length > 14) return c.json({ error: 'Invalid barcode' }, 400);
  if (!fatSecretConfigured()) return c.json({ product: null });
  const food = await findFoodByBarcode(code).catch(() => null);
  if (!food) return c.json({ product: null });
  // The scanned code replaces the synthetic fs-<id>: the client dedupes and
  // re-finds saved foods by their real barcode.
  return c.json({ product: { ...fsToProduct(food), code } });
});
