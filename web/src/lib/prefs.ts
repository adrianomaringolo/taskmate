/**
 * Device-local preferences, namespaced.
 *
 * Every key falls back to the pre-rename namespace once, so renaming the app did
 * not reset anyone's theme, last view, or folded groups. The fallback also
 * *migrates* on read — it writes the value under the new key — so the legacy
 * entries stop being consulted after the first load.
 */

const NS = 'taskmate';
const LEGACY_NS = 'trellis';

export function readPref(name: string): string | null {
  try {
    const current = localStorage.getItem(`${NS}:${name}`);
    if (current !== null) return current;

    const legacy = localStorage.getItem(`${LEGACY_NS}:${name}`);
    if (legacy === null) return null;

    localStorage.setItem(`${NS}:${name}`, legacy);
    localStorage.removeItem(`${LEGACY_NS}:${name}`);
    return legacy;
  } catch {
    // Private mode or blocked storage: callers fall back to their default.
    return null;
  }
}

export function writePref(name: string, value: string): void {
  try {
    localStorage.setItem(`${NS}:${name}`, value);
  } catch {
    // The session still works; the preference just will not persist.
  }
}

export function removePref(name: string): void {
  try {
    localStorage.removeItem(`${NS}:${name}`);
    localStorage.removeItem(`${LEGACY_NS}:${name}`);
  } catch {
    // Nothing to clean up if storage is unavailable in the first place.
  }
}
