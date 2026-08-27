// One-time recipe photo fetcher. Downloads a matching food photo for every
// catalog recipe from Pexels (free API, photos licensed for commercial use,
// no attribution required) into public/assets/recipes/ and writes the
// name → path manifest the app reads (src/features/nutrition/recipeImages.json).
//
// Usage:
//   1. Grab a free key at https://www.pexels.com/api/
//   2. PEXELS_API_KEY=your-key node scripts/fetch-recipe-images.mjs
//
// Re-runnable: recipes that already have a photo on disk are skipped, so you
// can delete any bad match and run again. Review the results before shipping.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const catalogPath = path.join(root, 'src/features/nutrition/recipeCatalog.json');
const manifestPath = path.join(root, 'src/features/nutrition/recipeImages.json');
const outDir = path.join(root, 'public/assets/recipes');

const apiKey = process.env.PEXELS_API_KEY;
if (!apiKey) {
  console.error('Set PEXELS_API_KEY (free key: https://www.pexels.com/api/)');
  process.exit(1);
}

const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Marketing-y words that confuse photo search — strip them from the query.
const NOISE =
  /\b(the|comeback|power|machine|builder|bulk|big|meal-?prep|fast-?window|break-?fast|final-?meal|protein|recovery|gainer|-?ish|style)\b/gi;

const query = (name) => {
  const cleaned = name.replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
  return `${cleaned || name} food dish`;
};

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
let manifest = {};
try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch {}
await mkdir(outDir, { recursive: true });

let fetched = 0;
let skipped = 0;
let missed = 0;

for (const recipe of catalog) {
  const file = path.join(outDir, `${slug(recipe.name)}.jpg`);
  const publicPath = `/assets/recipes/${slug(recipe.name)}.jpg`;
  const exists = await access(file).then(() => true, () => false);
  if (exists) {
    manifest[recipe.name] = publicPath;
    skipped++;
    continue;
  }

  const res = await fetch(
    `https://api.pexels.com/v1/search?per_page=1&orientation=landscape&query=${encodeURIComponent(query(recipe.name))}`,
    { headers: { Authorization: apiKey } },
  );
  if (!res.ok) {
    console.error(`${recipe.name}: search failed (${res.status})`);
    missed++;
    continue;
  }
  const data = await res.json();
  const src = data.photos?.[0]?.src?.large; // ~940px wide, plenty for cards
  if (!src) {
    console.warn(`${recipe.name}: no photo found for "${query(recipe.name)}"`);
    missed++;
    continue;
  }

  const img = await fetch(src);
  if (!img.ok) {
    console.error(`${recipe.name}: download failed (${img.status})`);
    missed++;
    continue;
  }
  await writeFile(file, Buffer.from(await img.arrayBuffer()));
  manifest[recipe.name] = publicPath;
  fetched++;
  console.log(`${recipe.name} ← ${data.photos[0].photographer}`);
  // Free tier: 200 requests/hour — stay well under it.
  await new Promise((r) => setTimeout(r, 400));
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nDone: ${fetched} fetched, ${skipped} already on disk, ${missed} missed.`);
console.log('Review public/assets/recipes/, delete bad matches, and re-run to replace them.');
