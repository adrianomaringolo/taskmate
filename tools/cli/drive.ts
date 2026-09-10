/**
 * Node-side mirror of `web/src/lib/drive.ts`'s REST calls, trimmed to what a
 * one-shot CLI process needs: no token-client warm-up, no popup, no silent
 * renewal dance — just an access token from auth.ts and the same five
 * `Transport` operations sync.ts already knows how to drive.
 */
import type { RemoteFile, Transport } from '../../web/src/lib/sync.js';
import { CliError } from './config.js';
import { getAccessToken } from './auth.js';

const FILE_NAME = 'taskmate.automerge';
const LEGACY_FILE_NAME = 'trellis.automerge';
const MIME = 'application/octet-stream';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FIELDS = 'id,headRevisionId,modifiedTime';

async function authed(url: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getAccessToken();
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${accessToken}` } });
  } catch {
    throw new CliError('Sem conexão com o Drive.');
  }
  if (res.status === 401 || res.status === 403)
    throw new CliError('A autorização do Drive expirou ou não tem acesso a este arquivo.');
  if (res.status === 404) throw new CliError('O arquivo não existe mais no Drive.');
  if (res.status === 429 || res.status >= 500) throw new CliError('O Drive está indisponível agora.');
  if (!res.ok) throw new CliError(`O Drive respondeu ${res.status}.`);
  return res;
}

const toRemote = (raw: { id: string; headRevisionId?: string; modifiedTime?: string }): RemoteFile => ({
  id: raw.id,
  revision: raw.headRevisionId ?? null,
  modifiedTime: raw.modifiedTime ?? null,
});

async function lookup(name: string): Promise<RemoteFile | null> {
  const query = encodeURIComponent(`name = '${name}' and trashed = false`);
  const res = await authed(
    `${API}/files?q=${query}&spaces=drive&orderBy=modifiedTime desc&pageSize=10&fields=files(${FIELDS})`
  );
  const body = (await res.json()) as { files?: Array<{ id: string; headRevisionId?: string; modifiedTime?: string }> };
  const first = body.files?.[0];
  return first ? toRemote(first) : null;
}

async function rename(fileId: string, name: string): Promise<RemoteFile> {
  const res = await authed(`${API}/files/${fileId}?fields=${FIELDS}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return toRemote((await res.json()) as { id: string; headRevisionId?: string });
}

/**
 * Same fallback as the web client: an existing pre-rename file gets renamed
 * in place rather than treated as absent, so this and the browser never fork
 * the document over a filename that changed once, long ago.
 */
export async function findFile(): Promise<RemoteFile | null> {
  const current = await lookup(FILE_NAME);
  if (current) return current;

  const legacy = await lookup(LEGACY_FILE_NAME);
  if (!legacy) return null;

  try {
    return await rename(legacy.id, FILE_NAME);
  } catch {
    return legacy;
  }
}

export async function createFile(bytes: Uint8Array): Promise<RemoteFile> {
  const boundary = `taskmate-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: FILE_NAME, mimeType: MIME });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${MIME}\r\n\r\n`),
    Buffer.from(bytes),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const res = await authed(`${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`, {
    method: 'POST',
    headers: { 'content-type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return toRemote((await res.json()) as { id: string; headRevisionId?: string });
}

export async function statFile(fileId: string): Promise<RemoteFile> {
  const res = await authed(`${API}/files/${fileId}?fields=${FIELDS},trashed`);
  const raw = (await res.json()) as { id: string; headRevisionId?: string; modifiedTime?: string; trashed?: boolean };
  if (raw.trashed) throw new CliError('O arquivo está na lixeira do Drive.');
  return toRemote(raw);
}

export async function downloadFile(fileId: string): Promise<Uint8Array> {
  const res = await authed(`${API}/files/${fileId}?alt=media`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function uploadFile(fileId: string, bytes: Uint8Array): Promise<RemoteFile> {
  const res = await authed(`${UPLOAD}/files/${fileId}?uploadType=media&fields=${FIELDS}`, {
    method: 'PATCH',
    headers: { 'content-type': MIME },
    body: Buffer.from(bytes),
  });
  return toRemote((await res.json()) as { id: string; headRevisionId?: string });
}

export const driveTransport: Transport = { findFile, createFile, statFile, downloadFile, uploadFile };
