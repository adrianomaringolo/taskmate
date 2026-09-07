import { useState } from 'react';
import { addDays, describeDue, describeDueFull, isOverdue, isToday, today } from '../lib/date';
import { useStore } from '../lib/store';
import { PRIORITY_LABELS, RECURRENCE_LABELS, type Task } from '../lib/types';
import { Icon } from './Icon';
import { InlineText } from './InlineText';
import { TaskDetail } from './TaskDetail';

interface Props {
  task: Task;
  /** Shown when the view mixes lists, so a row still says where it lives. */
  listTag?: string;
  /** Manual order only applies inside a single list. */
  reorderable?: boolean;
  /** Adds inline "Hoje" / "Amanhã" buttons — the triage view's whole point. */
  quickSchedule?: boolean;
  dropEdge?: 'before' | 'after' | null;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (edge: 'before' | 'after') => void;
  onDrop?: () => void;
  onNudge?: (delta: -1 | 1) => void;
}

export function TaskRow({
  task,
  listTag,
  reorderable = false,
  quickSchedule = false,
  dropEdge = null,
  dragging = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onNudge,
}: Props) {
  const { patchTask, removeTask } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <li
      className="task"
      data-done={task.done}
      data-open={open}
      data-dragging={dragging}
      data-drop={dropEdge ?? undefined}
      onDragOver={
        reorderable && onDragOver
          ? (e) => {
              e.preventDefault();
              const box = e.currentTarget.getBoundingClientRect();
              onDragOver(e.clientY < box.top + box.height / 2 ? 'before' : 'after');
            }
          : undefined
      }
      onDrop={
        reorderable && onDrop
          ? (e) => {
              e.preventDefault();
              onDrop();
            }
          : undefined
      }
    >
      <div className="task__row">
        {reorderable && (
          <span
            className="task__grip"
            draggable
            role="button"
            tabIndex={0}
            aria-label={`Reordenar ${task.title}. Use Alt com as setas para mover.`}
            title="Arraste, ou Alt + ↑ / ↓"
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              // Firefox refuses to start a drag without payload.
              e.dataTransfer.setData('text/plain', task.id);
              onDragStart?.();
            }}
            onDragEnd={() => onDragEnd?.()}
            onKeyDown={(e) => {
              // Keyboard parity for reordering: dragging can't be the only way.
              if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                onNudge?.(e.key === 'ArrowUp' ? -1 : 1);
              }
            }}
          >
            <Icon name="grip" size={14} />
          </span>
        )}

        <button
          type="button"
          className="check"
          role="checkbox"
          aria-checked={task.done}
          aria-label={task.done ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
          onClick={() => void patchTask(task.id, { done: !task.done })}
        >
          <svg className="check__tick" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M4 9.2l3.1 3.1L14 5.6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="task__body">
          <InlineText
            className="task__title-input"
            value={task.title}
            ariaLabel="Título da tarefa"
            maxLength={300}
            onCommit={(title) => void patchTask(task.id, { title })}
          />

          {(task.dueDate || task.priority > 0 || listTag || task.notes || task.recurrence) && (
            <div className="task__meta">
              {task.dueDate && (
                <span
                  className={`chip${
                    isOverdue(task.dueDate) && !task.done
                      ? ' chip--overdue'
                      : isToday(task.dueDate) && !task.done
                        ? ' chip--today'
                        : ''
                  }`}
                  title={describeDueFull(task.dueDate)}
                >
                  <Icon name={isOverdue(task.dueDate) && !task.done ? 'alert' : 'today'} size={13} />
                  {describeDue(task.dueDate)}
                </span>
              )}

              {task.recurrence && (
                <span className="chip" title={RECURRENCE_LABELS[task.recurrence.unit]}>
                  <Icon name="repeat" size={13} />
                  {RECURRENCE_LABELS[task.recurrence.unit]}
                </span>
              )}

              {task.priority > 0 && (
                <span className={`prio prio--${task.priority}`} title={PRIORITY_LABELS[task.priority]}>
                  <span className="prio__bars" aria-hidden="true">
                    {[1, 2, 3].map((step) => (
                      <span
                        key={step}
                        className="prio__bar"
                        style={{
                          height: `${step * 3 + 1}px`,
                          opacity: step <= task.priority ? 1 : 0.25,
                        }}
                      />
                    ))}
                  </span>
                  {PRIORITY_LABELS[task.priority]}
                </span>
              )}

              {task.notes && (
                <span className="chip" title="Tem notas">
                  <Icon name="list" size={13} />
                  notas
                </span>
              )}

              {listTag && <span className="task__list-tag">{listTag}</span>}
            </div>
          )}

          {quickSchedule && !task.done && (
            <div className="task__schedule">
              <span className="task__schedule-label">Dar prazo:</span>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => void patchTask(task.id, { dueDate: today() })}
              >
                Hoje
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => void patchTask(task.id, { dueDate: addDays(today(), 1) })}
              >
                Amanhã
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => void patchTask(task.id, { dueDate: addDays(today(), 7) })}
              >
                Em 1 semana
              </button>
            </div>
          )}
        </div>

        <div className="task__actions">
          <button
            type="button"
            className="btn btn--icon"
            aria-expanded={open}
            aria-label={open ? 'Fechar detalhes' : 'Abrir detalhes'}
            title={open ? 'Fechar detalhes' : 'Detalhes'}
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name="chevron" size={14} className={open ? 'rotated' : undefined} />
          </button>
          <button
            type="button"
            className="btn btn--icon"
            aria-label={`Excluir ${task.title}`}
            title="Excluir"
            onClick={() => void removeTask(task.id)}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>

      {open && (
        <TaskDetail
          task={task}
          onClose={() => setOpen(false)}
          onNudge={reorderable ? onNudge : undefined}
        />
      )}
    </li>
  );
}
