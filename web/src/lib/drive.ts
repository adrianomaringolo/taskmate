/**
 * Google Drive transport.
 *
 * Scope is `drive.file`, which grants access only to files this app itself
 * created. It is a non-sensitive scope — no Google verification review — and it
 * cannot read the rest of the user's Drive even if the code tried to. The file
 * is a normal, visible file rather than hidden app data, so the user can find,
 * copy, and back it up without going through us.
 *
 * There is no client secret and no backend, which means no refresh token: the
 * browser flow issues access tokens valid for about an hour, and the token
 * itself is never persisted — every page load has to ask Google for a new one.
 * That renewal is silent in the sense that it needs no click, but not
 * invisible: see `requestToken` for what actually happens on screen.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILE_NAME = 'taskmate.automerge';
/**
 * The pre-rename filename. `findFile` looks for it when the current name is
 * absent and renames it in place.
 *
 * Skipping this would split data in the worst way available: a device that
 * already holds the old file would fail to find it, create a second document,
 * and the two would drift apart forever with no error and no obvious symptom —
 * each device would simply stop seeing the other's tasks.
 */
const LEGACY_FILE_NAME = 'trellis.automerge';
const MIME = 'application/octet-stream';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';

/** Sync is opt-in infrastructure; without a client id the app is local-only. */
export const isConfigured = (): boolean => CLIENT_ID.length > 0;

export type { RemoteFile } from './sync';
import type { RemoteFile, Transport } from './sync';

/** Distinguishes "the user must act" from "the network hiccuped". */
export class DriveError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'network' | 'notFound' | 'server' = 'server'
  ) {
    super(message);
  }
}

// --- Google Identity Services -------------------------------------------

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface Gis {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string; message?: string }) => void;
      }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    };
  };
}

declare global {
  interface Window {
    google?: Gis;
  }
}

let gisPromise: Promise<Gis> | null = null;

function loadGis(): Promise<Gis> {
  gisPromise ??= new Promise<Gis>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve(window.google);

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const script = existing ?? document.createElement('script');
    const onLoad = () => {
      if (window.google?.accounts?.oauth2) resolve(window.google);
      else reject(new DriveError('O script do Google carregou incompleto.', 'network'));
    };
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener(
      'error',
      () =>
        reject(
          new DriveError(
            'Não consegui carregar o Google. Verifique a conexão ou um bloqueador de scripts.',
            'network'
          )
        ),
      { once: true }
    );

    if (!existing) {
      script.src = GIS_SRC;
      script.async = true;
      document.head.append(script);
    }
  }).catch((err) => {
    gisPromise = null; // let a later attempt retry
    throw err;
  });
  return gisPromise;
}

let client: TokenClient | null = null;
let token: string | null = null;
let tokenExpiry = 0;
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null;

async function ensureClient(): Promise<TokenClient> {
  if (client) return client;
  const gis = await loadGis();

  client = gis.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (response) => {
      const waiting = pending;
      pending = null;
      if (!waiting) return;

      if (response.access_token) {
        token = response.access_token;
        // Expire a minute early so a request never starts on a dying token.
        tokenExpiry = Date.now() + ((response.expires_in ?? 3600) - 60) * 1000;
        waiting.resolve(response.access_token);
      } else {
        waiting.reject(new DriveError(authMessage(response.error), 'auth'));
      }
    },
    error_callback: (error) => {
      const waiting = pending;
      pending = null;
      waiting?.reject(new DriveError(authMessage(error.type), 'auth'));
    },
  });
  return client;
}

/**
 * Warms the token client before the user ever taps "Conectar". The popup that
 * `requestAccessToken` opens is only trusted as user-initiated while it happens
 * inside the click's own call stack — if that click has to `await` the Google
 * script loading over the network first, the delay is often enough for mobile
 * Chrome to stop treating the eventual `window.open` as user-initiated, and it
 * closes the popup immediately, before the user can finish authorizing. Loading
 * the script and initializing the client ahead of time, while the app is idle,
 * keeps the real click free of any await before the popup opens.
 */
export function preload(): void {
  if (!isConfigured()) return;
  void ensureClient().catch(() => {
    // Best-effort: a real failure surfaces properly on the next requestToken call.
  });
}

function authMessage(code?: string): string {
  if (code === 'popup_closed' || code === 'popup_failed_to_open')
    return 'A janela do Google fechou antes de concluir. Tente conectar de novo.';
  if (code === 'access_denied') return 'O acesso ao Drive foi recusado.';
  return 'Não consegui autorizar no Google. Conecte novamente.';
}

/**
 * `interactive: false` attempts a silent renewal, which works once consent has
 * been granted and the Google session is alive — no click required. It is not
 * invisible, though: GIS still opens a real popup to confirm the session and
 * closes it itself a moment later, which is the brief loading flash a user
 * sees on every reload. It can also fail outright — Safari's tracking
 * prevention blocks the third-party context this relies on — so callers must
 * treat an `auth` failure as "ask the user to reconnect" rather than as a
 * fatal error.
 */
