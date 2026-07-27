import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** Exported so non-component code (e.g. the API client's global 401 handling)
 * can update cached auth state. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Exercise data is effectively static — cache aggressively.
      staleTime: 1000 * 60 * 60,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
