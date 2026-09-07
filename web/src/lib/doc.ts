import * as A from '@automerge/automerge';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import { advanceDue, today } from './date';
import type {
  AppState,
  Group,
  GroupColor,
  List,
  Order,
  Priority,
  Recurrence,
  Task,
} from './types';

/**
 * The synced document.
 *
 * Every collection is a **map keyed by id**, never an array. Automerge can merge
 * concurrent list mutations, but array indices are a poor fit for records: two
 * devices inserting at index 3 offline both "win" and you cannot tell which row
 * is which afterwards. Keyed maps make every write address one specific record,
 * so concurrent edits to different records never interact at all.
 *
 * `collapsed` is deliberately absent: whether a group is folded is a property of
 * this screen, not of the data. Syncing it would make one device reach over and
 * fold the other's sidebar. It lives in localStorage instead.
 */
export interface TaskmateDoc {
  schema: number;
  groups: Record<string, Group>;
  lists: Record<string, List>;
  tasks: Record<string, Task>;
}

export type Doc = A.Doc<TaskmateDoc>;

export const SCHEMA = 1;

/**
 * The constant seed every device starts from. Regenerate with
 * `node tools/gen-seed.mjs`; changing it breaks compatibility with documents
 * already in the wild.
 *
 * This is not an optimisation — it is a correctness requirement. Two documents
 * built by separate `A.from()` calls have unrelated root objects, and merging
 * them **silently keeps one side and discards the other**: no exception, no
 * warning, just vanished tasks. A shared seed gives every device a common
 * ancestor, which is what makes merge total instead of destructive. The inbox is
 * baked in for the same reason — nothing about the starting state is left to be
 * invented independently on each device.
 */
const SEED_BASE64 =
  'hW9Kg4W5cYAA8wIBEAAAAAAAAAAAAAAAAAAAAAEBO5TN4ocG+lx93qD/cav46HwXhGu55ClrsJ3k5f7n9+cGAQIDAhMDIwZAAlYCDAEFAhARFBMYFV8hAyMDNAJCEVYMVz+AAQN/AH8Bf8sAf93Uh9QGfwB/BwAExwAAAAR/AggFGAYFCQcLAgwYDQAOFwAAAQQAAAEGAAABfwAAARcAAA1+AA4WAX5cJgMBflcrBQF8UDJONBYBcwZncm91cHMFbGlzdHMGc2NoZW1hBXRhc2tzBWluYm94CWNyZWF0ZWRBdAlkZWxldGVkQXQHZ3JvdXBJZAJpZAdpc0luYm94BG5hbWUFb3JkZXIJdXBkYXRlZEF0AD7LAADLAAENPgIAfwECAH8EAgF+BAEDBD4BAgB/FAYAfwIDAD4WATIwMjYtMDEtMDFUMDA6MDA6MDAuMDAwWmluYm94RW50cmFkYWEwMjAyNi0wMS0wMVQwMDowMDowMC4wMDBaywAAAA==';