export async function requestToken({ interactive }: { interactive: boolean }): Promise<string> {
  if (!isConfigured()) throw new DriveError('Sincronização não configurada.', 'auth');
  if (token && Date.now() < tokenExpiry) return token;

  const tokenClient = await ensureClient();
  if (pending) throw new DriveError('Já existe uma autorização em andamento.', 'auth');

  return new Promise<string>((resolve, reject) => {
    pending = { resolve, reject };
    try {
      tokenClient.requestAccessToken(interactive ? {} : { prompt: '' });
    } catch (err) {
      pending = null;
      reject(new DriveError(err instanceof Error ? err.message : 'Falha ao pedir autorização.', 'auth'));
    }
  });
}

export function forgetToken(): void {
  token = null;
  tokenExpiry = 0;
}

export async function signOut(): Promise<void> {
  const current = token;
  forgetToken();
  if (!current) return;
  try {
    const gis = await loadGis();
    await new Promise<void>((resolve) => gis.accounts.oauth2.revoke(current, resolve));
  } catch {
    // Revocation is best-effort: the local token is already gone either way.
  }
}

// --- authorised fetch ---------------------------------------------------

/**
 * Retries once on 401 with a fresh token. An access token can expire between the
 * expiry check and the request landing, and that single retry is the difference
 * between a seamless hour boundary and a spurious error toast.
 */
async function authed(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const accessToken = await requestToken({ interactive: false });

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new DriveError('Sem conexão com o Drive.', 'network');
  }

  if (res.status === 401 && retry) {
    forgetToken();
    return authed(url, init, false);
  }
  if (res.status === 401 || res.status === 403) {
    forgetToken();
    throw new DriveError('A autorização do Drive expirou. Conecte novamente.', 'auth');
  }
  if (res.status === 404) throw new DriveError('O arquivo não existe mais no Drive.', 'notFound');
  if (res.status === 429 || res.status >= 500)
    throw new DriveError('O Drive está indisponível agora. Vou tentar de novo.', 'network');
  if (!res.ok) throw new DriveError(`O Drive respondeu ${res.status}.`, 'server');

  return res;
}

const FIELDS = 'id,headRevisionId,modifiedTime';

const toRemote = (raw: {
  id: string;
  headRevisionId?: string;
  modifiedTime?: string;
}): RemoteFile => ({
  id: raw.id,
  revision: raw.headRevisionId ?? null,
  modifiedTime: raw.modifiedTime ?? null,
});

/**
 * Finds the document on a device that has never seen it. `drive.file` scope is
 * granted per *application*, not per device, so a file created by this app on
 * the phone is listable here — which is what makes adding a second device a
 * matter of signing in rather than copying an id by hand.
 */
async function lookup(name: string): Promise<RemoteFile | null> {
  const query = encodeURIComponent(`name = '${name}' and trashed = false`);
  const res = await authed(
    `${API}/files?q=${query}&spaces=drive&orderBy=modifiedTime desc&pageSize=10&fields=files(${FIELDS})`
  );
  const body = (await res.json()) as {
    files?: Array<{ id: string; headRevisionId?: string; modifiedTime?: string }>;
  };
  const first = body.files?.[0];
  return first ? toRemote(first) : null;
}

/** Metadata-only update, so the rename does not touch the file's contents. */
async function rename(fileId: string, name: string): Promise<RemoteFile> {
  const res = await authed(`${API}/files/${fileId}?fields=${FIELDS}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return toRemote((await res.json()) as { id: string; headRevisionId?: string });
}

/**
 * Finds the document on a device that has never seen it. `drive.file` scope is
 * granted per *application*, not per device, so a file created by this app on
 * the phone is listable here — which is what makes adding a second device a
 * matter of signing in rather than copying an id by hand.
 *
 * If only the pre-rename file exists, it is renamed rather than copied: one
 * document, one id, every device converging on the new name as it syncs.
 */
export async function findFile(): Promise<RemoteFile | null> {
  const current = await lookup(FILE_NAME);
  if (current) return current;

  const legacy = await lookup(LEGACY_FILE_NAME);
  if (!legacy) return null;

  try {
    return await rename(legacy.id, FILE_NAME);
  } catch {
    // Renaming is a convenience, not a requirement — syncing against the old
    // name still works, and the next device to sync will try again.
    return legacy;
  }
}

export async function createFile(bytes: Uint8Array): Promise<RemoteFile> {
  const boundary = `taskmate-${crypto.randomUUID()}`;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify({ name: FILE_NAME, mimeType: MIME }),
    `\r\n--${boundary}\r\nContent-Type: ${MIME}\r\n\r\n`,
    bytes.slice() as BlobPart,
    `\r\n--${boundary}--\r\n`,
  ]);

  const res = await authed(`${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`, {
    method: 'POST',
    headers: { 'content-type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return toRemote((await res.json()) as { id: string; headRevisionId?: string });
}

/** Cheap: metadata only, so the sync loop can skip unchanged files. */
export async function statFile(fileId: string): Promise<RemoteFile> {
  const res = await authed(`${API}/files/${fileId}?fields=${FIELDS},trashed`);
  const raw = (await res.json()) as {
    id: string;
    headRevisionId?: string;
    modifiedTime?: string;
    trashed?: boolean;
  };
  if (raw.trashed) throw new DriveError('O arquivo está na lixeira do Drive.', 'notFound');
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
    body: bytes.slice() as BodyInit,
  });
  return toRemote((await res.json()) as { id: string; headRevisionId?: string });
}

/** The Drive-backed implementation the app runs with. */
export const driveTransport: Transport = {
  findFile,
  createFile,
  statFile,
  downloadFile,
  uploadFile,
};
