// Copies the sql.js wasm (needed by jeep-sqlite's browser SQLite) into public/assets,
// where jeep-sqlite expects to fetch it from at runtime. Runs via predev/prebuild.
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const src = require.resolve('sql.js/dist/sql-wasm.wasm');
const dest = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'sql-wasm.wasm');

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log('Copied sql-wasm.wasm to public/assets/');
