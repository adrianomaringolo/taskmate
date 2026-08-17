/**
 * Local persistence: the Automerge document lives in IndexedDB as its own binary
 * format, not as JSON. That binary carries the change history Automerge needs in
 * order to merge later — serialising to JSON would throw it away and reduce the
 * next sync to a last-write-wins guess.
 *
 * A thin hand-rolled wrapper rather than a wrapper library: this is three keys
 * in one store, and the whole surface is below.
 */

const DB_NAME = 'taskmate';
/** Pre-rename database. Read once, then left alone. */
const LEGACY_DB_NAME = 'trellis';
const DB_VERSION = 1;
const STORE = 'kv';

const DOC_KEY = 'doc';
const SYNC_KEY = 'sync';
const DEVICE_KEY = 'deviceId';

export interface SyncMeta {
  /** Drive file id, once the file exists. */
  fileId: string | null;
  /** Drive revision we last merged, to skip pointless downloads. */
  lastRevision: string | null;
  /**
   * Automerge heads as of the last successful sync. This is what lets the loop
   * answer "do I have anything the file doesn't?" without downloading it.
   */
  lastHeads: string[] | null;
  /** ISO timestamp of the last successful two-way sync. */
  lastSyncAt: string | null;
}

export const EMPTY_SYNC_META: SyncMeta = {
  fileId: null,
  lastRevision: null,
  lastHeads: null,
  lastSyncAt: null,
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB indisponível.'));
    req.onblocked = () => reject(new Error('Outra aba está bloqueando a atualização do banco local.'));
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const req = run(transaction.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Falha ao acessar o banco local.'));
      })
  );
}

const get = <T>(key: string) => tx<T | undefined>('readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
const put = (key: string, value: unknown) =>
  tx<IDBValidKey>('readwrite', (s) => s.put(value, key)).then(() => undefined);

// --- document -----------------------------------------------------------

export async function readDocBytes(): Promise<Uint8Array | null> {
  const stored = await get<Uint8Array | ArrayBuffer>(DOC_KEY);
  if (stored) return stored instanceof Uint8Array ? stored : new Uint8Array(stored);

  /*
   * Nothing under the current name. Before concluding this is a first run — which
   * would silently strand every existing task — check the database the app used
   * before it was renamed, and adopt what is there.
   */
  const adopted = await readLegacy();
  if (adopted) await writeDocBytes(adopted);
  return adopted;
}

/**
 * Opens the pre-rename database *without* creating it. Passing no version and
 * refusing to upgrade means a browser that never ran the old build does not end
 * up with an empty legacy database as a side effect of this check.
 */
function readLegacy(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(LEGACY_DB_NAME);
    } catch {
      return resolve(null);
    }

    request.onerror = () => resolve(null);
    request.onupgradeneeded = () => {
      // The database did not exist. Abort so it is not left behind empty.
      request.transaction?.abort();
      resolve(null);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.close();
        return resolve(null);
      }
      const tx = db.transaction(STORE, 'readonly');
      const read = tx.objectStore(STORE).get(DOC_KEY) as IDBRequest<Uint8Array | ArrayBuffer | undefined>;
      read.onsuccess = () => {
        const value = read.result;
        db.close();
        resolve(value ? (value instanceof Uint8Array ? value : new Uint8Array(value)) : null);
      };
      read.onerror = () => {
        db.close();
        resolve(null);
      };
    };
  });
}

export function writeDocBytes(bytes: Uint8Array): Promise<void> {
  // Copy into a fresh buffer: structured clone of a view over a larger buffer
  // would persist the whole backing store.
  return put(DOC_KEY, bytes.slice());
}

// --- sync metadata ------------------------------------------------------

export async function readSyncMeta(): Promise<SyncMeta> {
  return (await get<SyncMeta>(SYNC_KEY)) ?? EMPTY_SYNC_META;
}

export function writeSyncMeta(meta: SyncMeta): Promise<void> {
  return put(SYNC_KEY, meta);
}

// --- device identity ----------------------------------------------------

/**
 * Stable per-browser id. Used only for labelling this device in the sync panel;
 * Automerge tracks change provenance on its own and needs no help from us.
 */
export async function deviceId(): Promise<string> {
  const existing = await get<string>(DEVICE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  await put(DEVICE_KEY, id);
  return id;
}

/** Wipes local data. Used by "esquecer dados deste dispositivo". */
export async function clearLocal(): Promise<void> {
  await tx('readwrite', (s) => s.clear());
}
