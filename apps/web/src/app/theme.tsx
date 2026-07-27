import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export const THEMES = [
  { id: 'aurora', label: 'Aurora', mode: 'light', swatch: ['#f4f5fb', '#4f46e5'] },
  { id: 'mint', label: 'Mint', mode: 'light', swatch: ['#f2f7f4', '#0d9488'] },
  { id: 'midnight', label: 'Midnight', mode: 'dark', swatch: ['#0b0d17', '#818cf8'] },
  { id: 'carbon', label: 'Carbon', mode: 'dark', swatch: ['#0a0a0c', '#a3e635'] },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

const STORAGE_KEY = 'arcadia-theme';
const DEFAULT_THEME: ThemeId = 'aurora';

function readStoredTheme(): ThemeId {
  const stored = localStorage.getItem(STORAGE_KEY);
  return THEMES.some((t) => t.id === stored) ? (stored as ThemeId) : DEFAULT_THEME;
}

/** Applies the theme to <html> and keeps the Android status bar color in sync. */
function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

const ThemeContext = createContext<{ theme: ThemeId; setTheme: (id: ThemeId) => void }>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => {
    localStorage.setItem(STORAGE_KEY, id);
    setThemeState(id);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
