/**
 * Due dates are calendar days (`YYYY-MM-DD`), so every helper here works in the
 * *local* calendar. Parsing `"2026-08-17"` with `new Date()` would read it as
 * UTC midnight and show the day before for anyone west of Greenwich — the bug
 * this module exists to avoid.
 */

/** Today in the user's own calendar, as `YYYY-MM-DD`. */
export function today(): string {
  return toKey(new Date());
}

export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses `YYYY-MM-DD` into a local-midnight Date. */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** Whole days from today. Negative = overdue. */
export function daysFromToday(key: string): number {
  const a = fromKey(today());
  const b = fromKey(key);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
const WEEKDAY_SHORT = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const SHORT = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const FULL = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' });
const MONTH_YEAR = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });

/** Human, relative when that is the more useful reading. */
export function describeDue(key: string): string {
  const diff = daysFromToday(key);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'atrasada desde ontem';
  if (diff < -1) return `atrasada há ${-diff} dias`;
  if (diff <= 6) return WEEKDAY.format(fromKey(key));
  return SHORT.format(fromKey(key));
}

/** Unambiguous form for `title` attributes and screen readers. */
export function describeDueFull(key: string): string {
  return FULL.format(fromKey(key));
}

export function isOverdue(key: string): boolean {
  return daysFromToday(key) < 0;
}

export function isToday(key: string): boolean {
  return daysFromToday(key) === 0;
}

/** Next occurrence of a recurring due date. Pure in `key`, so two devices that
 *  each complete the same task offline — from the same prior due date —
 *  compute the identical next date independently; the merge needs no
 *  reconciliation because both writes already agree. */
export function advanceDue(key: string, unit: 'day' | 'week' | 'month'): string {
  if (unit === 'month') return addMonths(key, 1);
  return addDays(key, unit === 'week' ? 7 : 1);
}

export function addMonths(key: string, months: number): string {
  const d = fromKey(key);
  // Pin to day 1 first: Jan 31 + 1 month would otherwise overflow into March.
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return toKey(d);
}

/** Monday-first weekday index: 0 = Monday … 6 = Sunday. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** The Monday on or before `key`. */
export function startOfWeek(key: string): string {
  const d = fromKey(key);
  d.setDate(d.getDate() - mondayIndex(d));
  return toKey(d);
}

/** The seven days of the Monday-first week containing `key`. */
export function weekDays(key: string): string[] {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function startOfMonth(key: string): string {
  const d = fromKey(key);
  return toKey(new Date(d.getFullYear(), d.getMonth(), 1));
}

/**
 * Six full weeks (42 days), Monday-first, covering the month containing `key`
 * plus its leading/trailing days. Always six rows — a 28-day February and a
 * 31-day January render the same grid height, so the toolbar above never
 * jumps between months.
 */
export function monthGrid(key: string): string[] {
  const start = startOfWeek(startOfMonth(key));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function isSameMonth(key: string, monthKey: string): boolean {
  return key.slice(0, 7) === monthKey.slice(0, 7);
}

/** Lowercase, e.g. "seg" — callers capitalize where that reads better. */
export function weekdayShort(key: string): string {
  return WEEKDAY_SHORT.format(fromKey(key)).replace('.', '');
}

/** e.g. "agosto de 2026" */
export function monthLabel(key: string): string {
  return MONTH_YEAR.format(fromKey(key));
}

/** e.g. "11 – 17 de ago. de 2026", crossing months when the week does. */
export function weekLabel(key: string): string {
  const [start, end] = [startOfWeek(key), addDays(startOfWeek(key), 6)];
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: sameMonth ? undefined : 'short',
  }).format(fromKey(start));
  const to = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(fromKey(end));
  return `${from} – ${to}`;
}

/** e.g. "concluída em 16 de ago., 14:32" */
export function describeStamp(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
