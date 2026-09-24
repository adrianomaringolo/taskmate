import type { ReactNode } from 'react';
import { useTaskDrop } from '../lib/taskDrag';

interface Props {
  listId: string;
  name: string;
  current: boolean;
  pending: number;
  icon?: ReactNode;
  onClick: () => void;
}

/** A list in the sidebar: opens it on click, and takes a task dropped on it. */
export function ListRowButton({ listId, name, current, pending, icon, onClick }: Props) {
  const drop = useTaskDrop(listId, name);
  return (
    <button
      type="button"
      className="row"
      aria-current={current}
      data-drop-target={drop.over || undefined}
      onClick={onClick}
      {...drop.props}
    >
      {icon && <span className="row__icon">{icon}</span>}
      <span className="row__label">{name}</span>
      {pending > 0 && <span className="row__count">{pending}</span>}
    </button>
  );
}
