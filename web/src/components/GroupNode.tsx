import { useState, type CSSProperties } from 'react';
import { useStore } from '../lib/store';
import { GROUP_COLOR_LABELS, GROUP_COLORS, type Group, type List, type View } from '../lib/types';
import { Icon } from './Icon';
import { InlineCreate } from './InlineCreate';
import { InlineText } from './InlineText';
import { Menu } from './Menu';

interface Props {
  group: Group;
  lists: List[];
  index: number;
  total: number;
  view: View;
  onSelect: (view: View) => void;
}

export function GroupNode({ group, lists, index, total, view, onSelect }: Props) {
  const {
    tasksByList,
    patchGroup,
    removeGroup,
    addList,
    moveGroup,
    moveList,
    removeList,
    collapsed,
    toggleCollapsed,
  } = useStore();
  const [renaming, setRenaming] = useState(false);

  const open = !collapsed.has(group.id);
  const bodyId = `group-body-${group.id}`;

  const pendingIn = (listId: string) =>
    (tasksByList.get(listId) ?? []).filter((t) => !t.done).length;

  const totalPending = lists.reduce((sum, l) => sum + pendingIn(l.id), 0);

  return (
    <div className="group" style={{ '--group-color': `var(--g-${group.color})` } as CSSProperties}>
      <div className="group__head">
        {renaming ? (
          <InlineText
            className="input input--inline"
            value={group.name}
            ariaLabel="Nome do grupo"
            onCommit={(name) => {
              void patchGroup(group.id, { name });
              setRenaming(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="group__toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => toggleCollapsed(group.id)}
          >
            <Icon name="chevron" size={12} className="group__chevron" />
            <span className="group__dot" />
            <span className="group__name">{group.name}</span>
            {!open && totalPending > 0 && <span className="row__count">{totalPending}</span>}
          </button>
        )}

        <button
          type="button"
          className="btn btn--icon group__board"
          aria-label={`Ver ${group.name} como quadro`}
          title="Ver como quadro"
          aria-current={view.kind === 'board' && view.groupId === group.id}
          onClick={() => onSelect({ kind: 'board', groupId: group.id })}
        >
          <Icon name="columns" />
        </button>

        <Menu label={`Ações do grupo ${group.name}`} triggerContent={<Icon name="more" />}>
          {(close) => (
            <GroupMenu
              group={group}
              index={index}
              total={total}
              hasLists={lists.length > 0}
              onRename={() => {
                setRenaming(true);
                close();
              }}
              onColor={(color) => void patchGroup(group.id, { color })}
              onMove={(to) => {
                void moveGroup(group.id, to);
                close();
              }}
              onDelete={() => {
                void removeGroup(group.id);
                close();
              }}
            />
          )}
        </Menu>
      </div>

      <div className="group__body" id={bodyId} data-open={open} role="group" aria-label={group.name}>
        <div>
          <div className="group__lists">
            {lists.map((list, i) => {
              const pending = pendingIn(list.id);
              const current = view.kind === 'list' && view.listId === list.id;
              return (
                <div key={list.id} className="list-row">
                  <button
                    type="button"
                    className="row"
                    aria-current={current}
                    onClick={() => onSelect({ kind: 'list', listId: list.id })}
                  >
                    <span className="row__label">{list.name}</span>
                    {pending > 0 && <span className="row__count">{pending}</span>}
                  </button>
                  <Menu
                    label={`Ações da lista ${list.name}`}
                    triggerContent={<Icon name="more" />}
                    triggerClassName="btn btn--icon list-row__menu"
                  >
                    {(close) => (
                      <ListMenu
                        index={i}
                        total={lists.length}
                        onMove={(to) => {
                          void moveList(list.id, group.id, to);
                          close();
                        }}
                        onDelete={() => {
                          void removeList(list.id);
                          close();
                        }}
                      />
                    )}
                  </Menu>
                </div>
              );
            })}

            <InlineCreate
              label="Nova lista"
              placeholder="Nome da lista"
              onCreate={async (name) => {
                await addList(group.id, name);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupMenu({
  group,
  index,
  total,
  hasLists,
  onRename,
  onColor,
  onMove,
  onDelete,
}: {
  group: Group;
  index: number;
  total: number;
  hasLists: boolean;
  onRename: () => void;
  onColor: (color: (typeof GROUP_COLORS)[number]) => void;
  onMove: (index: number) => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="confirm">
        {/* The confirm stays even though undo now exists: it stops the mis-click,
            while undo covers the change of mind. Claiming it is irreversible
            would be a lie, so the copy says what actually happens. */}
        <p className="confirm__text">
          Excluir <strong>{group.name}</strong>
          {hasLists ? ' leva também as listas dentro dele e suas tarefas.' : '.'} Dá para desfazer
          logo depois.
        </p>
        <div className="confirm__actions">
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setConfirming(false)}>
            Manter
          </button>
          <button type="button" className="btn btn--sm btn--danger" onClick={onDelete}>
            Excluir
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="menu__item" onClick={onRename}>
        Renomear
      </button>
      <button
        type="button"
        className="menu__item"
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        Mover para cima
      </button>
      <button
        type="button"
        className="menu__item"
        disabled={index === total - 1}
        onClick={() => onMove(index + 1)}
      >
        Mover para baixo
      </button>

      <hr className="menu__sep" />
      <p className="menu__label">Cor</p>
      <div className="swatches">
        {GROUP_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            style={{ '--swatch': `var(--g-${color})` } as CSSProperties}
            aria-pressed={group.color === color}
            aria-label={GROUP_COLOR_LABELS[color]}
            title={GROUP_COLOR_LABELS[color]}
            onClick={() => onColor(color)}
          >
            <span className="swatch__dot" />
          </button>
        ))}
      </div>

      <hr className="menu__sep" />
      <button type="button" className="menu__item menu__item--danger" onClick={() => setConfirming(true)}>
        <Icon name="trash" />
        Excluir grupo
      </button>
    </>
  );
}

function ListMenu({
  index,
  total,
  onMove,
  onDelete,
}: {
  index: number;
  total: number;
  onMove: (index: number) => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="confirm">
        <p className="confirm__text">
          Excluir a lista leva as tarefas dentro dela. Dá para desfazer logo depois.
        </p>
        <div className="confirm__actions">
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setConfirming(false)}>
            Manter
          </button>
          <button type="button" className="btn btn--sm btn--danger" onClick={onDelete}>
            Excluir
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="menu__item" disabled={index === 0} onClick={() => onMove(index - 1)}>
        Mover para cima
      </button>
      <button
        type="button"
        className="menu__item"
        disabled={index === total - 1}
        onClick={() => onMove(index + 1)}
      >
        Mover para baixo
      </button>
      <hr className="menu__sep" />
      <button type="button" className="menu__item menu__item--danger" onClick={() => setConfirming(true)}>
        <Icon name="trash" />
        Excluir lista
      </button>
    </>
  );
}
