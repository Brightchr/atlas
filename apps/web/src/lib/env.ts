/** Typed access to Vite env vars. Add new vars here and in .env.example.
 * VITE_* values are baked in at build/dev-server start — restart `npm run dev`
 * after changing .env. */
export const env = {
  /** Arcadia API base URL. Empty = same origin (dev server and nginx both
   * proxy /v1 to the API — no CORS, first-party cookies). The native app
   * overrides this with an absolute URL via VITE_API_URL. */
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? '',
} as const;
