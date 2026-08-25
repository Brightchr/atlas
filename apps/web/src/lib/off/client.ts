import type { Food, Macros } from '@arcadia/shared';
import { env } from '@/lib/env';

/** Open Food Facts client (https://world.openfoodfacts.org — ODbL license,
 * attribution shown on the Nutrition page). Text search goes through our API
 * (/v1/food/search): OFF's legacy browser-callable search endpoint now 503s
 * and its replacement doesn't serve CORS for third-party origins. Barcode
 * lookups still hit OFF directly — that endpoint works and serves CORS.
 * Results are mapped to snapshot-ready Food shapes; the id is filled in when
 * the user imports one into the local DB. */

const OFF_BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,brands,image_front_small_url,nutriments,serving_size,serving_quantity';

interface OffNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  sugars_100g?: number;
  fat_100g?: number;
  'saturated-fat_100g'?: number;
  fiber_100g?: number;
  sodium_100g?: number;
}

interface OffProduct {
  code: string;
  product_name?: string;
  brands?: string;
  image_front_small_url?: string;
  nutriments?: OffNutriments;
  serving_size?: string;
  serving_quantity?: number | string;
  /** Set by our API's merged search: 'fatsecret' and 'usda' rows come from
   * those curated sources; everything else is Open Food Facts. */
  source?: 'usda' | 'off' | 'fatsecret';
}

export type FoodSnapshot = Omit<Food, 'id'>;

/** OFF is community-entered, and some products carry impossible numbers
 * (38,000 kcal per 100 g). Per 100 g, no macro can exceed 100 g and calories
 * top out around pure fat (~900). Implausible products are dropped. */
function plausiblePer100g(m: Macros): boolean {
  const grams = [m.proteinG, m.carbsG, m.fatG, m.sugarG, m.fiberG, m.saturatedFatG];
  return (
    m.kcal >= 0 &&
    m.kcal <= 950 &&
    grams.every((v) => v === undefined || (v >= 0 && v <= 100)) &&
    (m.sodiumG === undefined || (m.sodiumG >= 0 && m.sodiumG <= 40))
  );
}

function toServingGrams(quantity: number | string | undefined): number | null {
  const n = Number(quantity);
  return Number.isFinite(n) && n >= 1 && n <= 2000 ? n : null;
}

function toSnapshot(p: OffProduct): FoodSnapshot | null {
  const n = p.nutriments;
  const kcal = n?.['energy-kcal_100g'];
  if (!p.product_name || kcal === undefined) return null;
  const per100g: Macros = {
    kcal,
    proteinG: n?.proteins_100g ?? 0,
    carbsG: n?.carbohydrates_100g ?? 0,
    fatG: n?.fat_100g ?? 0,
    sugarG: n?.sugars_100g,
    fiberG: n?.fiber_100g,
    saturatedFatG: n?.['saturated-fat_100g'],
    sodiumG: n?.sodium_100g,
  };
  if (!plausiblePer100g(per100g)) return null;
  return {
    name: p.product_name,
    brand: p.brands?.split(',')[0]?.trim() || null,
    barcode: p.code,
    source: p.source ?? 'off',
    per100g,
    imageUrl: p.image_front_small_url ?? null,
    servingName: p.serving_size ?? null,
    servingGrams: toServingGrams(p.serving_quantity),
  };
}

export interface FoodSearchPage {
  foods: FoodSnapshot[];
  page: number;
  pageCount: number;
}

/** Full-text product search — returns snapshot-ready foods with images,
 * paginated (20 per page, page count capped by the API). */
export async function searchOpenFoodFacts(term: string, page = 1): Promise<FoodSearchPage> {
  const url = `${env.apiUrl}/v1/food/search?q=${encodeURIComponent(term)}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Food Facts search failed (${res.status})`);
  const data = (await res.json()) as {
    products?: OffProduct[];
    page?: number;
    pageCount?: number;
  };
  return {
    foods: (data.products ?? []).map(toSnapshot).filter((s): s is FoodSnapshot => s !== null),
    page: data.page ?? page,
    pageCount: data.pageCount ?? 1,
  };
}

/** Serving details for one product. The search index doesn't carry serving
 * fields, so the UI fetches this lazily (per expanded result) from OFF's v2
 * product API, which does — and serves CORS. */
export async function fetchServing(
  code: string,
): Promise<{ name: string | null; grams: number | null }> {
  const res = await fetch(
    `${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=serving_size,serving_quantity`,
  );
  if (!res.ok) return { name: null, grams: null };
  const data = (await res.json()) as {
    product?: { serving_size?: string; serving_quantity?: number | string };
  };
  return {
    name: data.product?.serving_size ?? null,
    grams: toServingGrams(data.product?.serving_quantity),
  };
}

/** Barcode lookup — the flow the Android scanner will use. */
export async function lookupBarcode(code: string): Promise<FoodSnapshot | null> {
  const res = await fetch(`${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts lookup failed (${res.status})`);
  const data = (await res.json()) as { status: number; product?: OffProduct };
  if (data.status !== 1 || !data.product) return null;
  return toSnapshot(data.product);
}
