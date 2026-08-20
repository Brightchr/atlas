import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export const THEMES = [
  { id: 'indigo-night', label: 'Indigo Night', mode: 'dark', swatch: ['#14151d', '#818cf8'] },
  { id: 'tide', label: 'Tide', mode: 'dark', swatch: ['#0d1417', '#2dd4bf'] },
  { id: 'glacier', label: 'Glacier', mode: 'light', swatch: ['#f4f6fa', '#2563eb'] },
  { id: 'meadow', label: 'Meadow', mode: 'light', swatch: ['#f9f9f4', '#047857'] },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

const STORAGE_KEY = 'arcadia-theme';
const DEFAULT_THEME: ThemeId = 'indigo-night';

/** The 2026 redesign renamed every theme; carry old choices to their nearest
 * new home instead of silently resetting to the default. */
const LEGACY_THEMES: Record<string, ThemeId> = {
  aurora: 'glacier',
  mint: 'meadow',
  midnight: 'indigo-night',
  carbon: 'tide',
};

function readStoredTheme(): ThemeId {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && LEGACY_THEMES[stored]) return LEGACY_THEMES[stored];
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
