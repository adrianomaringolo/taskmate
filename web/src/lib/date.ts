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
const SHORT = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
const FULL = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' });

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

/** e.g. "concluída em 16 de ago., 14:32" */
export function describeStamp(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
