/** Typed access to Vite env vars. Add new vars here and in .env.example. */
export const env = {
  /** Arcadia API base URL (Railway in prod). Optional — app is local-first. */
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? null,
} as const;
