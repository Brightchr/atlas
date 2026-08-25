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
    // 5174: this machine's WSL relay tends to squat on 5173. PORT lets a
    // second checkout (git worktree) run its own dev server alongside.
    port: Number(process.env.PORT ?? 5174),
    // Same-origin API in dev: the browser calls /v1/* on this server, which
    // forwards to the API. 127.0.0.1 (not localhost) dodges IPv6 resolution
    // quirks where another process squats on ::1.
    proxy: {
      '/v1': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
      '/health': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
    },
  },
});
