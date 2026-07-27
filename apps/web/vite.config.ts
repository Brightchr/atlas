import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The exact sql.js version pinned in devDependencies — the wasm lives under a
// versioned URL so browser caches can never serve a stale copy after upgrades.
const sqlJsVersion = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
).devDependencies['sql.js'] as string;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __SQL_JS_VERSION__: JSON.stringify(sqlJsVersion),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // jeep-sqlite is a Stencil web component; pre-bundling duplicates its runtime
    // and the component never hydrates in dev. Serve it as native ESM instead.
    exclude: ['jeep-sqlite'],
  },
  server: {
    port: 5173,
  },
});
