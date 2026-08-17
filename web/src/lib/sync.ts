import { headsEqual, heads, load, merge, save, type Doc } from './doc';
import type { SyncMeta } from './storage';

/** Remote file identity and version, independent of who stores it. */
export interface RemoteFile {
  id: string;
  revision: string | null;
  modifiedTime: string | null;
}

/**
 * The five operations sync needs from a remote file store.
 *
 * This module imports nothing from `drive.ts` on purpose: the sync algorithm is
 * the part that has to be provably correct, so it stays runnable outside a
 * browser. `tools/sync.test.ts` injects a fake store that drops uploads and
 * clobbers revisions — the failures the design exists to survive.
 */
export interface Transport {
  findFile(): Promise<RemoteFile | null>;
  createFile(bytes: Uint8Array): Promise<RemoteFile>;
  statFile(fileId: string): Promise<RemoteFile>;
  downloadFile(fileId: string): Promise<Uint8Array>;
  uploadFile(fileId: string, bytes: Uint8Array): Promise<RemoteFile>;
}

export interface SyncOutcome {
  doc: Doc;
  meta: SyncMeta;
  pulled: boolean;
  pushed: boolean;
  /** Set when the local document changed as a result of the pull. */
  changed: boolean;
}

/**
 * One full sync cycle: **read, merge, then write** — always in that order.
 *
 * The ordering is what makes an unreliable transport safe. Drive offers no
 * conditional write: two devices uploading seconds apart means the later one
 * silently overwrites the earlier, and no error is reported. That would destroy
 * data if we were syncing a snapshot.
 *
 * Here it cannot. The overwritten device still holds its own changes locally,
 * and its next cycle sees a revision it does not recognise, downloads, merges —
 * its changes are still in its own document, so the merge reinstates them — and
 * uploads the union. The loop converges from any interleaving. A lost upload
 * costs one round trip, never a task.
 */
export async function syncOnce(params: {
  transport: Transport;
  doc: Doc;
  meta: SyncMeta;
}): Promise<SyncOutcome> {
  const { transport } = params;
  let doc = params.doc;
  let { fileId, lastRevision, lastHeads } = params.meta;
  let pulled = false;
  let pushed = false;
  const before = heads(doc);

  // 1. Locate the file, or publish ours as the first copy.
  if (!fileId) {
    const found = await transport.findFile();
    if (found) {
      fileId = found.id;
      // Force a pull: we have never seen this file's contents.
      lastRevision = null;
      lastHeads = null;
    } else {
      const created = await transport.createFile(save(doc));
      return {
        doc,
        meta: {
          fileId: created.id,
          lastRevision: created.revision,
          lastHeads: before,
          lastSyncAt: new Date().toISOString(),
        },
        pulled: false,
        pushed: true,
        changed: false,
      };
    }
  }

  // 2. Cheap metadata check, so an unchanged file costs one small request.
  const stat = await transport.statFile(fileId);

  // 3. Pull and merge when the remote moved (or when we cannot tell).
  let remoteHeads: readonly string[] = lastHeads ?? [];
  if (stat.revision === null || stat.revision !== lastRevision) {
    const bytes = await transport.downloadFile(fileId);
    if (bytes.byteLength === 0) {
      // A file that exists but is empty: an interrupted first upload. Ours wins
      // by default, since there is nothing to merge with.
      remoteHeads = [];
    } else {
      const remote = load(bytes);
      remoteHeads = heads(remote);
      doc = merge(doc, remote);
      pulled = true;
    }
    lastRevision = stat.revision;
  }

  // 4. Upload only if we hold history the file does not.
  if (!headsEqual(heads(doc), remoteHeads)) {
    const written = await transport.uploadFile(fileId, save(doc));
    lastRevision = written.revision;
    pushed = true;
  }

  return {
    doc,
    meta: {
      fileId,
      lastRevision,
      lastHeads: heads(doc),
      lastSyncAt: new Date().toISOString(),
    },
    pulled,
    pushed,
    changed: !headsEqual(heads(doc), before),
  };
}

// --- scheduling ---------------------------------------------------------

/**
 * When to sync. Polling on a tight interval would burn quota for nothing — tens
 * of thousands of requests a day to learn that nothing changed — so the loop is
 * event-driven with a slow heartbeat as a backstop:
 *
 * - on connect and on load
 * - when the tab regains focus (the moment a stale view is actually looked at)
 * - a few seconds after a local edit, debounced
 * - every 45s while the tab is visible, and never while it is hidden
 */
export const SYNC_DEBOUNCE_MS = 2_500;
export const SYNC_HEARTBEAT_MS = 45_000;

export type SyncState =
  | { kind: 'off' }
  | { kind: 'unconfigured' }
  | { kind: 'idle'; lastSyncAt: string | null }
  | { kind: 'syncing' }
  | { kind: 'error'; message: string; needsAuth: boolean; lastSyncAt: string | null };

export const describeSyncState = (state: SyncState): string => {
  switch (state.kind) {
    case 'unconfigured':
      return 'Não configurada';
    case 'off':
      return 'Somente neste dispositivo';
    case 'syncing':
      return 'Sincronizando…';
    case 'error':
      return state.message;
    case 'idle':
      return state.lastSyncAt ? `Sincronizado ${describeAgo(state.lastSyncAt)}` : 'Conectado ao Drive';
  }
};

function describeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return 'agora';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `em ${new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(new Date(iso))}`;
}
