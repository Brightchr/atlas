// Copies the sql.js wasm (needed by jeep-sqlite's browser SQLite) into public/assets,
// where jeep-sqlite expects to fetch it from at runtime. Runs via predev/prebuild.
//
// IMPORTANT: the wasm must come from the exact sql.js version jeep-sqlite was built
// with (its dist bundle inlines the matching JS glue; a mismatched wasm fails with
// "LinkError: import object field ... is not a Function"). sql.js is therefore pinned
// exactly in package.json — when upgrading jeep-sqlite, re-pin sql.js to the version
// in jeep-sqlite's package-lock.json for that release.
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
