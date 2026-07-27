import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
