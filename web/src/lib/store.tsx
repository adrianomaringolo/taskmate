import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as D from './doc';
import type { Doc } from './doc';
import {
  accountHint,
  driveTransport,
  isConfigured,
  preload as preloadDrive,
  requestToken,
  signOut,
  DriveError,
} from './drive';
import { readPref, writePref } from './prefs';
import {
  EMPTY_SYNC_META,
  clearLocal,
  readDocBytes,
  readSyncMeta,
  writeDocBytes,
  writeSyncMeta,
  type SyncMeta,
} from './storage';
import {
  SYNC_DEBOUNCE_MS,
  SYNC_HEARTBEAT_MS,
  syncOnce,
  type SyncState,
} from './sync';
import type { AppState, Group, GroupColor, List, Task } from './types';

/**
 * Zero, deliberately. A `setTimeout(0)` still coalesces one synchronous burst of
 * changes into a single write, but the write starts on the next tick instead of
 * hundreds of milliseconds later.
 *
 * Any real delay here is a window in which a reload loses the last edit — and it
 * did, in testing: a note typed just before a reload never reached IndexedDB,
 * while the due date set moments earlier survived. Flushing on `pagehide` helps
 * but cannot be relied on, since the browser does not guarantee an async write
 * started there will finish.
 *
 * The cost of not debouncing is negligible: serialising a 200-task document
 * measures ~1.6 ms and 23 KB, and documents change once per user action, not
 * once per keystroke.
 */
const PERSIST_DEBOUNCE_MS = 0;
const COLLAPSED_KEY = 'collapsed';

/** A labelled button inside a toast: undo a deletion, reload for an update. */
export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: string;
  text: string;
  kind: 'info' | 'error';
  action?: ToastAction;
}

interface Store {
  status: 'loading' | 'ready' | 'error';
  loadError: string | null;
  data: AppState;

  listById: Map<string, List>;
  groupById: Map<string, Group>;
  tasksByList: Map<string, Task[]>;

  /** Device-local: which groups are folded on *this* screen. */
  collapsed: ReadonlySet<string>;
  toggleCollapsed: (groupId: string) => void;

  toasts: Toast[];
  dismissToast: (id: string) => void;
  notify: (text: string, kind?: Toast['kind'], action?: ToastAction) => void;
  undoLast: () => void;

  sync: {
    configured: boolean;
    connected: boolean;
    /** The Google account email, once known — see drive.ts's `captureHint`. */
    accountEmail: string | null;
    state: SyncState;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    now: () => Promise<void>;
    forget: () => Promise<void>;
  };

  addTask: (listId: string, title: string) => Promise<void>;
  patchTask: (id: string, patch: D.TaskPatch) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  moveTask: (id: string, listId: string, index: number) => Promise<void>;
  clearDone: (listId: string) => Promise<void>;

  addGroup: (name: string, color: GroupColor) => Promise<string | null>;
  patchGroup: (id: string, patch: { name?: string; color?: GroupColor }) => Promise<void>;
  removeGroup: (id: string) => Promise<void>;
  moveGroup: (id: string, index: number) => Promise<void>;

