import { useCallback, useState, type CSSProperties, type RefObject } from 'react';
import { addDays, describeDue, describeDueFull, fromKey, today } from '../lib/date';
import { useStore } from '../lib/store';
import type { List, Task, View } from '../lib/types';
import { CalendarView } from './CalendarView';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { InlineText } from './InlineText';
import { Menu } from './Menu';
import { QuickAdd } from './QuickAdd';
import { TaskRow } from './TaskRow';

interface Props {
  view: View;
  onSelect: (view: View) => void;
  quickAddRef: RefObject<HTMLInputElement | null>;
}

export function ContentView(props: Props) {
  const { status, loadError } = useStore();

  if (status === 'loading') return <LoadingState />;
  if (status === 'error')
    return (
      <div className="main__inner">
        <EmptyState
          level={1}
          title="Não consegui abrir seus dados"
          action={
            <button type="button" className="btn btn--primary" onClick={() => location.reload()}>
              Recarregar a página
            </button>
          }
        >
          {loadError ?? 'O armazenamento local do navegador não respondeu.'} Isso costuma ser
          navegação privada ou armazenamento bloqueado para este site.
        </EmptyState>
      </div>
    );

  return <ReadyState {...props} />;
}

function ReadyState({ view, onSelect, quickAddRef }: Props) {
  const { data, listById, groupById } = useStore();

  /**
   * Declared with useCallback and passed as a prop — never as a component
   * defined inside this function. An inline component declaration is a fresh
   * component *type* on every render, so React unmounts and remounts the whole
   * subtree each time: open detail panels snap shut and half-typed edits vanish.
   */
  const labelFor = useCallback(
    (listId: string): string | undefined => {
      const list = listById.get(listId);
      if (!list) return undefined;
      const group = list.groupId ? groupById.get(list.groupId) : undefined;
      return group ? `${group.name} · ${list.name}` : list.name;
    },
    [listById, groupById]
  );

  if (view.kind === 'list') {
    const list = listById.get(view.listId);
    if (!list) return <MissingList onSelect={onSelect} />;
    return <ListView list={list} quickAddRef={quickAddRef} />;
  }

  if (view.kind === 'calendar') {
    return <CalendarView view={view} onSelect={onSelect} quickAddRef={quickAddRef} labelFor={labelFor} />;
  }

  const inbox = data.lists.find((l) => l.isInbox);
  const t = today();

  if (view.kind === 'search') {
    const q = normalize(view.query);
    const matches = q
      ? data.tasks.filter(
          (task) => normalize(task.title).includes(q) || normalize(task.notes).includes(q)
        )
      : [];

    return (
      <div className="main__inner">
        <header className="view-head">
          <p className="view-head__crumb">Busca</p>
          <h1 className="view-head__title">{view.query ? `“${view.query}”` : 'Buscar tarefas'}</h1>
          <p className="view-head__sub">
            {!view.query
              ? 'Digite acima para procurar em títulos e notas.'
              : `${matches.length} ${matches.length === 1 ? 'resultado' : 'resultados'}`}
          </p>
        </header>

        {view.query && matches.length === 0 ? (
          <EmptyState illustration="not-found" title="Nada encontrado">
            A busca cobre títulos e notas, sem diferenciar acentos ou maiúsculas. Talvez a tarefa
            esteja com outro nome.
          </EmptyState>
        ) : (
          <FlatList tasks={sortByDue(matches)} labelFor={labelFor} />
        )}
      </div>
    );
  }

  if (view.kind === 'today') {
    const due = data.tasks.filter((task) => !task.done && task.dueDate && task.dueDate <= t);
    const doneToday = data.tasks.filter((task) => task.done && task.doneAt?.startsWith(t));
    const overdue = due.filter((task) => task.dueDate! < t);

    return (
      <div className="main__inner">
        <header className="view-head">
          <p className="view-head__crumb">
            <Icon name="today" size={13} />
            {capitalize(describeDueFull(t))}
          </p>
          <h1 className="view-head__title">Hoje</h1>
          <p className="view-head__sub">
            {due.length === 0
              ? 'Nada com prazo para hoje.'
              : `${due.length} ${due.length === 1 ? 'tarefa' : 'tarefas'}${
                  overdue.length > 0 ? ` · ${overdue.length} em atraso` : ''
                }`}
          </p>
        </header>

        {inbox && <QuickAdd listId={inbox.id} listName={inbox.name} inputRef={quickAddRef} />}

        {due.length === 0 ? (
          <EmptyState
            illustration="day-clear"
            title="Hoje está limpo"
            action={
              <button type="button" className="btn btn--ghost" onClick={() => onSelect({ kind: 'upcoming' })}>
                Ver os próximos 7 dias
              </button>
            }
          >
            Tarefas aparecem aqui quando têm prazo para hoje ou já passaram dele. Sem prazo, elas
            ficam nas suas listas.
          </EmptyState>
        ) : (
          <FlatList tasks={sortByDue(due)} labelFor={labelFor} />
        )}

        {doneToday.length > 0 && (
          <DoneSection tasks={doneToday} label={`Concluídas hoje (${doneToday.length})`} />
        )}
      </div>
    );
  }

  // upcoming
  const horizon = addDays(t, 7);
  const upcoming = data.tasks.filter((task) => !task.done && task.dueDate && task.dueDate <= horizon);
  const byDay = new Map<string, Task[]>();
  for (const task of sortByDue(upcoming)) {
    const key = task.dueDate! < t ? 'overdue' : task.dueDate!;
    const bucket = byDay.get(key);
    if (bucket) bucket.push(task);
    else byDay.set(key, [task]);
  }

  return (
    <div className="main__inner">
      <header className="view-head">
        <p className="view-head__crumb">
          <Icon name="upcoming" size={13} />
          Até {describeDueFull(horizon)}
        </p>
        <h1 className="view-head__title">Próximos 7 dias</h1>
        <p className="view-head__sub">
          {upcoming.length === 0
            ? 'Nenhum prazo na semana.'
            : `${upcoming.length} ${upcoming.length === 1 ? 'tarefa' : 'tarefas'}`}
        </p>
      </header>

      {inbox && <QuickAdd listId={inbox.id} listName={inbox.name} inputRef={quickAddRef} />}

      {upcoming.length === 0 ? (
        <EmptyState illustration="week-free" title="A semana está livre">
          Coloque prazo numa tarefa pelos detalhes dela e ela aparece aqui no dia certo.
        </EmptyState>
      ) : (
        [...byDay.entries()].map(([key, tasks]) => (
          <section key={key} className="day-group">
            <h2 className="day-group__head">
              {key === 'overdue' ? (
                <>
                  <Icon name="alert" size={13} />
                  Em atraso
                </>
              ) : (
                <>
                  {capitalize(describeDue(key))}
                  <span className="day-group__date">{shortDate(key)}</span>
                </>
              )}
            </h2>
            <FlatList tasks={tasks} labelFor={labelFor} />
          </section>
        ))
      )}
    </div>
  );
}

