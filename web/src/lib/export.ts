import { RECURRENCE_LABELS, type AppState, type Task } from './types';

/**
 * The whole document as a Markdown outline: `##` per group (Entrada first),
 * `###` per list, one `- [ ]` / `- [x]` per task with prazo, prioridade and
 * recorrência in parentheses, and notes indented beneath. A final `## Notas`
 * section lists the free-standing notes feature, one bullet per note.
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
    const meta: string[] = [];
    if (t.dueDate) meta.push(t.dueDate);
    if (t.startDate) meta.push(`início ${t.startDate}`);
    if (t.priority > 0) meta.push('!'.repeat(t.priority));
    if (t.recurrence) meta.push(RECURRENCE_LABELS[t.recurrence.unit].toLowerCase());
    meta.push(...t.tags);
    out.push(`- ${box} ${t.title}${meta.length ? ` (${meta.join(', ')})` : ''}`);
    if (t.notes.trim()) {
      for (const line of t.notes.split('\n')) out.push(`  ${line}`.trimEnd());
    }
    for (const step of t.steps) {
      out.push(`  - [${step.done ? 'x' : ' '}] ${step.text}`);
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

  if (data.notes.length > 0) {
    out.push('## Notas', '');
    for (const note of data.notes) {
      const meta = note.tags.length > 0 ? ` (${note.tags.join(', ')})` : '';
      out.push(`- **${note.title || 'Sem título'}**${meta}`);
      const body = noteBodyToMarkdown(note.body);
      if (body) {
        for (const line of body.split('\n')) out.push(`  ${line}`.trimEnd());
      }
    }
    out.push('');
  }

  return `${out.join('\n').trim()}\n`;
}

/**
 * A note's body is HTML from the rich-text editor (see NotesView.tsx),
 * restricted to a small tag set on purpose — this only needs to round-trip
 * that set to Markdown, not handle arbitrary HTML: `**bold**`, `*italic*`,
 * `_underline_`, `#`/`##`/`###` headings, `- ` bullets.
 */
function noteBodyToMarkdown(html: string): string {
  return html
    .replace(/<(h[1-3])>/gi, (_m, tag: string) => `\n${'#'.repeat(Number(tag[1]))} `)
    .replace(/<\/h[1-3]>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/?ul>/gi, '')
    .replace(/<\/?(p|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(b|strong)>/gi, '**')
    .replace(/<\/?(i|em)>/gi, '*')
    .replace(/<\/?u>/gi, '_')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
