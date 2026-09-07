import { readPref, writePref } from './prefs';

export type WeekStart = 'monday' | 'sunday';

const KEY = 'weekStart';

export function readWeekStart(): WeekStart {
  return readPref(KEY) === 'sunday' ? 'sunday' : 'monday';
}

/**
 * Module state rather than a parameter: a dozen calendar helpers in `date.ts`
 * need the week's first day, and threading it through every one of them (and
 * their callers) for a preference that changes maybe once would be pure noise.
 * `setWeekStart` is called once at boot from `App.tsx` and again whenever the
 * preference changes; the calendar re-renders because `App` also carries the
 * choice in React state and keys the calendar view on it.
 */
let firstDay: 0 | 1 = readWeekStart() === 'sunday' ? 0 : 1;

/** 0 = Sunday, 1 = Monday. */
export const weekStartDay = (): 0 | 1 => firstDay;

export function setWeekStart(value: WeekStart): void {
  firstDay = value === 'sunday' ? 0 : 1;
  writePref(KEY, value);
}
