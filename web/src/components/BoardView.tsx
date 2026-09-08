import { useState, type CSSProperties, type DragEvent } from 'react';
import { parseCapture } from '../lib/parse';
import { useStore } from '../lib/store';
import type { List, Task, View } from '../lib/types';
import { DoneSection } from './ContentView';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { InlineCreate } from './InlineCreate';
import { InlineText } from './InlineText';
import { TaskRow } from './TaskRow';

type BoardV = Extract<View, { kind: 'board' }>;

interface Props {
  view: BoardV;
  onSelect: (view: View) => void;
  /** Span the full content width instead of the centred 64rem column. */
  full: boolean;
  onToggleFull: () => void;
}

/**
 * The pointer's current position during a card drag. `overId` is null while the
 * pointer is over a column's empty space rather than a specific card.
 */
type Drag = {
  id: string;
  overListId: string;
  overId: string | null;
  edge: 'before' | 'after';
};

/**
 * Where a single list is one column of rows, the board turns a whole group
 * sideways: every list in the group becomes a column, and its open tasks become
 * cards. Dragging a card across columns is the point — it calls the same
 * `moveTask` a within-list reorder does, just aimed at another list.
 */
export function BoardView({ view, onSelect, full, onToggleFull }: Props) {
  const { data, groupById, tasksByList, moveTask, addList } = useStore();
  const [drag, setDrag] = useState<Drag | null>(null);

  const group = groupById.get(view.groupId);
  if (!group) {
    return (
      <div className="main__inner">
        <EmptyState
          illustration="not-found"
          level={1}
          title="Esse grupo não existe mais"
          action={
            <button type="button" className="btn btn--primary" onClick={() => onSelect({ kind: 'today' })}>
              Ir para Hoje
            </button>
          }
        >
          Ele foi excluído — aqui, em outra aba, ou em outro dispositivo.
        </EmptyState>
      </div>
    );
  }

  const lists = data.lists.filter((l) => l.groupId === group.id);
  const openTotal = lists.reduce(
    (sum, l) => sum + (tasksByList.get(l.id) ?? []).filter((t) => !t.done).length,
    0
  );

  const commitDrop = () => {
    if (!drag) return;
    const bucket = tasksByList.get(drag.overListId) ?? [];
    const rest = bucket.filter((t) => t.id !== drag.id);
    let index = rest.length;
    if (drag.overId) {
      const at = rest.findIndex((t) => t.id === drag.overId);
      if (at !== -1) index = at + (drag.edge === 'after' ? 1 : 0);
    }
    void moveTask(drag.id, drag.overListId, index);
    setDrag(null);
  };

  const newColumn = (
    <InlineCreate
      label="Nova coluna"
      placeholder="Nome da coluna"
      onCreate={async (name) => {
        await addList(group.id, name);
      }}
    />
  );

  return (
    <div
      className={`main__inner main__inner--wide${full ? ' main__inner--full' : ''}`}
      style={{ '--group-color': `var(--g-${group.color})` } as CSSProperties}
    >
      <header className="view-head">
        <p className="view-head__crumb">
          <span className="view-head__crumb-dot" />
          {group.name}
        </p>
        <div className="view-head__row">
          <h1 className="view-head__title">Quadro</h1>
          <button
            type="button"
            className="btn btn--icon board-full-toggle"
            aria-pressed={full}
            aria-label={full ? 'Voltar à largura padrão' : 'Expandir para a largura total'}
            title={full ? 'Largura padrão' : 'Largura total'}
            onClick={onToggleFull}
          >
            <Icon name="expandWide" />
          </button>
        </div>
        <p className="view-head__sub">
          {lists.length === 0
            ? 'Este grupo ainda não tem listas.'
            : `${lists.length} ${lists.length === 1 ? 'lista' : 'listas'}` +
              (openTotal > 0
                ? ` · ${openTotal} ${openTotal === 1 ? 'tarefa aberta' : 'tarefas abertas'}`
                : '')}
        </p>
      </header>

      {lists.length === 0 ? (
        <EmptyState illustration="list-empty" title="Nenhuma coluna ainda">
          Cada lista do grupo vira uma coluna do quadro. Crie a primeira abaixo — por exemplo “A
          fazer”, “Fazendo”, “Feito”.
          <span className="board-empty__add">{newColumn}</span>
        </EmptyState>
      ) : (
        <div className="board" role="list" aria-label={`Quadro de ${group.name}`}>
          {lists.map((list) => (
            <Column
              key={list.id}
              list={list}
              tasks={tasksByList.get(list.id) ?? []}
              drag={drag}
              setDrag={setDrag}
              onCommitDrop={commitDrop}
            />
          ))}

          <div className="board-col board-col--new">{newColumn}</div>
        </div>
      )}
    </div>
  );
}

