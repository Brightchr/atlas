import type { Food, Macros } from '@arcadia/shared';

/** Open Food Facts client (https://world.openfoodfacts.org — ODbL license,
 * attribution shown on the Nutrition page). OFF serves permissive CORS, so the
 * browser can call it directly. Results are mapped to snapshot-ready Food
 * shapes; the id is filled in when the user imports one into the local DB. */

const OFF_BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,brands,image_front_small_url,nutriments';

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
}

export type FoodSnapshot = Omit<Food, 'id'>;

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
  return {
    name: p.product_name,
    brand: p.brands?.split(',')[0]?.trim() || null,
    barcode: p.code,
    source: 'off',
    per100g,
    imageUrl: p.image_front_small_url ?? null,
    servingName: null,
    servingGrams: null,
  };
}

/** Full-text product search — returns snapshot-ready foods with images. */
export async function searchOpenFoodFacts(term: string): Promise<FoodSnapshot[]> {
  const url =
    `${OFF_BASE}/cgi/search.pl?action=process&json=1&search_simple=1&page_size=20` +
    `&fields=${FIELDS}&search_terms=${encodeURIComponent(term)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open Food Facts search failed (${res.status})`);
  const data = (await res.json()) as { products?: OffProduct[] };
  return (data.products ?? [])
    .map(toSnapshot)
    .filter((s): s is FoodSnapshot => s !== null);
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
