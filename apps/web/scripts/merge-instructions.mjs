// One-off: merge authored instruction batches (scratchpad JSON maps of
// name → steps) into recipeCatalog.json. Usage:
//   node scripts/merge-instructions.mjs <batch1.json> [batch2.json ...]
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(new URL('.', import.meta.url)));
const catalogPath = path.join(root, 'src/features/nutrition/recipeCatalog.json');

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const merged = {};
for (const file of process.argv.slice(2)) {
  Object.assign(merged, JSON.parse(await readFile(file, 'utf8')));
}

let updated = 0;
const missing = [];
for (const recipe of catalog) {
  const next = merged[recipe.name];
  if (typeof next === 'string' && next.trim()) {
    recipe.instructions = next.trim();
    updated++;
  } else {
    missing.push(recipe.name);
  }
}

await writeFile(catalogPath, JSON.stringify(catalog) + '\n');
console.log(`updated ${updated} of ${catalog.length}`);
if (missing.length) console.log('missing:', missing.join(' | '));
