/**
 * Loads and saves the CLI's own copy of the document, and wraps `syncOnce`
 * with one safety gate the web app doesn't need.
 *
 * The web app calling `findFile()` and getting nothing back is normal: it
 * means "first run, nothing in Drive yet," and creating the file is correct.
 * Here it is ambiguous — it could just as easily mean "the file exists, but
 * `drive.file` scope doesn't extend this CLI's OAuth client to see it,"
 * since that scope's visibility is documented per-client, not per-Cloud-
 * project. Silently creating a file in that case would fork the document:
 * the web app keeps talking to the real one, this CLI starts writing to a
 * twin nobody else reads, and nothing ever reports the split. So the first
 * sync in a fresh install checks `findFile()` itself, before `syncOnce` gets
 * a chance to create anything, and refuses to proceed without `--create`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import * as doc from '../../web/src/lib/doc.js';
import { syncOnce, type Transport } from '../../web/src/lib/sync.js';
import { EMPTY_SYNC_META, type SyncMeta } from '../../web/src/lib/storage.js';
import { CliError, docCachePath, syncMetaPath } from './config.js';

function loadMeta(): SyncMeta {
  if (!existsSync(syncMetaPath())) return EMPTY_SYNC_META;
  try {
    return JSON.parse(readFileSync(syncMetaPath(), 'utf8')) as SyncMeta;
  } catch {
    return EMPTY_SYNC_META;
  }
}

function saveMeta(meta: SyncMeta): void {
  writeFileSync(syncMetaPath(), JSON.stringify(meta, null, 2));
}

function loadDoc(): doc.Doc {
  if (!existsSync(docCachePath())) return doc.createDoc();
  try {
    return doc.load(readFileSync(docCachePath()));
  } catch {
    return doc.createDoc();
  }
}

function saveDoc(d: doc.Doc): void {
  writeFileSync(docCachePath(), doc.save(d));
}

/**
 * Pulls the latest document. On a cache that has never located the remote
 * file, requires either a prior cached fileId (a previous run already found
 * or created it) or explicit `--create` before letting `syncOnce` create one.
 */
export async function pull(transport: Transport, allowCreate: boolean): Promise<doc.Doc> {
  const meta = loadMeta();

  if (!meta.fileId) {
    const found = await transport.findFile();
    if (!found && !allowCreate) {
      throw new CliError(
        'Nenhum arquivo do Taskmate foi encontrado no Drive desta conta.\n' +
          'Isso normalmente significa que o app web ainda não sincronizou nada, ou que este\n' +
          'cliente OAuth do CLI não enxerga o arquivo que o app web criou (o escopo\n' +
          'drive.file concede visibilidade por aplicação, não por conta).\n' +
          'Rode de novo com --create apenas se tiver certeza de que quer começar um\n' +
          'documento novo — ele NÃO será o mesmo que o app web já sincroniza.'
      );
    }
  }

  const local = loadDoc();
  const result = await syncOnce({ transport, doc: local, meta });
  saveDoc(result.doc);
  saveMeta(result.meta);
  return result.doc;
}

/** Persists a locally-mutated document, then pushes it. */
export async function push(transport: Transport, next: doc.Doc): Promise<void> {
  saveDoc(next);
  const meta = loadMeta();
  const result = await syncOnce({ transport, doc: next, meta });
  saveDoc(result.doc);
  saveMeta(result.meta);
}
