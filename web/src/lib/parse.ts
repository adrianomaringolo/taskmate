import { addDays, today } from './date';
import type { Priority } from './types';

export interface ParsedCapture {
  title: string;
  dueDate?: string;
  priority?: Priority;
}

/**
 * Pulls an optional due date and priority out of a capture string, leaving
 * everything else as the title.
 *
 * The rule that keeps this safe: only tokens the parser *recognises* are
 * removed. A word it does not understand stays in the title verbatim, so plain
 * text always works and the feature can never quietly swallow part of a task.
 * If stripping the tokens would leave the title empty, nothing is stripped.
 *
 * Recognised, case- and accent-insensitive, as whole space-delimited tokens:
 *
 * | token                     | meaning                              |
 * |---------------------------|--------------------------------------|
 * | `hoje`                    | today                                |
 * | `amanhã` / `amanha`       | tomorrow                             |
 * | `seg`…`dom` / `segunda`…  | the next occurrence of that weekday  |
 * | `12/03` / `12/03/2026`    | that calendar day (rolls to next year if `DD/MM` already passed) |
 * | `+3`                      | 3 days from today                    |
 * | `!alta` / `!media` / `!baixa` | priority 3 / 2 / 1               |
 * | `!1` / `!2` / `!3`        | priority 1 / 2 / 3                   |
 *
 * The last date token wins; the last priority token wins.
 */
export function parseCapture(input: string): ParsedCapture {
  const raw = input.trim();
  const tokens = raw.split(/\s+/).filter(Boolean);

  let dueDate: string | undefined;
  let priority: Priority | undefined;
  const kept: string[] = [];

  for (const token of tokens) {
    const prio = matchPriority(token);
    if (prio !== null) {
      priority = prio;
      continue;
    }
    const date = matchDate(token);
    if (date !== null) {
      dueDate = date;
      continue;
    }
    kept.push(token);
  }

  const title = kept.join(' ').trim();
  // Every word was a token (`hoje !alta`): keep the original rather than create
  // a task with no title.
  if (!title) return { title: raw };

  return { title, ...(dueDate ? { dueDate } : {}), ...(priority ? { priority } : {}) };
}

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function matchPriority(token: string): Priority | null {
  const t = strip(token);
  if (t === '!alta' || t === '!3') return 3;
  if (t === '!media' || t === '!2') return 2;
  if (t === '!baixa' || t === '!1') return 1;
  return null;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1,
  terca: 2, ter: 2,
  quarta: 3, qua: 3,
  quinta: 4, qui: 4,
  sexta: 5, sex: 5,
  sabado: 6, sab: 6,
};

function matchDate(token: string): string | null {
  const t = strip(token);
  const now = today();

  if (t === 'hoje') return now;
  if (t === 'amanha') return addDays(now, 1);

  const plus = /^\+(\d{1,3})$/.exec(t);
  if (plus) return addDays(now, Number(plus[1]));

  if (t in WEEKDAYS) return nextWeekday(now, WEEKDAYS[t]!);

  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(t);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    const currentYear = Number(now.slice(0, 4));
    let year = slash[3]
      ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3])
      : currentYear;
    const iso = (y: number) =>
      `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    // A bare DD/MM that already passed this year means next year.
    if (!slash[3] && iso(year) < now) year += 1;
    return iso(year);
  }

  return null;
}

/** The nearest day strictly after `from` that falls on `weekday` (0 = Sunday). */
function nextWeekday(from: string, weekday: number): string {
  for (let i = 1; i <= 7; i++) {
    const candidate = addDays(from, i);
    if (new Date(`${candidate}T00:00`).getDay() === weekday) return candidate;
  }
  return from; // unreachable
}

/**
 * Strips a leading list marker (`- `, `* `, `• `, `1. `, `[ ] `, `[x] `) from a
 * pasted line before it goes through `parseCapture`. Used when a multi-line
 * paste is turned into one task per line.
 */
export function stripListMarker(line: string): string {
  return line.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s+/, '').trim();
}
