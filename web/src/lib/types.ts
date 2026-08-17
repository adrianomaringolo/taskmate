export const GROUP_COLORS = [
  'honey',
  'rust',
  'rose',
  'violet',
  'indigo',
  'blue',
  'teal',
  'green',
] as const;

export type GroupColor = (typeof GROUP_COLORS)[number];

export const GROUP_COLOR_LABELS: Record<GroupColor, string> = {
  honey: 'Mel',
  rust: 'Ferrugem',
  rose: 'Rosa',
  violet: 'Violeta',
  indigo: 'Índigo',
  blue: 'Azul',
  teal: 'Turquesa',
  green: 'Verde',
};

export type Priority = 0 | 1 | 2 | 3;

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'Sem prioridade',
  1: 'Baixa',
  2: 'Média',
  3: 'Alta',
};

/**
 * Ordering is a **fractional index** (`"a0"`, `"a0V"`, `"a1"`) rather than an
 * integer position, because integers cannot merge. Inserting between two rows
 * with integer positions means renumbering the neighbours, and two devices
 * renumbering the same list offline produce contradictory rewrites that a CRDT
 * has no way to reconcile. A fractional key is written once, by one device, and
 * never touches its neighbours — so concurrent inserts and moves simply coexist
 * and sort deterministically.
 */
export type Order = string;

/**
 * Tombstone. Deleting a key outright in a CRDT lets the row come back: a device
 * that edited it concurrently re-creates the fields it touched, leaving a
 * half-resurrected ghost. Marking it dead instead is the only safe delete, and
 * it also gives the undo window somewhere to live.
 */
export type Tombstone = string | null;

export interface Group {
  id: string;
  name: string;
  color: GroupColor;
  order: Order;
  createdAt: string;
  updatedAt: string;
  deletedAt: Tombstone;
}

export interface List {
  id: string;
  /** null only for the inbox, which sits above the group tree. */
  groupId: string | null;
  name: string;
  order: Order;
  isInbox: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: Tombstone;
}

export interface Task {
  id: string;
  listId: string;
  title: string;
  notes: string;
  done: boolean;
  doneAt: string | null;
  /** `YYYY-MM-DD` — a calendar day, never an instant. */
  dueDate: string | null;
  priority: Priority;
  order: Order;
  createdAt: string;
  updatedAt: string;
  deletedAt: Tombstone;
}

/** The live projection the UI renders: tombstones filtered out, sorted. */
export interface AppState {
  groups: Group[];
  lists: List[];
  tasks: Task[];
}

/** What the content column is showing. */
export type View =
  | { kind: 'list'; listId: string }
  | { kind: 'today' }
  | { kind: 'upcoming' }
  | { kind: 'search'; query: string };
