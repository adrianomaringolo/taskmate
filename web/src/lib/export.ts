import { RECURRENCE_LABELS, type AppState, type Task } from './types';

/**
 * The whole document as a Markdown outline: `##` per group (Entrada first),
 * `###` per list, one `- [ ]` / `- [x]` per task with prazo, prioridade and
 * recorrência in parentheses, and notes indented beneath.
 *
 * The synced file on Drive is opaque Automerge binary; `PRODUCT.md` says the
 * user owns their data, and a plain-text export is what makes that true — it
 * can be read, diffed, versioned, and pasted somewhere else without the app.
 */
export function toMarkdown(data: AppState): string {
  const out: string[] = ['# Taskmate', ''];

  const tasksOf = (listId: string) => data.tasks.filter((t) => t.listId === listId);

  const renderTask = (t: Task) => {
    const box = t.done ? '[x]' : '[ ]';
    const tags: string[] = [];
    if (t.dueDate) tags.push(t.dueDate);
    if (t.priority > 0) tags.push('!'.repeat(t.priority));
    if (t.recurrence) tags.push(RECURRENCE_LABELS[t.recurrence.unit].toLowerCase());
    out.push(`- ${box} ${t.title}${tags.length ? ` (${tags.join(', ')})` : ''}`);
    if (t.notes.trim()) {
      for (const line of t.notes.split('\n')) out.push(`  ${line}`.trimEnd());
    }
  };

  const renderList = (name: string, listId: string, heading: string) => {
    const tasks = tasksOf(listId);
    if (tasks.length === 0) return;
    out.push(`${heading} ${name}`, '');
    tasks.forEach(renderTask);
    out.push('');
  };

  const inbox = data.lists.find((l) => l.isInbox);
  if (inbox) renderList(inbox.name, inbox.id, '##');

  for (const group of data.groups) {
    const lists = data.lists.filter((l) => l.groupId === group.id);
    const hasTasks = lists.some((l) => tasksOf(l.id).length > 0);
    if (!hasTasks) continue;
    out.push(`## ${group.name}`, '');
    for (const list of lists) renderList(list.name, list.id, '###');
  }

  return `${out.join('\n').trim()}\n`;
}
