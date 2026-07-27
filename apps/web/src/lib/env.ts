/** Typed access to Vite env vars. Add new vars here and in .env.example.
 * VITE_* values are baked in at build/dev-server start — restart `npm run dev`
 * after changing .env. */
export const env = {
  /** Arcadia API base URL (Railway in prod, local dev server otherwise). */
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000',
  /** wger instance serving exercise data. Defaults to the public wger.de;
   * point it at a self-hosted instance (npm run wger:up) via .env. */
  wgerUrl: (import.meta.env.VITE_WGER_URL as string | undefined) ?? 'https://wger.de',
} as const;