/** Cross-list views: no manual order, so every row carries its list name. */
function FlatList({
  tasks,
  labelFor,
}: {
  tasks: Task[];
  labelFor: (listId: string) => string | undefined;
}) {
  return (
    <ul className="tasks">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} listTag={labelFor(task.listId)} />
      ))}
    </ul>
  );
}

/** A single list: the only view where manual order exists. */
function ListView({ list, quickAddRef }: { list: List; quickAddRef: RefObject<HTMLInputElement | null> }) {
  const { tasksByList, groupById, patchList, clearDone, moveTask } = useStore();
  const [drag, setDrag] = useState<{ id: string; overId: string; edge: 'before' | 'after' } | null>(null);

  const all = tasksByList.get(list.id) ?? [];
  const pending = all.filter((t) => !t.done);
  const done = all.filter((t) => t.done);
  const group = list.groupId ? groupById.get(list.groupId) : undefined;

  /**
   * Steps over the neighbour the user can actually see. Moving by ±1 in the
   * full list looks like nothing happened whenever a completed task occupies
   * the adjacent slot, since completed rows live in their own collapsed
   * section — so the target is the neighbouring *pending* row's real index.
   */
  const nudge = (task: Task, delta: -1 | 1) => {
    const at = pending.findIndex((t) => t.id === task.id);
    const neighbour = pending[at + delta];
    if (!neighbour) return;
    void moveTask(task.id, list.id, all.findIndex((t) => t.id === neighbour.id));
  };

  const commitDrop = () => {
    if (!drag) return;
    const rest = all.filter((t) => t.id !== drag.id);
    const at = rest.findIndex((t) => t.id === drag.overId);
    if (at !== -1) void moveTask(drag.id, list.id, at + (drag.edge === 'after' ? 1 : 0));
    setDrag(null);
  };

  return (
    <div
      className="main__inner"
      style={group ? ({ '--group-color': `var(--g-${group.color})` } as CSSProperties) : undefined}
    >
      <header className="view-head">
        <p className="view-head__crumb">
          {group ? (
            <>
              <span className="view-head__crumb-dot" />
              {group.name}
            </>
          ) : (
            <>
              <Icon name="inbox" size={13} />
              Captura rápida, sem endereço ainda
            </>
          )}
        </p>

        <div className="view-head__row">
          <h1 className="view-head__title">
            {list.isInbox ? (
              list.name
            ) : (
              <InlineText
                className="title-input"
                value={list.name}
                ariaLabel="Nome da lista"
                onCommit={(name) => void patchList(list.id, { name })}
              />
            )}
          </h1>

          {done.length > 0 && (
            <Menu label="Ações da lista" triggerContent={<Icon name="more" />}>
              {(close) => (
                <button
                  type="button"
                  className="menu__item"
                  onClick={() => {
                    void clearDone(list.id);
                    close();
                  }}
                >
                  <Icon name="trash" />
                  Limpar {done.length} {done.length === 1 ? 'concluída' : 'concluídas'}
                </button>
              )}
            </Menu>
          )}
        </div>

        {/* Silent when the empty state below is doing the talking — saying
            "lista vazia" and then "nada aqui" is the same sentence twice. */}
        {(pending.length > 0 || done.length > 0) && (
          <p className="view-head__sub">
            {pending.length === 0
              ? 'Tudo concluído aqui.'
              : `${pending.length} ${pending.length === 1 ? 'tarefa aberta' : 'tarefas abertas'}`}
          </p>
        )}
      </header>

      <QuickAdd listId={list.id} listName={list.name} inputRef={quickAddRef} />

      {pending.length === 0 && done.length === 0 ? (
        <EmptyState
          illustration={list.isInbox ? 'inbox-empty' : 'list-empty'}
          title={list.isInbox ? 'Nada na Entrada' : `“${list.name}” está vazia`}
        >
          {list.isInbox
            ? 'Use o campo acima para tirar algo da cabeça. Depois arraste para a lista certa — ou deixe aqui mesmo.'
            : 'Escreva a primeira tarefa no campo acima. Prazo e prioridade entram depois, nos detalhes.'}
        </EmptyState>
      ) : (
        <ul className="tasks">
          {pending.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              reorderable
              dragging={drag?.id === task.id}
              dropEdge={drag && drag.overId === task.id && drag.id !== task.id ? drag.edge : null}
              onDragStart={() => setDrag({ id: task.id, overId: task.id, edge: 'before' })}
              onDragEnd={() => setDrag(null)}
              onDragOver={(edge) => setDrag((d) => (d ? { ...d, overId: task.id, edge } : d))}
              onDrop={commitDrop}
              onNudge={(delta) => nudge(task, delta)}
            />
          ))}
        </ul>
      )}

      {done.length > 0 && <DoneSection tasks={done} label={`Concluídas (${done.length})`} />}
    </div>
  );
}