function seedBytes(): Uint8Array {
  const binary = atob(SEED_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Fixed id, on purpose. Two devices that each start offline both create their
 * inbox under this same key, so the merge lands them on one record instead of
 * two rival inboxes. Any id generated per-device would guarantee duplicates.
 */
export const INBOX_ID = 'inbox';

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

// --- ordering -----------------------------------------------------------

/**
 * Sorts by fractional key, breaking ties on id.
 *
 * Ties are possible: two devices can generate the same key between the same
 * pair of neighbours. That is harmless as long as the tie-break is total and
 * identical everywhere, which id gives us — both devices then show the same
 * order rather than disagreeing.
 */
export function byOrder<T extends { order: Order; id: string }>(a: T, b: T): number {
  if (a.order !== b.order) return a.order < b.order ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}

/**
 * A key that sorts between two neighbours. Falls back to "just after prev" when
 * the pair is degenerate (equal keys from a merge), since generateKeyBetween
 * requires a strict ordering and would otherwise throw mid-drag.
 */
function keyBetween(prev: Order | undefined, next: Order | undefined): Order {
  const a = prev ?? null;
  const b = next ?? null;
  if (a !== null && b !== null && a >= b) return generateKeyBetween(a, null);
  return generateKeyBetween(a, b);
}

/** Splice semantics: `index` is the slot among siblings *excluding* the mover. */
function orderForIndex<T extends { order: Order; id: string }>(siblings: T[], index: number): Order {
  const at = Math.min(Math.max(index, 0), siblings.length);
  return keyBetween(siblings[at - 1]?.order, siblings[at]?.order);
}

// --- reads --------------------------------------------------------------

const alive = <T extends { deletedAt: string | null }>(row: T) => row.deletedAt === null;

/** Live rows only, sorted — what the UI renders. */
export function project(doc: Doc): AppState {
  const groups = Object.values(doc.groups).filter(alive).map(plainGroup).sort(byOrder);
  const lists = Object.values(doc.lists).filter(alive).map(plainList).sort(byOrder);
  const tasks = Object.values(doc.tasks).filter(alive).map(plainTask).sort(byOrder);
  return { groups, lists, tasks };
}

// Automerge hands back proxies; the UI gets plain frozen-free objects so React
// comparisons and spreads behave normally.
const plainGroup = (g: Group): Group => ({
  id: g.id,
  name: g.name,
  color: g.color,
  order: g.order,
  createdAt: g.createdAt,
  updatedAt: g.updatedAt,
  deletedAt: g.deletedAt,
});

const plainList = (l: List): List => ({
  id: l.id,
  groupId: l.groupId,
  name: l.name,
  order: l.order,
  isInbox: l.isInbox,
  createdAt: l.createdAt,
  updatedAt: l.updatedAt,
  deletedAt: l.deletedAt,
});

const plainTask = (t: Task): Task => ({
  id: t.id,
  listId: t.listId,
  title: t.title,
  notes: t.notes,
  done: t.done,
  doneAt: t.doneAt,
  dueDate: t.dueDate,
  priority: t.priority,
  // `?? null`: documents written before recurrence existed have no such key.
  recurrence: t.recurrence ?? null,
  order: t.order,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
  deletedAt: t.deletedAt,
});

const liveTasksOf = (doc: Doc, listId: string): Task[] =>
  Object.values(doc.tasks).filter((t) => alive(t) && t.listId === listId).map(plainTask).sort(byOrder);

const liveListsOf = (doc: Doc, groupId: string | null): List[] =>
  Object.values(doc.lists).filter((l) => alive(l) && l.groupId === groupId).map(plainList).sort(byOrder);

const liveGroups = (doc: Doc): Group[] =>
  Object.values(doc.groups).filter(alive).map(plainGroup).sort(byOrder);

// --- lifecycle ----------------------------------------------------------

/**
 * A brand-new document — which is really the shared seed, loaded. `A.load`
 * assigns this device a fresh actor id, so two devices doing this concurrently
 * still write under distinct identities while sharing one ancestor.
 */
export function createDoc(): Doc {
  return ensureInbox(A.load<TaskmateDoc>(seedBytes()));
}

/**
 * Idempotent, and re-run after every merge: a document that arrives from another
 * device may predate the inbox, and a document written by an older build may not
 * have one at all.
 */
export function ensureInbox(doc: Doc): Doc {
  if (doc.lists[INBOX_ID] && doc.lists[INBOX_ID].deletedAt === null) return doc;

  return A.change(doc, 'ensure inbox', (d) => {
    const ts = now();
    const existing = d.lists[INBOX_ID];
    if (existing) {
      // Someone tombstoned it. The inbox is the capture destination; it cannot
      // be absent, so revive rather than create a rival.
      existing.deletedAt = null;
      existing.updatedAt = ts;
      return;
    }
    d.lists[INBOX_ID] = {
      id: INBOX_ID,
      groupId: null,
      name: 'Entrada',
      order: 'a0',
      isInbox: true,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    };
  });
}

// --- groups -------------------------------------------------------------

export function addGroup(doc: Doc, name: string, color: GroupColor): [Doc, string] {
  const id = uid();
  const order = keyBetween(liveGroups(doc).at(-1)?.order, undefined);
  const next = A.change(doc, 'add group', (d) => {
    const ts = now();
    d.groups[id] = {
      id,
      name,
      color,
      order,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    };
  });
  return [next, id];
}

export function patchGroup(
  doc: Doc,
  id: string,
  patch: { name?: string; color?: GroupColor }
): Doc {
  return A.change(doc, 'patch group', (d) => {
    const g = d.groups[id];
    if (!g) return;
    if (patch.name !== undefined) g.name = patch.name;
    if (patch.color !== undefined) g.color = patch.color;
    g.updatedAt = now();
  });
}

/** Tombstones the group and everything under it, so nothing is orphaned. */
export function removeGroup(doc: Doc, id: string): Doc {
  const listIds = new Set(liveListsOf(doc, id).map((l) => l.id));
  return A.change(doc, 'remove group', (d) => {
    const ts = now();
    const g = d.groups[id];
    if (g) {
      g.deletedAt = ts;
      g.updatedAt = ts;
    }
    for (const list of Object.values(d.lists)) {
      if (!listIds.has(list.id)) continue;
      list.deletedAt = ts;
      list.updatedAt = ts;
    }
    for (const task of Object.values(d.tasks)) {
      if (!listIds.has(task.listId) || task.deletedAt !== null) continue;
      task.deletedAt = ts;
      task.updatedAt = ts;
    }
  });
}

export function restoreGroup(doc: Doc, id: string): Doc {
  return A.change(doc, 'restore group', (d) => {
    const ts = now();
    const g = d.groups[id];
    if (!g) return;
    const deletedAt = g.deletedAt;
    g.deletedAt = null;
    g.updatedAt = ts;

    // Only revive what this same delete took down — not rows the user had
    // already deleted on their own beforehand.
    for (const list of Object.values(d.lists)) {
      if (list.groupId !== id || list.deletedAt !== deletedAt) continue;
      list.deletedAt = null;
      list.updatedAt = ts;
      for (const task of Object.values(d.tasks)) {
        if (task.listId !== list.id || task.deletedAt !== deletedAt) continue;
        task.deletedAt = null;
        task.updatedAt = ts;
      }
    }
  });
}

export function moveGroup(doc: Doc, id: string, index: number): Doc {
  const siblings = liveGroups(doc).filter((g) => g.id !== id);
  const order = orderForIndex(siblings, index);
  return A.change(doc, 'move group', (d) => {
    const g = d.groups[id];
    if (!g) return;
    g.order = order;
    g.updatedAt = now();
  });
}

// --- lists --------------------------------------------------------------

export function addList(doc: Doc, groupId: string, name: string): [Doc, string] {
  const id = uid();
  const order = keyBetween(liveListsOf(doc, groupId).at(-1)?.order, undefined);
  const next = A.change(doc, 'add list', (d) => {
    const ts = now();
    d.lists[id] = {
      id,
      groupId,
      name,
      order,
      isInbox: false,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    };
  });
  return [next, id];
}

export function patchList(doc: Doc, id: string, patch: { name?: string }): Doc {
  return A.change(doc, 'patch list', (d) => {
    const l = d.lists[id];
    if (!l) return;
    if (patch.name !== undefined) l.name = patch.name;
    l.updatedAt = now();
  });
}

export function removeList(doc: Doc, id: string): Doc {
  if (doc.lists[id]?.isInbox) return doc;
  return A.change(doc, 'remove list', (d) => {
    const ts = now();
    const l = d.lists[id];
    if (!l) return;
    l.deletedAt = ts;
    l.updatedAt = ts;
    for (const task of Object.values(d.tasks)) {
      if (task.listId !== id || task.deletedAt !== null) continue;
      task.deletedAt = ts;
      task.updatedAt = ts;
    }
  });
}

export function restoreList(doc: Doc, id: string): Doc {
  return A.change(doc, 'restore list', (d) => {
    const ts = now();
    const l = d.lists[id];
    if (!l) return;
    const deletedAt = l.deletedAt;
    l.deletedAt = null;
    l.updatedAt = ts;
    for (const task of Object.values(d.tasks)) {
      if (task.listId !== id || task.deletedAt !== deletedAt) continue;
      task.deletedAt = null;
      task.updatedAt = ts;
    }
  });
}

export function moveList(doc: Doc, id: string, groupId: string, index: number): Doc {
  if (doc.lists[id]?.isInbox) return doc;
  const siblings = liveListsOf(doc, groupId).filter((l) => l.id !== id);
  const order = orderForIndex(siblings, index);
  return A.change(doc, 'move list', (d) => {
    const l = d.lists[id];
    if (!l) return;
    l.groupId = groupId;
    l.order = order;
    l.updatedAt = now();
  });
}

// --- tasks --------------------------------------------------------------

export interface NewTask {
  title: string;
  notes?: string;
  dueDate?: string | null;
  priority?: Priority;
  recurrence?: Recurrence | null;
}

/** A repetition needs a date to advance from; anchor to today when none was given. */
const anchoredDue = (input: NewTask): string | null =>
  input.dueDate ?? (input.recurrence ? today() : null);

export function addTask(doc: Doc, input: NewTask & { listId: string }): [Doc, string] {
  const id = uid();
  const order = keyBetween(liveTasksOf(doc, input.listId).at(-1)?.order, undefined);
  const next = A.change(doc, 'add task', (d) => {
    const ts = now();
    d.tasks[id] = {
      id,
      listId: input.listId,
      title: input.title,
      notes: input.notes ?? '',
      done: false,
      doneAt: null,
      dueDate: anchoredDue(input),
      priority: input.priority ?? 0,
      recurrence: input.recurrence ?? null,
      order,
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    };
  });
  return [next, id];
}

/**
 * Adds several tasks to one list in a single change — a multi-line paste turned
 * into one task per line. `generateNKeysBetween` lays the whole batch after the
 * current last row in one call, so the orders stay strictly increasing without
 * re-reading the list between inserts.
 */
export function addTasks(doc: Doc, listId: string, items: NewTask[]): [Doc, string[]] {
  if (items.length === 0) return [doc, []];
  const last = liveTasksOf(doc, listId).at(-1)?.order ?? null;
  const orders = generateNKeysBetween(last, null, items.length);
  const ids = items.map(() => uid());
  const next = A.change(doc, 'add tasks', (d) => {
    const ts = now();
    items.forEach((item, i) => {
      d.tasks[ids[i]!] = {
        id: ids[i]!,
        listId,
        title: item.title,
        notes: item.notes ?? '',
        done: false,
        doneAt: null,
        dueDate: anchoredDue(item),
        priority: item.priority ?? 0,
        recurrence: item.recurrence ?? null,
        order: orders[i]!,
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
      };
    });
  });
  return [next, ids];
}

export interface TaskPatch {
  title?: string;
  notes?: string;
  done?: boolean;
  dueDate?: string | null;
  priority?: Priority;
  recurrence?: Recurrence | null;
}

/**
 * Writes only the fields the patch names — the same discipline the HTTP server
 * needed, and for a sharper reason here: in a CRDT, touching a field is what
 * makes it a candidate to overwrite another device's value. Writing all six
 * fields on every edit would turn "I changed the title" into "I also assert the
 * due date you set on your phone is wrong".
 *
 * Completing a recurring task does not go through the normal done/doneAt path:
 * it never actually becomes done, it just steps `dueDate` to its next
 * occurrence and stays open. That keeps the model free of one row per past
 * occurrence, and — see `advanceDue` — makes the step safe to compute
 * independently on two offline devices.
 */
export function patchTask(doc: Doc, id: string, patch: TaskPatch): Doc {
  return A.change(doc, 'patch task', (d) => {
    const t = d.tasks[id];
    if (!t) return;
    if (patch.title !== undefined) t.title = patch.title;
    if (patch.notes !== undefined) t.notes = patch.notes;
    if (patch.dueDate !== undefined) t.dueDate = patch.dueDate;
    if (patch.priority !== undefined) t.priority = patch.priority;
    if (patch.recurrence !== undefined) t.recurrence = patch.recurrence;
    if (patch.done !== undefined && patch.done !== t.done) {
      if (patch.done && t.recurrence && t.dueDate) {
        t.dueDate = advanceDue(t.dueDate, t.recurrence.unit);
      } else {
        t.done = patch.done;
        t.doneAt = patch.done ? now() : null;
      }
    }
    t.updatedAt = now();
  });
}

export function removeTask(doc: Doc, id: string): Doc {
  return A.change(doc, 'remove task', (d) => {
    const t = d.tasks[id];
    if (!t) return;
    const ts = now();
    t.deletedAt = ts;
    t.updatedAt = ts;
  });
}

export function restoreTask(doc: Doc, id: string): Doc {
  return A.change(doc, 'restore task', (d) => {
    const t = d.tasks[id];
    if (!t) return;
    t.deletedAt = null;
    t.updatedAt = now();
  });
}

export function moveTask(doc: Doc, id: string, listId: string, index: number): Doc {
  const siblings = liveTasksOf(doc, listId).filter((t) => t.id !== id);
  const order = orderForIndex(siblings, index);
  return A.change(doc, 'move task', (d) => {
    const t = d.tasks[id];
    if (!t) return;
    t.listId = listId;
    t.order = order;
    t.updatedAt = now();
  });
}

/** Tombstones every completed task in a list. Returns the ids, for undo. */
export function clearDone(doc: Doc, listId: string): [Doc, string[]] {
  const ids = liveTasksOf(doc, listId)
    .filter((t) => t.done)
    .map((t) => t.id);
  if (ids.length === 0) return [doc, []];

  const next = A.change(doc, 'clear done', (d) => {
    const ts = now();
    for (const id of ids) {
      const t = d.tasks[id];
      if (!t) continue;
      t.deletedAt = ts;
      t.updatedAt = ts;
    }
  });
  return [next, ids];
}

export function restoreTasks(doc: Doc, ids: string[]): Doc {
  return A.change(doc, 'restore tasks', (d) => {
    const ts = now();
    for (const id of ids) {
      const t = d.tasks[id];
      if (!t) continue;
      t.deletedAt = null;
      t.updatedAt = ts;
    }
  });
}

/** Tombstones several tasks at once — undo for a multi-line paste. */
export function removeTasks(doc: Doc, ids: string[]): Doc {
  return A.change(doc, 'remove tasks', (d) => {
    const ts = now();
    for (const id of ids) {
      const t = d.tasks[id];
      if (!t || t.deletedAt !== null) continue;
      t.deletedAt = ts;
      t.updatedAt = ts;
    }
  });
}

// --- trash -------------------------------------------------------------

/** A tombstoned task, for the Lixeira view. `listName` may name a dead list. */
export interface TrashItem {
  id: string;
  title: string;
  listName: string;
  /** Non-null by construction — this is what `deletedAt` was set to. */
  deletedAt: string;
}

/**
 * Every tombstoned task, newest deletion first. Tombstones are never purged
 * (see the README), so this is also the full history of what was removed — the
 * point of the view is that "nunca perder uma tarefa" is something you can see,
 * not just a promise in the sync layer.
 */
export function projectTrash(doc: Doc): TrashItem[] {
  return Object.values(doc.tasks)
    .filter((t) => t.deletedAt !== null)
    .map((t) => ({
      id: t.id,
      title: t.title,
      listName: doc.lists[t.listId]?.name ?? 'Lista removida',
      deletedAt: t.deletedAt as string,
    }))
    .sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
}

/**
 * Restores a task from the trash and, if its list (or the list's group) was
 * tombstoned too, revives those so the task lands somewhere visible instead of
 * inside a dead list. Only walks upward from this one task — it does not revive
 * the list's *other* deleted tasks.
 */
export function restoreTaskDeep(doc: Doc, id: string): Doc {
  return A.change(doc, 'restore task from trash', (d) => {
    const t = d.tasks[id];
    if (!t) return;
    const ts = now();
    t.deletedAt = null;
    t.updatedAt = ts;

    const list = d.lists[t.listId];
    if (list && list.deletedAt !== null) {
      list.deletedAt = null;
      list.updatedAt = ts;
      const group = list.groupId ? d.groups[list.groupId] : undefined;
      if (group && group.deletedAt !== null) {
        group.deletedAt = null;
        group.updatedAt = ts;
      }
    }
  });
}

// --- serialisation ------------------------------------------------------

export const save = (doc: Doc): Uint8Array => A.save(doc);

export function load(bytes: Uint8Array): Doc {
  return ensureInbox(A.load<TaskmateDoc>(bytes));
}

/**
 * Merges a remote document into a local one.
 *
 * Note what is *not* here: no timestamp comparison, no "whose version is newer",
 * no field-by-field reconciliation. Automerge already knows which changes each
 * side has seen, so the union is exact and the operation is commutative — merge
 * order cannot change the outcome. This is the single function that would
 * otherwise be a few hundred lines of hand-written conflict resolution.
 */
export function merge(local: Doc, remote: Doc): Doc {
  return ensureInbox(A.merge(A.clone(local), remote));
}

/**
 * The document's frontier — the set of latest changes. Two documents with equal
 * heads have identical history, which is how the sync loop decides whether it
 * has anything to contribute without diffing content.
 */
export const heads = (doc: Doc): string[] => A.getHeads(doc) as string[];

export function headsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((h, i) => h === b[i]);
}

/** True when the two documents have identical history — nothing to upload. */
export function sameHeads(a: Doc, b: Doc): boolean {
  return headsEqual(heads(a), heads(b));
}

/** Tombstones are never purged — see docs/sync in the README for why. */
export function countTombstones(doc: Doc): number {
  return (
    Object.values(doc.groups).filter((g) => !alive(g)).length +
    Object.values(doc.lists).filter((l) => !alive(l)).length +
    Object.values(doc.tasks).filter((t) => !alive(t)).length
  );
}
