/**
 * Daily task reminders via the Notification API.
 *
 * There is no backend to deliver these while the app is fully closed — Web
 * Push needs a server to call the push service at the right time, and this
 * app deliberately has none (see PRODUCT.md: "sem servidor nosso"). What
 * this gives instead: the next time the app is open on or after 8h local
 * time on a given day, if it hasn't already reminded today, it notifies
 * about open tasks due today or tomorrow. A live check while the tab stays
 * open (see the effect in App.tsx) catches the moment 8h arrives without
 * needing a reload — but if the app is never opened that day, the day's
 * reminder is simply never shown. That trade only exists because the
 * alternative is a server, a subscription table, and a scheduler this
 * project's architecture is built to avoid.
 */
import { addDays, today } from './date';
import { readPref, writePref } from './prefs';
import type { Task } from './types';

const REMINDER_HOUR = 8;
const LAST_SHOWN_KEY = 'reminderShownOn';
const ENABLED_KEY = 'remindersEnabled';

export const isSupported = (): boolean => typeof window !== 'undefined' && 'Notification' in window;

export const permission = (): NotificationPermission | 'unsupported' =>
  isSupported() ? Notification.permission : 'unsupported';

export const enabled = (): boolean => readPref(ENABLED_KEY) === '1';

export function setEnabled(value: boolean): void {
  writePref(ENABLED_KEY, value ? '1' : '0');
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!isSupported()) return 'denied';
  return Notification.requestPermission();
}

/** Open tasks due today or tomorrow — the two buckets the reminder covers. */
export function dueSoon(tasks: readonly Task[], from = today()): { dueToday: Task[]; dueTomorrow: Task[] } {
  const tomorrow = addDays(from, 1);
  const open = tasks.filter((t) => !t.done && t.dueDate);
  return {
    dueToday: open.filter((t) => t.dueDate === from),
    dueTomorrow: open.filter((t) => t.dueDate === tomorrow),
  };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** `null` when there is nothing to say — the caller should stay silent, not notify with an empty body. */
export function reminderText(dueToday: Task[], dueTomorrow: Task[]): { title: string; body: string } | null {
  if (dueToday.length === 0 && dueTomorrow.length === 0) return null;

  const parts: string[] = [];
  if (dueToday.length > 0) {
    parts.push(`${dueToday.length} ${plural(dueToday.length, 'tarefa vence', 'tarefas vencem')} hoje`);
  }
  if (dueTomorrow.length > 0) {
    parts.push(`${dueTomorrow.length} ${plural(dueTomorrow.length, 'vence', 'vencem')} amanhã`);
  }
  return { title: 'Tarefas com prazo', body: `${parts.join(', ')}.` };
}

/** True once it is 8h or later local time and today has not been notified yet. */
export function shouldRemindNow(now = new Date()): boolean {
  return now.getHours() >= REMINDER_HOUR && readPref(LAST_SHOWN_KEY) !== today();
}

export function markShownToday(): void {
  writePref(LAST_SHOWN_KEY, today());
}

export function showReminder(title: string, body: string): void {
  const n = new Notification(title, { body, icon: '/icon-192.png', tag: 'taskmate-daily' });
  n.onclick = () => {
    window.focus();
    n.close();
  };
}
