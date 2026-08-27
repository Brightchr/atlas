import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export const THEMES = [
  { id: 'volt', label: 'Volt', mode: 'dark', swatch: ['#08090f', '#22d3ee'] },
  { id: 'circuit', label: 'Circuit', mode: 'dark', swatch: ['#0a0b0a', '#22c55e'] },
  { id: 'fjord', label: 'Fjord', mode: 'dark', swatch: ['#1f242e', '#88c0d0'] },
  { id: 'ember', label: 'Ember', mode: 'dark', swatch: ['#100b0c', '#ef4444'] },
  { id: 'glacier', label: 'Glacier', mode: 'light', swatch: ['#f4f6fa', '#2563eb'] },
  { id: 'prism', label: 'Prism', mode: 'light', swatch: ['#fafbfe', '#7c3aed'] },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

const STORAGE_KEY = 'arcadia-theme';
const DEFAULT_THEME: ThemeId = 'volt';

/** Theme lineups have been renamed twice; carry old choices to their nearest
 * new home instead of silently resetting to the default. */
const LEGACY_THEMES: Record<string, ThemeId> = {
  aurora: 'glacier',
  mint: 'glacier',
  midnight: 'volt',
  carbon: 'volt',
  'indigo-night': 'volt',
  tide: 'circuit',
  meadow: 'glacier',
  ion: 'circuit',
  'old-growth': 'circuit',
  timberline: 'glacier',
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
