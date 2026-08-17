import { useMemo, type RefObject } from 'react';
import {
  addDays,
  addMonths,
  describeDueFull,
  isSameMonth,
  monthGrid,
  monthLabel,
  today,
  weekDays,
  weekLabel,
  weekdayShort,
} from '../lib/date';
import { useStore } from '../lib/store';
import type { CalendarMode, Group, List, Task, View } from '../lib/types';
import { DoneSection } from './ContentView';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { QuickAdd } from './QuickAdd';
import { TaskRow } from './TaskRow';

type CalView = Extract<View, { kind: 'calendar' }>;

interface Props {
  view: CalView;
  onSelect: (view: View) => void;
  quickAddRef: RefObject<HTMLInputElement | null>;
  labelFor: (listId: string) => string | undefined;
}

const MODE_LABEL: Record<CalendarMode, string> = { month: 'Mês', week: 'Semana', day: 'Dia' };

export function CalendarView({ view, onSelect, quickAddRef, labelFor }: Props) {
  const { data, listById, groupById } = useStore();
  const { mode, date } = view;

  const colorFor = useMemo(
    () => (task: Task) => colorForTask(task, listById, groupById),
    [listById, groupById]
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of data.tasks) {
      if (!task.dueDate) continue;
      const bucket = map.get(task.dueDate);
      if (bucket) bucket.push(task);
      else map.set(task.dueDate, [task]);
    }
    for (const bucket of map.values()) bucket.sort(byPriorityThenOrder);
    return map;
  }, [data.tasks]);

  const goTo = (next: Partial<Pick<CalView, 'mode' | 'date'>>) =>
    onSelect({ kind: 'calendar', mode, date, ...next });

  const step = (dir: -1 | 1) => {
    if (mode === 'month') goTo({ date: addMonths(date, dir) });
    else if (mode === 'week') goTo({ date: addDays(date, dir * 7) });
    else goTo({ date: addDays(date, dir) });
  };

  const periodLabel =
    mode === 'month' ? capitalize(monthLabel(date)) : mode === 'week' ? capitalize(weekLabel(date)) : capitalize(describeDueFull(date));

  const count = useMemo(() => {
    if (mode === 'day') return (tasksByDay.get(date) ?? []).filter((t) => !t.done).length;
    const range = mode === 'week' ? weekDays(date) : monthGrid(date).filter((d) => isSameMonth(d, date));
    return range.reduce((n, d) => n + (tasksByDay.get(d) ?? []).filter((t) => !t.done).length, 0);
  }, [mode, date, tasksByDay]);

  return (
    <div className="main__inner main__inner--wide">
      <header className="view-head">
        <p className="view-head__crumb">
          <Icon name="calendar" size={13} />
          {periodLabel}
        </p>
        <h1 className="view-head__title">Calendário</h1>
        <p className="view-head__sub">
          {count === 0 ? 'Nenhum prazo neste período.' : `${count} ${count === 1 ? 'tarefa' : 'tarefas'}`}
        </p>
      </header>

      <div className="cal-toolbar">
        <div className="seg" role="group" aria-label="Modo de exibição">
          {(Object.keys(MODE_LABEL) as CalendarMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className="seg__btn"
              aria-pressed={mode === m}
              onClick={() => goTo({ mode: m })}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="cal-nav">
          <button type="button" className="btn btn--icon cal-nav__prev" aria-label="Período anterior" onClick={() => step(-1)}>
            <Icon name="chevron" size={14} />
          </button>
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => goTo({ date: today() })}>
            Hoje
          </button>
          <button type="button" className="btn btn--icon" aria-label="Próximo período" onClick={() => step(1)}>
            <Icon name="chevron" size={14} />
          </button>
        </div>
      </div>

      {mode === 'month' && (
        <MonthGrid date={date} tasksByDay={tasksByDay} colorFor={colorFor} onPick={(d) => goTo({ mode: 'day', date: d })} />
      )}

      {mode === 'week' && (
        <WeekAgenda date={date} tasksByDay={tasksByDay} labelFor={labelFor} onPick={(d) => goTo({ mode: 'day', date: d })} />
      )}

      {mode === 'day' && (
        <DayAgenda tasks={tasksByDay.get(date) ?? []} labelFor={labelFor} quickAddRef={quickAddRef} />
      )}
    </div>
  );
}

