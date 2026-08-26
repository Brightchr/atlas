import { env } from './env';

/** FatSecret Platform API client (https://platform.fatsecret.com).
 *
 * Auth is OAuth2 client-credentials; the bearer token (24 h TTL) is cached
 * and refreshed just before expiry. Search (foods.search) returns only a
 * one-line nutrition summary per food — full serving data lives behind
 * food.get.v4, one call per food. To respect the Basic tier's 5,000
 * calls/day, per-100g macros are parsed straight from the summary whenever
 * it is already per-100g, details calls are capped per search page, and
 * detail results are cached long (food data barely changes).
 *
 * NOTE: FatSecret keys can be IP-restricted in their console — the server's
 * egress IP(s) must be allowed there or every call returns 401. */

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const API_URL = 'https://platform.fatsecret.com/rest/server.api';

export function fatSecretConfigured(): boolean {
  return env.fatSecretClientId.length > 0 && env.fatSecretClientSecret.length > 0;
}

/* --------------------------------- Token --------------------------------- */

let token: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt - 60_000) return token.value;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${env.fatSecretClientId}:${env.fatSecretClientSecret}`,
      ).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=basic',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`FatSecret token request failed (${res.status})`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('FatSecret token response missing access_token');
  token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 86_400) * 1000 };
  return token.value;
}

async function call<T>(params: Record<string, string>): Promise<T> {
  const bearer = await getToken();
  const url = new URL(API_URL);
  for (const [k, v] of Object.entries({ ...params, format: 'json' })) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`FatSecret responded ${res.status}`);
  const data = (await res.json()) as T & { error?: { code: number; message: string } };
  if (data.error) throw new Error(`FatSecret error ${data.error.code}: ${data.error.message}`);
  return data;
}

/* --------------------------------- Search --------------------------------- */

/** Per-100g macros; sparse fields stay undefined. */
export interface FsMacros {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarG?: number;
  fiberG?: number;
  saturatedFatG?: number;
  sodiumG?: number;
}

export interface FsFood {
  foodId: string;
  name: string;
  brand: string | null;
  per100g: FsMacros;
  servingName: string | null;
  servingGrams: number | null;
  imageUrl: string | null;
}

interface FsSearchHit {
  food_id: string;
  food_name: string;
  food_type: string;
  brand_name?: string;
  food_description?: string;
}

/** "Per 100g - Calories: 389kcal | Fat: 6.90g | Carbs: 66.27g | Protein: 16.89g" */
const DESCRIPTION_RE =
  /^Per\s+(.+?)\s+-\s+Calories:\s*([\d.]+)\s*kcal\s*\|\s*Fat:\s*([\d.]+)\s*g\s*\|\s*Carbs:\s*([\d.]+)\s*g\s*\|\s*Protein:\s*([\d.]+)\s*g/i;

/** Per-100g macros straight from the summary line, when its base serving is
 * an explicit gram amount. Null means details are needed. */
function parseDescription(description: string | undefined): FsMacros | null {
  const m = description?.match(DESCRIPTION_RE);
  if (!m) return null;
  const grams = /^([\d.]+)\s*g$/i.exec(m[1]!.trim())?.[1];
  if (!grams || Number(grams) <= 0) return null;
  const scale = 100 / Number(grams);
  const round = (v: string) => Math.round(Number(v) * scale * 100) / 100;
  return {
    kcal: Math.round(Number(m[2]) * scale),
    fatG: round(m[3]!),
    carbsG: round(m[4]!),
    proteinG: round(m[5]!),
  };
}

/* --------------------------------- Details -------------------------------- */

interface FsServing {
  serving_description?: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  is_default?: string;
  calories?: string;
  protein?: string;
  carbohydrate?: string;
  fat?: string;
  sugar?: string;
  fiber?: string;
  saturated_fat?: string;
  sodium?: string; // mg
}

interface FsFoodDetail {
  food?: {
    food_id: string;
    food_name: string;
    brand_name?: string;
    food_images?: { food_image?: { image_url?: string; image_type?: string }[] };
    servings?: { serving?: FsServing | FsServing[] };
  };
}

// Food data is near-static — cache details for a day, bounded.
const DETAIL_TTL_MS = 24 * 60 * 60 * 1000;
const DETAIL_CACHE_MAX = 5_000;
const detailCache = new Map<string, { at: number; food: FsFood | null }>();

const num = (v: string | undefined): number | undefined => {
  const n = Number(v);
  return v !== undefined && Number.isFinite(n) ? n : undefined;
};

/** Full per-100g nutrition for one food via food.get.v4, from the first
 * serving with a gram-based metric amount. Null when nothing is scalable. */
export async function getFoodDetail(foodId: string): Promise<FsFood | null> {
  const cached = detailCache.get(foodId);
  if (cached && Date.now() - cached.at < DETAIL_TTL_MS) return cached.food;

  const data = await call<FsFoodDetail>({ method: 'food.get.v4', food_id: foodId });
  const food = data.food;
  const rawServings = food?.servings?.serving;
  const servings = Array.isArray(rawServings) ? rawServings : rawServings ? [rawServings] : [];
  const gramServings = servings.filter(
    (s) => /^g$/i.test(s.metric_serving_unit ?? '') && Number(s.metric_serving_amount) > 0,
  );
  const base =
    gramServings.find((s) => s.is_default === '1') ??
    gramServings[0] ??
    null;

  let result: FsFood | null = null;
  if (food && base) {
    const grams = Number(base.metric_serving_amount);
    const scale = 100 / grams;
    const per = (v: string | undefined) => {
      const n = num(v);
      return n === undefined ? undefined : Math.round(n * scale * 100) / 100;
    };
    const kcal = num(base.calories);
    if (kcal !== undefined) {
      const sodiumMgPer100 = per(base.sodium);
      result = {
        foodId: food.food_id,
        name: food.food_name,
        brand: food.brand_name ?? null,
        per100g: {
          kcal: Math.round(kcal * scale),
          proteinG: per(base.protein) ?? 0,
          carbsG: per(base.carbohydrate) ?? 0,
          fatG: per(base.fat) ?? 0,
          sugarG: per(base.sugar),
          fiberG: per(base.fiber),
          saturatedFatG: per(base.saturated_fat),
          sodiumG: sodiumMgPer100 === undefined ? undefined : sodiumMgPer100 / 1000,
        },
        servingName: base.serving_description ?? null,
        servingGrams: grams,
        imageUrl: food.food_images?.food_image?.[0]?.image_url ?? null,
      };
    }
  }

  if (detailCache.size >= DETAIL_CACHE_MAX) {
    const oldest = detailCache.keys().next().value;
    if (oldest !== undefined) detailCache.delete(oldest);
  }
  detailCache.set(foodId, { at: Date.now(), food: result });
  return result;
}

/* ------------------------- Premier-tier endpoints ------------------------- */

/** Search-as-you-type suggestions (Premier: foods.autocomplete.v2). */
export async function autocompleteFatSecret(expression: string): Promise<string[]> {
  interface AutocompleteResponse {
    suggestions?: { suggestion?: string | string[] };
  }
  const data = await call<AutocompleteResponse>({
    method: 'foods.autocomplete.v2',
    expression,
    max_results: '8',
  });
  const raw = data.suggestions?.suggestion;
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

/** Barcode → food (Premier: food.find_id_for_barcode + details). FatSecret
 * expects GTIN-13: UPC-A/EAN-8 get zero-padded, GTIN-14 drops its leading
 * packaging digit. food_id "0" means the barcode is unknown to them. */
export async function findFoodByBarcode(barcode: string): Promise<FsFood | null> {
  interface BarcodeResponse {
    food_id?: { value?: string };
  }
  const gtin13 = barcode.replace(/\D/g, '').padStart(13, '0').slice(-13);
  const data = await call<BarcodeResponse>({
    method: 'food.find_id_for_barcode',
    barcode: gtin13,
  });
  const id = data.food_id?.value;
  if (!id || id === '0') return null;
  return getFoodDetail(id);
}

/** How many search hits per page may trigger a details call (hits whose
 * summary line wasn't per-100g). Caps worst-case cost of one search page at
 * 1 + DETAIL_BUDGET calls; the detail cache amortizes repeats to ~zero. */
const DETAIL_BUDGET = 10;

export interface FsSearchPage {
  foods: FsFood[];
  pageCount: number;
}

export async function searchFatSecret(term: string, page: number): Promise<FsSearchPage> {
  interface SearchResponse {
    foods?: {
      food?: FsSearchHit | FsSearchHit[];
      total_results?: string;
      max_results?: string;
    };
  }
  const data = await call<SearchResponse>({
    method: 'foods.search',
    search_expression: term,
    // FatSecret pages are 0-based.
    page_number: String(page - 1),
    max_results: '20',
  });
  const rawHits = data.foods?.food;
  const hits = Array.isArray(rawHits) ? rawHits : rawHits ? [rawHits] : [];
  const total = Number(data.foods?.total_results ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / Number(data.foods?.max_results ?? 20)));

  let detailBudget = DETAIL_BUDGET;
  const foods = await Promise.all(
    hits.map(async (hit): Promise<FsFood | null> => {
      const parsed = parseDescription(hit.food_description);
      if (parsed) {
        return {
          foodId: hit.food_id,
          name: hit.food_name,
          brand: hit.brand_name ?? null,
          per100g: parsed,
          servingName: null,
          servingGrams: null,
          imageUrl: null,
        };
      }
      // Summary wasn't per-gram (e.g. "Per 1 bar") — full details needed.
      const hasCached = detailCache.has(hit.food_id);
      if (!hasCached && detailBudget <= 0) return null;
      if (!hasCached) detailBudget -= 1;
      return getFoodDetail(hit.food_id).catch(() => null);
    }),
  );

  return { foods: foods.filter((f): f is FsFood => f !== null), pageCount };
}