function Column({
  list,
  tasks,
  drag,
  setDrag,
  onCommitDrop,
}: {
  list: List;
  tasks: Task[];
  drag: Drag | null;
  setDrag: (next: Drag | null | ((prev: Drag | null) => Drag | null)) => void;
  onCommitDrop: () => void;
}) {
  const { addTask, patchList, moveTask } = useStore();

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  // Keyboard parity for the drag: step over the neighbouring *pending* card,
  // then translate that back to an index in the full bucket — completed cards
  // live in their own collapsed section and must not be counted. Mirrors
  // ContentView's `nudge`.
  const nudge = (task: Task, delta: -1 | 1) => {
    const at = pending.findIndex((t) => t.id === task.id);
    const neighbour = pending[at + delta];
    if (!neighbour) return;
    void moveTask(task.id, list.id, tasks.findIndex((t) => t.id === neighbour.id));
  };

  const overEmpty = !!drag && drag.overListId === list.id && drag.overId === null;

  const onColumnDragOver = (e: DragEvent) => {
    if (!drag) return;
    // A card handles its own dragover; only react to the gaps around them.
    if ((e.target as HTMLElement).closest('.task')) return;
    e.preventDefault();
    setDrag((d) => (d ? { ...d, overListId: list.id, overId: null } : d));
  };

  return (
    <section
      className="board-col"
      role="listitem"
      aria-label={list.name}
      data-drop={overEmpty || undefined}
      onDragOver={drag ? onColumnDragOver : undefined}
      onDrop={
        drag
          ? (e) => {
              e.preventDefault();
              onCommitDrop();
            }
          : undefined
      }
    >
      <header className="board-col__head">
        <InlineText
          className="board-col__name"
          value={list.name}
          ariaLabel="Nome da lista"
          onCommit={(name) => void patchList(list.id, { name })}
        />
        {pending.length > 0 && <span className="row__count">{pending.length}</span>}
      </header>

      <ul className="tasks board-col__cards">
        {pending.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            reorderable
            dragging={drag?.id === task.id}
            dropEdge={drag && drag.overId === task.id && drag.id !== task.id ? drag.edge : null}
            onDragStart={() =>
              setDrag({ id: task.id, overListId: list.id, overId: task.id, edge: 'before' })
            }
            onDragEnd={() => setDrag(null)}
            onDragOver={(edge) =>
              setDrag((d) => (d ? { ...d, overListId: list.id, overId: task.id, edge } : d))
            }
            onDrop={onCommitDrop}
            onNudge={(delta) => nudge(task, delta)}
          />
        ))}
        {pending.length === 0 && <li className="board-col__empty">Sem tarefas abertas</li>}
      </ul>

      <div className="board-col__add">
        <InlineCreate
          label={`Adicionar tarefa em ${list.name}`}
          placeholder="Nova tarefa"
          maxLength={300}
          onCreate={async (text) => {
            const { title, dueDate, priority, recurrence } = parseCapture(text);
            if (!title) return;
            await addTask(list.id, title, { dueDate: dueDate ?? null, priority, recurrence });
          }}
        />
      </div>

      {done.length > 0 && <DoneSection tasks={done} label={`Concluídas (${done.length})`} />}
    </section>
  );
}
