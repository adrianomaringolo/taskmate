export const GROUP_COLORS = [
  'red',
  'rust',
  'amber',
  'honey',
  'lime',
  'green',
  'jade',
  'teal',
  'cyan',
  'blue',
  'cobalt',
  'indigo',
  'purple',
  'violet',
  'magenta',
  'rose',
] as const;

export type GroupColor = (typeof GROUP_COLORS)[number];

export const GROUP_COLOR_LABELS: Record<GroupColor, string> = {
  red: 'Vermelho',
  rust: 'Ferrugem',
  amber: 'Âmbar',
  honey: 'Mel',
  lime: 'Lima',
  green: 'Verde',
  jade: 'Jade',
  teal: 'Turquesa',
  cyan: 'Ciano',
  blue: 'Azul',
  cobalt: 'Cobalto',
  indigo: 'Índigo',
  purple: 'Roxo',
  violet: 'Violeta',
  magenta: 'Magenta',
  rose: 'Rosa',
};

export type Priority = 0 | 1 | 2 | 3;

/**
 * `0` only ever appears as one of four always-visible toggle segments (see
 * TaskDetail) — never as a chip, which only renders `priority > 0`. Short on
 * purpose so it doesn't wrap inside that segment the way "Sem prioridade" did.
 */
export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'Nenhuma',
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

export type RecurrenceUnit = 'day' | 'week' | 'month';

export const RECURRENCE_LABELS: Record<RecurrenceUnit, string> = {
  day: 'Todo dia',
  week: 'Toda semana',
  month: 'Todo mês',
};

export interface Recurrence {
  unit: RecurrenceUnit;
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
  /**
   * Anchored to `dueDate`, which is why it is inert without one — see
   * `advanceDue` in date.ts and the completion branch in `patchTask`.
   */
  recurrence: Recurrence | null;
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

export type CalendarMode = 'month' | 'week' | 'day';

/** What the content column is showing. */
export type View =
  | { kind: 'list'; listId: string }
  | { kind: 'today' }
  | { kind: 'upcoming' }
  | { kind: 'calendar'; mode: CalendarMode; date: string }
  | { kind: 'search'; query: string };