  addList: (groupId: string, name: string) => Promise<string | null>;
  patchList: (id: string, patch: { name?: string }) => Promise<void>;
  removeList: (id: string) => Promise<void>;
  moveList: (id: string, groupId: string, index: number) => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

const EMPTY: AppState = { groups: [], lists: [], tasks: [] };

function readCollapsed(): Set<string> {
  try {
    const raw = readPref(COLLAPSED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* corrupt value; every group starts open */
  }
  return new Set();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Store['status']>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doc, setDocState] = useState<Doc | null>(null);
  const [meta, setMetaState] = useState<SyncMeta>(EMPTY_SYNC_META);
  const [syncState, setSyncState] = useState<SyncState>(
    isConfigured() ? { kind: 'off' } : { kind: 'unconfigured' }
  );
  // Re-read after every sync completes rather than pushed reactively from
  // `captureHint`: that fetch races the sync it rides in on, so "eventually
  // consistent, refreshed on the next state change" is simpler than plumbing
  // a callback through for a settings-panel display.
  const [accountEmail, setAccountEmail] = useState<string | null>(() =>
    isConfigured() ? accountHint() : null
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(readCollapsed);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Refs mirror state so async work always sees the latest values without
  // re-subscribing every timer and listener on each keystroke.
  const docRef = useRef<Doc | null>(null);
  const metaRef = useRef<SyncMeta>(EMPTY_SYNC_META);
  const syncingRef = useRef(false);
  // Set when a background sync hit a dead token, cleared on the next successful
  // sync. While set, background triggers stop calling runSync at all — without
  // this, the heartbeat would rediscover the same dead token every 45s and each
  // attempt is another round trip for a result the app already knows. The user
  // clears it explicitly via Reconectar / Sincronizar agora.
  const needsReauthRef = useRef(false);
  const undoRef = useRef<(() => void) | null>(null);
  const persistTimer = useRef<number | null>(null);
  const syncTimer = useRef<number | null>(null);
  const toastTimers = useRef(new Map<string, number>());

  // --- toasts ---------------------------------------------------------

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = toastTimers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      toastTimers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (text: string, kind: Toast['kind'], action?: ToastAction, ttl?: number) => {
      const id = crypto.randomUUID();
      setToasts((t) => [...t.filter((x) => x.kind === 'error' || kind === 'error'), { id, text, kind, action }]);
      // ttl 0 keeps it until dismissed — used by the update prompt, which should
      // not expire out from under someone who stepped away.
      const life = ttl ?? (kind === 'error' ? 9000 : 7000);
      if (life > 0) toastTimers.current.set(id, window.setTimeout(() => dismissToast(id), life));
    },
    [dismissToast]
  );

  const notify = useCallback(
    (text: string, kind: Toast['kind'] = 'info', action?: ToastAction) =>
      pushToast(text, kind, action, action ? 0 : undefined),
    [pushToast]
  );

  useEffect(() => {
    const timers = toastTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  // Fetches and initializes the Google token client while the app is idle, so
  // the "Conectar" tap itself never has to await it — see drive.ts's `preload`
  // for why that gap is what closes the popup on mobile Chrome.
  useEffect(() => {
    preloadDrive();
  }, []);

  // --- persistence ----------------------------------------------------

  /**
   * Writes immediately, cancelling any debounced write. Called on `pagehide`
   * and when the tab is hidden.
   *
   * Without this the debounce is a data-loss window: edit, hit reload within the
   * debounce, and the write never happens. It cost a task in testing — the due
   * date survived because its timer had already fired, the note typed a moment
   * later did not.
   */
  const flushPersist = useCallback(() => {
    if (persistTimer.current === null) return;
    clearTimeout(persistTimer.current);
    persistTimer.current = null;
    const current = docRef.current;
    if (current) void writeDocBytes(D.save(current)).catch(() => {});
  }, []);

  const persistSoon = useCallback(
    (next: Doc) => {
      if (persistTimer.current !== null) clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(() => {
        persistTimer.current = null;
        void writeDocBytes(D.save(next)).catch(() => {
          pushToast('Não consegui gravar no armazenamento local deste navegador.', 'error');
        });
      }, PERSIST_DEBOUNCE_MS);
    },
    [pushToast]
  );

  useEffect(() => {
    const onLeaving = () => flushPersist();
    const onHidden = () => {
      if (document.hidden) flushPersist();
    };
    // pagehide fires for reload, navigation, and tab close, including the
    // back/forward cache path that beforeunload misses.
    window.addEventListener('pagehide', onLeaving);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', onLeaving);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [flushPersist]);

  const putMeta = useCallback((next: SyncMeta) => {
    metaRef.current = next;
    setMetaState(next);
    void writeSyncMeta(next).catch(() => {});
  }, []);

  // --- sync -----------------------------------------------------------

  const runSync = useCallback(
    async ({ interactive }: { interactive: boolean }) => {
      if (!isConfigured() || syncingRef.current) return;
      const current = docRef.current;
      if (!current) return;
      if (!interactive && metaRef.current.fileId === null && syncState.kind === 'off') return;
      // A prior background sync already found the token dead; retrying silently
      // on every heartbeat/focus would just fail the same way. Only an
      // interactive call (Reconectar, Sincronizar agora) can clear this.
      if (!interactive && needsReauthRef.current) return;

      syncingRef.current = true;
      setSyncState({ kind: 'syncing' });
      try {
        // Interactive callers renew the token up front, so a popup — if one is
        // needed at all — appears while the user is looking at this app, not
        // mid-request from inside the transport.
        if (interactive) await requestToken({ interactive: true });

        const outcome = await syncOnce({
          transport: driveTransport,
          doc: current,
          meta: metaRef.current,
        });

        /*
         * Merge the result into whatever the document is *now*, not into the
         * snapshot the sync started from. The user keeps typing during a round
         * trip, and assigning the outcome directly would discard every edit made
         * while it was in flight. Merge is commutative, so folding it back in is
         * always safe.
         */
        setDoc(D.merge(docRef.current ?? outcome.doc, outcome.doc));
        putMeta(outcome.meta);
        needsReauthRef.current = false;
        setSyncState({ kind: 'idle', lastSyncAt: outcome.meta.lastSyncAt });
        setAccountEmail(accountHint());
      } catch (err) {
        const isDrive = err instanceof DriveError;
        const needsAuth = isDrive && err.kind === 'auth';
        if (needsAuth) needsReauthRef.current = true;
        setSyncState({
          kind: 'error',
          message: isDrive ? err.message : 'Falha ao sincronizar com o Drive.',
          needsAuth,
          lastSyncAt: metaRef.current.lastSyncAt,
        });
      } finally {
        syncingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [putMeta, syncState.kind]
  );

  const syncSoon = useCallback(() => {
    if (!isConfigured() || metaRef.current.fileId === null) return;
    if (syncTimer.current !== null) clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      syncTimer.current = null;
      void runSync({ interactive: false });
    }, SYNC_DEBOUNCE_MS);
  }, [runSync]);

  /** Single funnel for every mutation: state, local persistence, then sync. */
  const setDoc = useCallback(
    (next: Doc) => {
      docRef.current = next;
      setDocState(next);
      persistSoon(next);
    },
    [persistSoon]
  );

  const mutate = useCallback(
    (fn: (current: Doc) => Doc) => {
      const current = docRef.current;
      if (!current) return;
      const next = fn(current);
      if (next === current) return;
      setDoc(next);
      syncSoon();
    },
    [setDoc, syncSoon]
  );

  // --- boot -----------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [bytes, storedMeta] = await Promise.all([readDocBytes(), readSyncMeta()]);
        if (cancelled) return;

        const loaded = bytes ? D.load(bytes) : D.createDoc();
        docRef.current = loaded;
        metaRef.current = storedMeta;
        setDocState(loaded);
        setMetaState(storedMeta);
        setStatus('ready');

        if (!bytes) await writeDocBytes(D.save(loaded));

        // Already paired with a Drive file: resume automatically. This is the
        // one background moment allowed to renew the token interactively — the
        // user just opened the app, so a brief Google flash (if renewal is even
        // needed) lands while they are looking at it, never while they are not.
        if (isConfigured() && storedMeta.fileId !== null) {
          setSyncState({ kind: 'idle', lastSyncAt: storedMeta.lastSyncAt });
          void runSync({ interactive: true });
        }
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setLoadError(
          err instanceof Error
            ? `${err.message} Seus dados continuam no navegador.`
            : 'Não consegui abrir o armazenamento local.'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // Boot must run exactly once; runSync is stable enough for this purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background pull triggers: tab becomes visible again, connection comes
  // back, and a slow heartbeat as a backstop. All three only fire non-interactive
  // syncs (see runSync / drive.ts's requestToken — that path never opens Google
  // UI), and all three are throttled to "stale", so switching tabs or alt-tabbing
  // between apps does not, by itself, cost a network round trip. There is no
  // `window.addEventListener('focus', …)` here on purpose: it fires on every
  // return to the browser window regardless of which tab is active, which is
  // exactly what used to make this run constantly while the user was elsewhere.
  useEffect(() => {
    if (!isConfigured()) return;

    const pullIfStale = () => {
      if (document.hidden) return;
      const last = metaRef.current.lastSyncAt;
      if (last && Date.now() - new Date(last).getTime() < SYNC_HEARTBEAT_MS) return;
      void runSync({ interactive: false });
    };

    document.addEventListener('visibilitychange', pullIfStale);
    window.addEventListener('online', pullIfStale);
    const beat = window.setInterval(pullIfStale, SYNC_HEARTBEAT_MS);

    return () => {
      document.removeEventListener('visibilitychange', pullIfStale);
      window.removeEventListener('online', pullIfStale);
      clearInterval(beat);
    };
  }, [runSync]);

  useEffect(() => {
    return () => {
      // Flush rather than cancel, for the same reason as `pagehide`.
      flushPersist();
      if (syncTimer.current !== null) clearTimeout(syncTimer.current);
    };
  }, [flushPersist]);

  // --- collapsed (device-local) ---------------------------------------

  const toggleCollapsed = useCallback((groupId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      writePref(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  // --- mutations ------------------------------------------------------

  const addTask = useCallback<Store['addTask']>(
    async (listId, title) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      mutate((d) => D.addTask(d, { listId, title: trimmed })[0]);
    },
    [mutate]
  );

  const patchTask = useCallback<Store['patchTask']>(
    async (id, patch) => mutate((d) => D.patchTask(d, id, patch)),
    [mutate]
  );

  const removeTask = useCallback<Store['removeTask']>(
    async (id) => {
      const task = docRef.current?.tasks[id];
      const title = task?.title ?? 'Tarefa';
      mutate((d) => D.removeTask(d, id));

      const undo = () => {
        mutate((d) => D.restoreTask(d, id));
        undoRef.current = null;
      };
      undoRef.current = undo;
      pushToast(`"${truncate(title)}" foi excluída.`, 'info', { label: 'Desfazer', run: undo });
    },
    [mutate, pushToast]
  );

  const moveTask = useCallback<Store['moveTask']>(
    async (id, listId, index) => mutate((d) => D.moveTask(d, id, listId, index)),
    [mutate]
  );

  const clearDone = useCallback<Store['clearDone']>(
    async (listId) => {
      const current = docRef.current;
      if (!current) return;
      const [next, ids] = D.clearDone(current, listId);
      if (ids.length === 0) return;
      setDoc(next);
      syncSoon();

      const undo = () => {
        mutate((d) => D.restoreTasks(d, ids));
        undoRef.current = null;
      };
      undoRef.current = undo;
      pushToast(
        `${ids.length} ${ids.length === 1 ? 'tarefa concluída removida' : 'tarefas concluídas removidas'}.`,
        'info',
        { label: 'Desfazer', run: undo }
      );
    },
    [mutate, pushToast, setDoc, syncSoon]
  );

  const addGroup = useCallback<Store['addGroup']>(
    async (name, color) => {
      const current = docRef.current;
      if (!current) return null;
      const [next, id] = D.addGroup(current, name.trim(), color);
      setDoc(next);
      syncSoon();
      return id;
    },
    [setDoc, syncSoon]
  );

  const patchGroup = useCallback<Store['patchGroup']>(
    async (id, patch) => mutate((d) => D.patchGroup(d, id, patch)),
    [mutate]
  );

  const removeGroup = useCallback<Store['removeGroup']>(
    async (id) => {
      const name = docRef.current?.groups[id]?.name ?? 'Grupo';
      mutate((d) => D.removeGroup(d, id));

      const undo = () => {
        mutate((d) => D.restoreGroup(d, id));
        undoRef.current = null;
      };
      undoRef.current = undo;
      pushToast(`"${truncate(name)}" e o que estava dentro foram excluídos.`, 'info', {
        label: 'Desfazer',
        run: undo,
      });
    },
    [mutate, pushToast]
  );

  const moveGroup = useCallback<Store['moveGroup']>(
    async (id, index) => mutate((d) => D.moveGroup(d, id, index)),
    [mutate]
  );

  const addList = useCallback<Store['addList']>(
    async (groupId, name) => {
      const current = docRef.current;
      if (!current) return null;
      const [next, id] = D.addList(current, groupId, name.trim());
      setDoc(next);
      syncSoon();
      return id;
    },
    [setDoc, syncSoon]
  );

  const patchList = useCallback<Store['patchList']>(
    async (id, patch) => mutate((d) => D.patchList(d, id, patch)),
    [mutate]
  );

  const removeList = useCallback<Store['removeList']>(
    async (id) => {
      const name = docRef.current?.lists[id]?.name ?? 'Lista';
      mutate((d) => D.removeList(d, id));

      const undo = () => {
        mutate((d) => D.restoreList(d, id));
        undoRef.current = null;
      };
      undoRef.current = undo;
      pushToast(`"${truncate(name)}" e suas tarefas foram excluídas.`, 'info', {
        label: 'Desfazer',
        run: undo,
      });
    },
    [mutate, pushToast]
  );

  const moveList = useCallback<Store['moveList']>(
    async (id, groupId, index) => mutate((d) => D.moveList(d, id, groupId, index)),
    [mutate]
  );

  const undoLast = useCallback(() => undoRef.current?.(), []);

  // --- sync controls --------------------------------------------------

  // Interactive once, to obtain consent (runSync requests the token up front);
  // every background sync after this is silent and never opens Google UI.
  const connect = useCallback(async () => {
    if (!isConfigured()) return;
    await runSync({ interactive: true });
  }, [runSync]);

  const disconnect = useCallback(async () => {
    await signOut();
    putMeta({ ...EMPTY_SYNC_META });
    setSyncState({ kind: 'off' });
    setAccountEmail(null);
    notify('Desconectado do Drive. Seus dados continuam neste dispositivo.');
  }, [notify, putMeta]);

  const forget = useCallback(async () => {
    await signOut();
    await clearLocal();
    location.reload();
  }, []);

  // --- derived --------------------------------------------------------

  const data = useMemo(() => (doc ? D.project(doc) : EMPTY), [doc]);
  const listById = useMemo(() => new Map(data.lists.map((l) => [l.id, l])), [data.lists]);
  const groupById = useMemo(() => new Map(data.groups.map((g) => [g.id, g])), [data.groups]);

  const tasksByList = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const list of data.lists) map.set(list.id, []);
    for (const task of data.tasks) map.get(task.listId)?.push(task);
    // data.tasks arrives ordered, so each bucket is already in order.
    return map;
  }, [data.lists, data.tasks]);

  const value: Store = {
    status,
    loadError,
    data,
    listById,
    groupById,
    tasksByList,
    collapsed,
    toggleCollapsed,
    toasts,
    dismissToast,
    notify,
    undoLast,
    sync: {
      configured: isConfigured(),
      connected: meta.fileId !== null,
      accountEmail,
      state: syncState,
      connect,
      disconnect,
      // Interactive: an explicit click, so it may renew the token (and clears
      // needsReauthRef on success) rather than silently no-op after a dead token.
      now: () => runSync({ interactive: true }),
      forget,
    },
    addTask,
    patchTask,
    removeTask,
    moveTask,
    clearDone,
    addGroup,
    patchGroup,
    removeGroup,
    moveGroup,
    addList,
    patchList,
    removeList,
    moveList,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore precisa estar dentro de <StoreProvider>.');
  return store;
}

const truncate = (s: string, max = 40) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
