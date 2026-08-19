import { useEffect, useState } from 'react';
import { readPref, writePref } from './prefs';

export type VisionChoice = 'default' | 'low-vision';

const KEY = 'vision';

function read(): VisionChoice {
  return readPref(KEY) === 'low-vision' ? 'low-vision' : 'default';
}

/**
 * Opt-in low-vision mode: larger touch targets, larger type, and a thicker
 * focus ring. Stamps `data-vision` on the root so tokens.css can scale the
 * shared --tap-* and --t-* custom properties from one place, the same way
 * useTheme stamps `data-theme`.
 */
export function useA11y() {
  const [vision, setVision] = useState<VisionChoice>(read);

  useEffect(() => {
    const root = document.documentElement;
    if (vision === 'low-vision') root.dataset.vision = 'low';
    else delete root.dataset.vision;

    writePref(KEY, vision);
  }, [vision]);

  return { vision, setVision };
}
