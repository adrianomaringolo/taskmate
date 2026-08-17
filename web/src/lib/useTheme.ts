import { useCallback, useEffect, useState } from 'react';
import { readPref, writePref } from './prefs';

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'theme';

function read(): ThemeChoice {
  const v = readPref(KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

/**
 * Three states, matching the token file: `system` sets no attribute and lets
 * `prefers-color-scheme` decide; the other two stamp `data-theme` so the
 * explicit choice wins in both directions.
 */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === 'system') delete root.dataset.theme;
    else root.dataset.theme = choice;

    writePref(KEY, choice);
  }, [choice]);

  const cycle = useCallback(() => {
    setChoice((c) => (c === 'system' ? 'light' : c === 'light' ? 'dark' : 'system'));
  }, []);

  return { choice, setChoice, cycle };
}
