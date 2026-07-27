// Copies the sql.js wasm (needed by jeep-sqlite's browser SQLite) into
// public/assets/sqljs/<version>/ — a VERSIONED path, so browsers can cache it
// forever yet can never serve a stale copy after an upgrade. Runs via predev/prebuild.
//
// IMPORTANT: the wasm must come from the exact sql.js version pinned in this
// package's devDependencies — jeep-sqlite's bundle inlines the matching JS glue,
// and a mismatched wasm fails at runtime with the cryptic
// "LinkError: import object field ... is not a Function".
// This script VERIFIES the version and fails the build loudly on mismatch. When
// upgrading jeep-sqlite, re-pin sql.js to the version in jeep-sqlite's
// package-lock.json for that release.
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pinned = JSON.parse(readFileSync(join(webRoot, 'package.json'), 'utf8')).devDependencies?.[
  'sql.js'
];
if (!pinned || /[\^~]/.test(pinned)) {
  console.error(`sql.js must be pinned exactly in apps/web devDependencies (found: ${pinned})`);
  process.exit(1);
}

// The pinned copy may live nested under this workspace or hoisted to the repo root.
const candidates = [
  join(webRoot, 'node_modules', 'sql.js'),
  join(webRoot, '..', '..', 'node_modules', 'sql.js'),
];
const source = candidates.find((dir) => {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version === pinned;
  } catch {
    return false;
  }
});
if (!source) {
  console.error(
    `No sql.js@${pinned} found in ${candidates.join(' or ')} — ` +
      'the installed version does not match the pin; refusing to ship a mismatched wasm.',
  );
  process.exit(1);
}

// Clean out old versions (and the legacy unversioned file) so only the current
// wasm ships.
rmSync(join(webRoot, 'public', 'assets', 'sqljs'), { recursive: true, force: true });
rmSync(join(webRoot, 'public', 'assets', 'sql-wasm.wasm'), { force: true });

const dest = join(webRoot, 'public', 'assets', 'sqljs', pinned, 'sql-wasm.wasm');
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(join(source, 'dist', 'sql-wasm.wasm'), dest);
console.log(`Copied sql-wasm.wasm (sql.js@${pinned}) to public/assets/sqljs/${pinned}/`);