function MonthGrid({
  date,
  tasksByDay,
  colorFor,
  onPick,
}: {
  date: string;
  tasksByDay: Map<string, Task[]>;
  colorFor: (task: Task) => string | undefined;
  onPick: (date: string) => void;
}) {
  const days = useMemo(() => monthGrid(date), [date]);
  const weekdayLabels = useMemo(() => weekDays(today()).map((d) => capitalize(weekdayShort(d))), []);
  const t = today();

  return (
    <div className="cal-month">
      <div className="cal-month__weekdays" aria-hidden="true">
        {weekdayLabels.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="cal-month__grid">
        {days.map((day) => {
          const tasks = (tasksByDay.get(day) ?? []).filter((task) => !task.done);
          const inMonth = isSameMonth(day, date);
          const visible = tasks.slice(0, 3);
          const overflow = tasks.length - visible.length;

          return (
            <button
              key={day}
              type="button"
              className="cal-cell"
              data-muted={!inMonth || undefined}
              data-today={day === t || undefined}
              onClick={() => onPick(day)}
              aria-label={`${describeDueFull(day)}${
                tasks.length > 0 ? `, ${tasks.length} ${tasks.length === 1 ? 'tarefa' : 'tarefas'}` : ''
              }`}
            >
              <span className="cal-cell__num">{Number(day.slice(-2))}</span>
              {tasks.length > 0 && (
                <span className="cal-cell__chips">
                  {visible.map((task) => (
                    <span key={task.id} className="cal-chip">
                      <span className="cal-chip__dot" style={{ background: colorFor(task) }} />
                      <span className="cal-chip__text">{task.title}</span>
                    </span>
                  ))}
                  {overflow > 0 && <span className="cal-chip cal-chip--more">+{overflow}</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekAgenda({
  date,
  tasksByDay,
  labelFor,
  onPick,
}: {
  date: string;
  tasksByDay: Map<string, Task[]>;
  labelFor: (listId: string) => string | undefined;
  onPick: (date: string) => void;
}) {
  const days = useMemo(() => weekDays(date), [date]);
  const t = today();

  return (
    <div className="cal-week">
      {days.map((day) => {
        const tasks = tasksByDay.get(day) ?? [];
        const pending = tasks.filter((task) => !task.done);
        const doneCount = tasks.length - pending.length;

        return (
          <section key={day} className="day-group" data-today={day === t || undefined}>
            <h2 className="day-group__head">
              <button type="button" className="day-group__link" onClick={() => onPick(day)}>
                {capitalize(weekdayShort(day))}
                <span className="day-group__date">{Number(day.slice(-2))}</span>
              </button>
            </h2>

            {pending.length === 0 ? (
              <p className="cal-week__empty">{doneCount > 0 ? 'Tudo concluído' : 'Sem tarefas'}</p>
            ) : (
              <ul className="tasks">
                {pending.map((task) => (
                  <TaskRow key={task.id} task={task} listTag={labelFor(task.listId)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function DayAgenda({
  tasks,
  labelFor,
  quickAddRef,
}: {
  tasks: Task[];
  labelFor: (listId: string) => string | undefined;
  quickAddRef: RefObject<HTMLInputElement | null>;
}) {
  const { data } = useStore();
  const inbox = data.lists.find((l) => l.isInbox);
  const pending = tasks.filter((task) => !task.done);
  const done = tasks.filter((task) => task.done);

  return (
    <div className="cal-day">
      {inbox && <QuickAdd listId={inbox.id} listName={inbox.name} inputRef={quickAddRef} />}

      {pending.length === 0 && done.length === 0 ? (
        <EmptyState illustration="day-clear" title="Nada marcado para este dia">
          Tarefas aparecem aqui quando o prazo cai neste dia. Adicione uma acima e coloque o prazo
          nos detalhes dela.
        </EmptyState>
      ) : (
        <ul className="tasks">
          {pending.map((task) => (
            <TaskRow key={task.id} task={task} listTag={labelFor(task.listId)} />
          ))}
        </ul>
      )}

      {done.length > 0 && <DoneSection tasks={done} label={`Concluídas (${done.length})`} />}
    </div>
  );
}

// --- helpers --------------------------------------------------------------

function byPriorityThenOrder(a: Task, b: Task): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
}

function colorForTask(task: Task, listById: Map<string, List>, groupById: Map<string, Group>): string | undefined {
  const list = listById.get(task.listId);
  const group = list?.groupId ? groupById.get(list.groupId) : undefined;
  return group ? `var(--g-${group.color})` : undefined;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
