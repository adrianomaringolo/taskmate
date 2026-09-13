import { useMemo } from 'react';
import { daysSince, isOverdue } from '../lib/date';
import { useStore } from '../lib/store';
import type { Group, List, View } from '../lib/types';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';
import { TaskRow } from './TaskRow';

interface Props {
  onSelect: (view: View) => void;
  labelFor: (listId: string) => string | undefined;
}

/** A group counts as parado once none of its open tasks moved in this long. */
const STALE_GROUP_DAYS = 30;
/** How many rows a ranked section shows before it just says "the rest". */
const RANK_LIMIT = 5;

/**
 * Not a dashboard — see PRODUCT.md's anti-references, "métricas grandes no
 * topo" is explicitly what this app refuses to be. No charts, no totals as
 * decoration, no counting what is already done (`done` tasks never appear
 * here at all). Every section is a question worth asking during triage, and
 * every row is one click from being acted on. A section with nothing to say
 * simply does not render — silence is the default, per the same principle
 * that governs every other empty state in the app.
 */
export function InsightsView({ onSelect, labelFor }: Props) {
  const { data, listById } = useStore();

  const open = useMemo(() => data.tasks.filter((t) => !t.done), [data.tasks]);

  const overdueByList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of open) {
      if (t.dueDate && isOverdue(t.dueDate)) counts.set(t.listId, (counts.get(t.listId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([listId, count]) => [listById.get(listId), count] as const)
      .filter((row): row is [List, number] => row[0] !== undefined)
      .sort((a, b) => b[1] - a[1]);
  }, [open, listById]);

  const highNoDate = useMemo(
    () =>
      open
        .filter((t) => t.priority === 3 && !t.dueDate)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [open]
  );

  // Per group: how many open tasks it holds, and the most recent of their
  // `updatedAt` — the same signal a "last activity" column would show, just
  // never displayed as one.
  const groupActivity = useMemo(() => {
    const stats = new Map<string, { count: number; lastActivity: string }>();
    for (const t of open) {
      const groupId = listById.get(t.listId)?.groupId;
      if (!groupId) continue;
      const s = stats.get(groupId);
      if (!s) stats.set(groupId, { count: 1, lastActivity: t.updatedAt });
      else {
        s.count++;
        if (t.updatedAt > s.lastActivity) s.lastActivity = t.updatedAt;
      }
    }
    return stats;
  }, [open, listById]);

  const staleGroups = useMemo(() => {
    return data.groups
      .map((g) => {
        const s = groupActivity.get(g.id);
        if (!s) return null;
        const days = daysSince(s.lastActivity);
        return days >= STALE_GROUP_DAYS ? ([g, days, s.count] as const) : null;
      })
      .filter((row): row is readonly [Group, number, number] => row !== null)
      .sort((a, b) => b[1] - a[1]);
  }, [data.groups, groupActivity]);

  const hasAnything = overdueByList.length > 0 || highNoDate.length > 0 || staleGroups.length > 0;

  return (
    <div className="main__inner">
      <header className="view-head">
        <p className="view-head__crumb">
          <Icon name="compass" size={13} />
          Fora do fluxo normal
        </p>
        <h1 className="view-head__title">Insights</h1>
        <p className="view-head__sub">
          {hasAnything ? 'O que vale olhar antes de seguir triando.' : 'Nada chamando atenção agora.'}
        </p>
      </header>

      {!hasAnything ? (
        <EmptyState illustration="day-clear" title="Nada fora do lugar">
          Sem atraso concentrado, sem tarefa importante à deriva, sem grupo esquecido. Volte aqui
          de vez em quando — o quadro muda sozinho conforme as tarefas se movem.
        </EmptyState>
      ) : (
        <div className="insights">
          {overdueByList.length > 0 && (
            <section className="insight">
              <h2 className="insight__title">Atraso concentra-se em</h2>
              <p className="insight__hint">As listas com mais tarefas vencidas agora.</p>
              <ul className="insight__ranked">
                {overdueByList.slice(0, RANK_LIMIT).map(([list, count]) => (
                  <li key={list.id}>
                    <button
                      type="button"
                      className="insight__rank-row"
                      onClick={() => onSelect({ kind: 'list', listId: list.id })}
                    >
                      <span className="insight__rank-label">{labelFor(list.id) ?? list.name}</span>
                      <span className="row__count row__count--overdue">{count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {highNoDate.length > 0 && (
            <section className="insight">
              <h2 className="insight__title">Alta prioridade, sem prazo</h2>
              <p className="insight__hint">
                Ficam de fora de Hoje e Próximos 7 dias até ganharem uma data.
              </p>
              <ul className="tasks">
                {highNoDate.map((task) => (
                  <TaskRow key={task.id} task={task} listTag={labelFor(task.listId)} quickSchedule />
                ))}
              </ul>
            </section>
          )}

          {staleGroups.length > 0 && (
            <section className="insight">
              <h2 className="insight__title">Grupos parados</h2>
              <p className="insight__hint">
                Nenhuma tarefa aberta se moveu nos últimos {STALE_GROUP_DAYS} dias.
              </p>
              <ul className="insight__ranked">
                {staleGroups.slice(0, RANK_LIMIT).map(([group, days, count]) => (
                  <li key={group.id}>
                    <button
                      type="button"
                      className="insight__rank-row"
                      onClick={() => onSelect({ kind: 'board', groupId: group.id })}
                    >
                      <span className="insight__rank-label">{group.name}</span>
                      <span className="insight__rank-meta">
                        há {days} dias · {count} {count === 1 ? 'aberta' : 'abertas'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
