import { useCallback, useEffect, useId, useRef, useState, type MouseEvent } from 'react';
import { addDays, describeStamp, today } from '../lib/date';
import { useStore } from '../lib/store';
import { PRIORITY_LABELS, type Priority, type Task } from '../lib/types';
import { Icon } from './Icon';

interface Props {
  task: Task;
  onClose: () => void;
  /**
   * Present only inside a single list, where manual order exists. These two
   * buttons are the reordering path that works on touch and with a screen
   * reader — HTML5 drag fires from neither.
   */
  onNudge?: (delta: -1 | 1) => void;
}

/**
 * Acts without stealing focus from whatever field is being edited.
 *
 * Without this, `mousedown` blurs the notes field, the blur commits, the commit
 * inserts the "notas" chip into the row above, everything below shifts down —
 * and `mouseup` lands on empty space, so the click never reaches the button.
 * The user sees a button that does nothing.
 */
const keepFocus = (e: MouseEvent) => e.preventDefault();

/**
 * Expands inline under its row instead of opening a dialog. Nothing here needs
 * to interrupt the list, and keeping the row visible preserves the context the
 * user was reading.
 */
export function TaskDetail({ task, onClose, onNudge }: Props) {
  const { data, groupById, patchTask, removeTask, moveTask } = useStore();
  const ids = useId();
  const [notes, setNotes] = useState(task.notes);

  useEffect(() => setNotes(task.notes), [task.id, task.notes]);

  const commitNotes = useCallback(() => {
    if (notes !== task.notes) void patchTask(task.id, { notes });
  }, [notes, patchTask, task.id, task.notes]);

  // Autosave while typing: notes survive a closed tab, and the row's "notas"
  // chip appears mid-typing instead of at the instant of some later click.
  useEffect(() => {
    if (notes === task.notes) return;
    const timer = setTimeout(commitNotes, 600);
    return () => clearTimeout(timer);
  }, [notes, task.notes, commitNotes]);

  // The panel can disappear without a blur — the row re-sorts, or the list is
  // switched — which would cancel the debounce above and drop the text.
  const flushRef = useRef(commitNotes);
  flushRef.current = commitNotes;
  useEffect(() => () => flushRef.current(), []);

  const setDue = (value: string | null) => void patchTask(task.id, { dueDate: value });

  const list = data.lists.find((l) => l.id === task.listId);
  const group = list?.groupId ? groupById.get(list.groupId) : undefined;

  return (
    <div className="detail">
      <div className="field">
        <label className="field__label" htmlFor={`${ids}-notes`}>
          Notas
        </label>
        <textarea
          id={`${ids}-notes`}
          className="textarea"
          value={notes}
          placeholder="Contexto, links, o que precisa acontecer antes."
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commitNotes}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commitNotes();
            }
          }}
        />
      </div>

      <div className="detail__grid">
        <div className="field field--due">
          <label className="field__label" htmlFor={`${ids}-due`}>
            Prazo
          </label>
          <input
            id={`${ids}-due`}
            className="input"
            type="date"
            value={task.dueDate ?? ''}
            onChange={(e) => setDue(e.target.value || null)}
          />
          <div className="detail__quick">
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onMouseDown={keepFocus}
              onClick={() => setDue(today())}
            >
              Hoje
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onMouseDown={keepFocus}
              onClick={() => setDue(addDays(today(), 1))}
            >
              Amanhã
            </button>
            {task.dueDate && (
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onMouseDown={keepFocus}
                onClick={() => setDue(null)}
              >
                Sem prazo
              </button>
            )}
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${ids}-prio`}>
            Prioridade
          </label>
          <select
            id={`${ids}-prio`}
            className="select"
            value={task.priority}
            onChange={(e) => void patchTask(task.id, { priority: Number(e.target.value) as Priority })}
          >
            {([0, 1, 2, 3] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor={`${ids}-list`}>
            Lista
          </label>
          <select
            id={`${ids}-list`}
            className="select"
            value={task.listId}
            onChange={(e) => {
              // Appending at the end of the destination is the predictable
              // outcome; guessing an index would surprise.
              const destination = e.target.value;
              const size = data.tasks.filter((t) => t.listId === destination).length;
              void moveTask(task.id, destination, size);
            }}
          >
            {data.lists
              .filter((l) => l.isInbox)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            {data.groups.map((g) => {
              const lists = data.lists.filter((l) => l.groupId === g.id);
              if (lists.length === 0) return null;
              return (
                <optgroup key={g.id} label={g.name}>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
      </div>

      <div className="detail__foot">
        {onNudge && (
          <span className="detail__reorder">
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onMouseDown={keepFocus}
              onClick={() => onNudge(-1)}
              aria-label="Mover para cima na lista"
              title="Mover para cima"
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onMouseDown={keepFocus}
              onClick={() => onNudge(1)}
              aria-label="Mover para baixo na lista"
              title="Mover para baixo"
            >
              ↓
            </button>
          </span>
        )}

        <p className="detail__stamp">
          {task.done && task.doneAt
            ? `Concluída em ${describeStamp(task.doneAt)}`
            : `Criada em ${describeStamp(task.createdAt)}`}
          {group ? ` · ${group.name}` : ''}
        </p>

        <button
          type="button"
          className="btn btn--sm btn--danger"
          onClick={() => {
            onClose();
            void removeTask(task.id);
          }}
        >
          <Icon name="trash" />
          Excluir
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}
