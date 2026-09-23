import { useRef, useState } from 'react';
import { addDays, daysFromToday, describeDue, describeDueFull, isOverdue, isToday, today } from '../lib/date';
import { useStore } from '../lib/store';
import { PRIORITY_LABELS, RECURRENCE_LABELS, type Task } from '../lib/types';
import { Icon } from './Icon';
import { TASK_MIME } from '../lib/taskDrag';
import { InlineText } from './InlineText';
import { Menu } from './Menu';
import { TaskDetail } from './TaskDetail';

interface Props {
  task: Task;
  /** Shown when the view mixes lists, so a row still says where it lives. */
  listTag?: string;
  /** Manual order only applies inside a single list. */
  reorderable?: boolean;
  /**
   * A board card is too narrow to expand its detail panel inline the way a
   * list row does, so it opens in a dialog instead.
   */
  detailInModal?: boolean;
  /**
   * Inline scheduling shortcuts, adapted to the task's state: an undated task
   * gets "Dar prazo" (Hoje / Amanhã / 1 semana), an overdue one gets "Adiar"
   * (Amanhã / 3 dias / 1 semana / 1 mês). The triage views' whole point.
   */
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
  detailInModal = false,
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Only worth a chip while it's still in the future: once reached, the task
  // behaves like any other and a "começa em [data passada]" chip would be
  // stale, not informative.
  const pendingStart = !!task.startDate && daysFromToday(task.startDate) > 0;

  /**
   * `showModal()` is called here, synchronously inside the click handler —
   * not from a `useEffect` reacting to `open` — because `TaskDetail`'s
   * content (the checklist's `InlineText` items) mounts in the same render
   * that flips `open` to true. A reactive effect would call `showModal()`
   * only *after* that render's layout effects had already run, so every
   * `InlineText` would measure its own height while the dialog was still
   * `display: none` and bake in a collapsed `height: 0` it never recovers
   * from. Calling it here means the dialog is already open by the time
   * `TaskDetail` mounts and its children measure themselves.
   *
   * The dialog's own `close` event (Escape, backdrop click) is still the
   * only path back to `setOpen(false)` — see the `<dialog>` below.
   */
  const toggleDetail = () => {
    const next = !open;
    setOpen(next);
    if (!detailInModal) return;
    if (next) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  };