export function DoneSection({ tasks, label }: { tasks: Task[]; label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="done-section">
      <button
        type="button"
        className="done-section__head"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="chevron" size={12} className="done-section__chevron" />
        {label}
      </button>
      {open && (
        <ul className="tasks">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </section>
  );
}

function MissingList({ onSelect }: { onSelect: (view: View) => void }) {
  return (
    <div className="main__inner">
      <EmptyState
        illustration="not-found"
        level={1}
        title="Essa lista não existe mais"
        action={
          <button type="button" className="btn btn--primary" onClick={() => onSelect({ kind: 'today' })}>
            Ir para Hoje
          </button>
        }
      >
        Ela foi excluída — aqui, em outra aba, ou em outro dispositivo.
      </EmptyState>
    </div>
  );
}

/** Skeletons in the shape of the real rows, not a spinner in the void. */
function LoadingState() {
  return (
    <div className="main__inner" aria-busy="true" aria-label="Carregando">
      <div className="skeleton" style={{ width: '9rem', height: '0.8rem', marginBottom: '0.75rem' }} />
      <div className="skeleton" style={{ width: '14rem', height: '1.6rem', marginBottom: '2rem' }} />
      <div className="skeleton" style={{ width: '100%', height: '46px', marginBottom: '1rem' }} />
      {[92, 74, 84, 60].map((w, i) => (
        <div className="skeleton-row" key={i}>
          <div className="skeleton" style={{ width: 18, height: 18, borderRadius: 5, flex: 'none' }} />
          <div className="skeleton" style={{ width: `${w}%`, height: '0.85rem' }} />
        </div>
      ))}
    </div>
  );
}

// --- helpers ------------------------------------------------------------

/** Due date first, then priority — the order triage actually wants. */
function sortByDue(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ad = a.dueDate ?? '9999-99-99';
    const bd = b.dueDate ?? '9999-99-99';
    if (ad !== bd) return ad < bd ? -1 : 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
  });
}

/** Accent- and case-insensitive, so "acao" finds "ação". */
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const shortDate = (key: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(fromKey(key));
