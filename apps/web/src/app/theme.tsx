import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export const THEMES = [
  { id: 'onyx', label: 'Onyx', mode: 'dark', swatch: ['#000000', '#ffffff'] },
  { id: 'aurora', label: 'Aurora', mode: 'dark', swatch: ['#030305', '#6ee7f9'] },
  { id: 'cobalt', label: 'Cobalt', mode: 'dark', swatch: ['#02040a', '#3b9eff'] },
  { id: 'jade', label: 'Jade', mode: 'dark', swatch: ['#020403', '#3dd68c'] },
  { id: 'paper', label: 'Paper', mode: 'light', swatch: ['#fcfcfc', '#0a0a0a'] },
  { id: 'frost', label: 'Frost', mode: 'light', swatch: ['#f7f9fc', '#0b6bff'] },
  { id: 'orchid', label: 'Orchid', mode: 'light', swatch: ['#fbfaff', '#6e56cf'] },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

const STORAGE_KEY = 'arcadia-theme';
const DEFAULT_THEME: ThemeId = 'onyx';

/** Theme lineups have been renamed three times; carry old choices to their
 * nearest new home instead of silently resetting to the default. Keep this
 * map in step with the copy in index.html (the before-first-paint script). */
const LEGACY_THEMES: Record<string, ThemeId> = {
  volt: 'aurora',
  circuit: 'jade',
  fjord: 'cobalt',
  ember: 'onyx',
  glacier: 'frost',
  prism: 'orchid',
  mint: 'frost',
  midnight: 'onyx',
  carbon: 'onyx',
  'indigo-night': 'aurora',
  tide: 'jade',
  meadow: 'paper',
  ion: 'jade',
  'old-growth': 'jade',
  timberline: 'paper',
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