  return (
    <li
      className="task"
      data-done={task.done}
      // The board card's absolute-positioned actions and lifted background
      // both exist to react to *inline* expansion; a dialog covers the card
      // instead, so the card underneath should look untouched while it's up.
      data-open={detailInModal ? false : open}
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
            title="Arraste para reordenar ou até uma lista na lateral, ou Alt + ↑ / ↓"
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              // Firefox refuses to start a drag without payload.
              e.dataTransfer.setData('text/plain', task.id);
              // Lets a list in the sidebar recognise this as a task and take it.
              e.dataTransfer.setData(TASK_MIME, task.id);
              // Drag the whole row, not just the grip, so the sidebar can see
              // which task is on its way.
              const row = e.currentTarget.closest('.task');
              if (row) {
                const box = row.getBoundingClientRect();
                e.dataTransfer.setDragImage(row, e.clientX - box.left, e.clientY - box.top);
              }
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

          {(task.dueDate ||
            pendingStart ||
            task.priority > 0 ||
            listTag ||
            task.notes ||
            task.recurrence ||
            task.tags.length > 0 ||
            task.steps.length > 0) && (
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

              {pendingStart && (
                <span className="chip" title={`Começa ${describeDueFull(task.startDate!)}`}>
                  <Icon name="hourglass" size={13} />
                  começa {describeDue(task.startDate!)}
                </span>
              )}

              {task.recurrence && (
                <span className="chip" title={RECURRENCE_LABELS[task.recurrence.unit]}>
                  <Icon name="repeat" size={13} />
                  {RECURRENCE_LABELS[task.recurrence.unit]}
                </span>
              )}

              {task.steps.length > 0 && (
                <span className="chip" title="Checklist">
                  <Icon name="listChecks" size={13} />
                  {task.steps.filter((s) => s.done).length}/{task.steps.length}
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

              {task.tags.map((tag) => (
                <span key={tag} className="chip" title={`Etiqueta: ${tag}`}>
                  <Icon name="tag" size={13} />
                  {tag}
                </span>
              ))}

              {listTag && <span className="task__list-tag">{listTag}</span>}
            </div>
          )}

          {quickSchedule && !task.done && !task.dueDate && (
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

          {quickSchedule && !task.done && task.dueDate && isOverdue(task.dueDate) && (
            <div className="task__schedule">
              <span className="task__schedule-label">Adiar:</span>
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
                onClick={() => void patchTask(task.id, { dueDate: addDays(today(), 3) })}
              >
                3 dias
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => void patchTask(task.id, { dueDate: addDays(today(), 7) })}
              >
                1 semana
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => void patchTask(task.id, { dueDate: addDays(today(), 30) })}
              >
                1 mês
              </button>
            </div>
          )}
        </div>

        <div className="task__actions">
          {/* Touch has no hover to reveal these, so on a phone both would sit
              permanently next to the title. There they collapse into one menu
              (see the `hover: none` rule in app.css); with a pointer they stay
              as the two one-click buttons, hidden until hover. */}
          <button
            type="button"
            className="btn btn--icon task__act"
            aria-expanded={open}
            aria-label={open ? 'Fechar detalhes' : 'Abrir detalhes'}
            title={open ? 'Fechar detalhes' : 'Detalhes'}
            onClick={toggleDetail}
          >
            <Icon name="chevron" size={14} className={open ? 'rotated' : undefined} />
          </button>
          <button
            type="button"
            className="btn btn--icon task__act"
            aria-label={`Excluir ${task.title}`}
            title="Excluir"
            onClick={() => void removeTask(task.id)}
          >
            <Icon name="trash" size={14} />
          </button>

          <Menu
            label={`Ações de ${task.title}`}
            triggerClassName="btn btn--icon task__actions-more"
            triggerContent={<Icon name="more" size={14} />}
          >
            {(close) => (
              <>
                <button
                  type="button"
                  className="menu__item"
                  onClick={() => {
                    toggleDetail();
                    close();
                  }}
                >
                  <Icon name="eye" />
                  {open ? 'Fechar detalhes' : 'Abrir detalhes'}
                </button>
                <button
                  type="button"
                  className="menu__item menu__item--danger"
                  onClick={() => {
                    close();
                    void removeTask(task.id);
                  }}
                >
                  <Icon name="trash" />
                  Excluir
                </button>
              </>
            )}
          </Menu>
        </div>
      </div>

      {detailInModal ? (
        <dialog
          ref={dialogRef}
          className="dialog task-dialog"
          onClose={() => setOpen(false)}
          onClick={(e) => {
            if (e.target === dialogRef.current) dialogRef.current?.close();
          }}
        >
          <button
            type="button"
            className="btn btn--icon dialog__close"
            aria-label="Fechar"
            onClick={() => dialogRef.current?.close()}
          >
            <Icon name="x" />
          </button>
          <h2 className="dialog__title">{task.title}</h2>
          {/* Mounted only once `open`, and only after `toggleDetail` has
              already called `showModal()` — see its comment. Mounting
              unconditionally would run the checklist's `InlineText` layout
              effects while the dialog was still `display: none`. */}
          {open && (
            <TaskDetail
              task={task}
              onClose={() => dialogRef.current?.close()}
              onNudge={reorderable ? onNudge : undefined}
            />
          )}
        </dialog>
      ) : (
        open && (
          <TaskDetail
            task={task}
            onClose={() => setOpen(false)}
            onNudge={reorderable ? onNudge : undefined}
          />
        )
      )}
    </li>
  );
}
