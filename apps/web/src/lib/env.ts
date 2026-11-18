/** Typed access to Vite env vars. Add new vars here and in .env.example.
 * VITE_* values are baked in at build/dev-server start — restart `npm run dev`
 * after changing .env. */
export const env = {
  /** Arcadia API base URL. Empty = same origin (dev server and nginx both
   * proxy /v1 to the API — no CORS, first-party cookies). The native app
   * overrides this with an absolute URL via VITE_API_URL. */
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? '',
  /** Dev-server only: a one-tap sign-in on the login page for the seeded
   * test account (the API seeds demo@arcadia.dev / demo1234 outside
   * production). `import.meta.env.DEV` is false in every build, so none of
   * this reaches a bundle. Override with VITE_DEV_LOGIN_EMAIL / _PASSWORD. */
  devLogin: import.meta.env.DEV
    ? {
        email: (import.meta.env.VITE_DEV_LOGIN_EMAIL as string | undefined) ?? 'demo@arcadia.dev',
        password: (import.meta.env.VITE_DEV_LOGIN_PASSWORD as string | undefined) ?? 'demo1234',
      }
    : null,
} as const;
