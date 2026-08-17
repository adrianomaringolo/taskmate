import { useMemo } from 'react';
import { addDays, today } from '../lib/date';
import { useStore } from '../lib/store';
import { GROUP_COLORS, type View } from '../lib/types';
import { GroupNode } from './GroupNode';
import { Icon } from './Icon';
import { InlineCreate } from './InlineCreate';

interface Props {
  view: View;
  onSelect: (view: View) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ view, onSelect, open, onClose }: Props) {
  const { data, tasksByList, addGroup } = useStore();

  const counts = useMemo(() => {
    const t = today();
    const horizon = addDays(t, 7);
    let dueToday = 0;
    let overdue = 0;
    let upcoming = 0;

    for (const task of data.tasks) {
      if (task.done || !task.dueDate) continue;
      if (task.dueDate < t) overdue++;
      else if (task.dueDate === t) dueToday++;
      if (task.dueDate <= horizon) upcoming++;
    }
    return { today: dueToday + overdue, overdue, upcoming };
  }, [data.tasks]);

  const inbox = data.lists.find((l) => l.isInbox);
  const inboxPending = inbox ? (tasksByList.get(inbox.id) ?? []).filter((t) => !t.done).length : 0;

  const groups = data.groups;
  const listsOf = (groupId: string) => data.lists.filter((l) => l.groupId === groupId);

  return (
    <aside className="sidebar" data-open={open} aria-label="Navegação">
      <div className="sidebar__head">
        <p className="brand">
          <Icon name="mark" size={18} className="brand__mark" />
          Taskmate
        </p>
        <button type="button" className="btn btn--icon sidebar__close" onClick={onClose} aria-label="Fechar menu">
          <Icon name="x" />
        </button>
      </div>

      <div className="sidebar__scroll">
        <nav className="nav-section" aria-label="Visões">
          <button
            type="button"
            className="row"
            aria-current={view.kind === 'today'}
            onClick={() => onSelect({ kind: 'today' })}
          >
            <span className="row__icon">
              <Icon name="today" />
            </span>
            <span className="row__label">Hoje</span>
            {counts.today > 0 && (
              <span className={`row__count${counts.overdue > 0 ? ' row__count--overdue' : ''}`}>
                {counts.today}
              </span>
            )}
          </button>

          <button
            type="button"
            className="row"
            aria-current={view.kind === 'upcoming'}
            onClick={() => onSelect({ kind: 'upcoming' })}
          >
            <span className="row__icon">
              <Icon name="upcoming" />
            </span>
            <span className="row__label">Próximos 7 dias</span>
            {counts.upcoming > 0 && <span className="row__count">{counts.upcoming}</span>}
          </button>

          <button
            type="button"
            className="row"
            aria-current={view.kind === 'calendar'}
            onClick={() => onSelect({ kind: 'calendar', mode: 'month', date: today() })}
          >
            <span className="row__icon">
              <Icon name="calendar" />
            </span>
            <span className="row__label">Calendário</span>
          </button>

          {inbox && (
            <button
              type="button"
              className="row"
              aria-current={view.kind === 'list' && view.listId === inbox.id}
              onClick={() => onSelect({ kind: 'list', listId: inbox.id })}
            >
              <span className="row__icon">
                <Icon name="inbox" />
              </span>
              <span className="row__label">{inbox.name}</span>
              {inboxPending > 0 && <span className="row__count">{inboxPending}</span>}
            </button>
          )}
        </nav>

        <div className="nav-section nav-section--groups">
          <div className="nav-head">
            <span>Grupos</span>
            <span className="nav-head__spacer" />
            <InlineCreate
              compact
              label="Novo grupo"
              placeholder="Nome do grupo"
              onCreate={async (name) => {
                // Rotating the default keeps new groups visually distinct
                // without asking the user to pick a colour up front.
                await addGroup(name, GROUP_COLORS[groups.length % GROUP_COLORS.length]!);
              }}
            />
          </div>

          {groups.length === 0 ? (
            <p className="nav-empty">
              Grupos separam contextos — Casa, um cliente, estudos. Crie o primeiro quando a Entrada
              começar a misturar assuntos.
            </p>
          ) : (
            groups.map((group, i) => (
              <GroupNode
                key={group.id}
                group={group}
                lists={listsOf(group.id)}
                index={i}
                total={groups.length}
                view={view}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
