/**
 * Google's Device Authorization Grant (RFC 8628) — the flow built for
 * exactly this shape of client: a headless or terminal-only process with no
 * browser of its own and no redirect URI to receive a callback on. The user
 * authorizes on *any* device with a browser; this process only ever polls a
 * token endpoint.
 *
 * Same Drive scope as the web app, so the CLI reads and writes the same kind
 * of file — but it is a *different* OAuth client (see config.ts), which
 * matters for `drive.file`: that scope grants visibility into files the
 * requesting client created or the user opened with it, and it is documented
 * per-client, not per-Cloud-project. A file the web app created may not be
 * visible to this client's token. `data.ts` handles that possibility
 * explicitly rather than silently forking the document — see its `--create`
 * gate.
 */
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { clientId, clientSecret, credentialsPath, CliError } from './config.js';

const DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
export const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

interface Credentials {
  refreshToken: string;
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  email: string | null;
}

function loadCredentials(): Credentials | null {
  if (!existsSync(credentialsPath())) return null;
  try {
    return JSON.parse(readFileSync(credentialsPath(), 'utf8')) as Credentials;
  } catch {
    return null;
  }
}

function saveCredentials(creds: Credentials): void {
  const path = credentialsPath();
  writeFileSync(path, JSON.stringify(creds, null, 2), { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Best-effort, as in config.ts.
  }
}

function clearCredentials(): void {
  if (existsSync(credentialsPath())) rmSync(credentialsPath());
}

async function postForm(url: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok && !body.error) throw new CliError(`Google respondeu ${res.status}.`);
  return body;
}

async function fetchEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(USERINFO_URL, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const body = (await res.json()) as { email?: string };
    return body.email ?? null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the full device-flow cycle: requests a user code, prints instructions,
 * and polls until the user authorizes (or the code expires / is denied).
 */
export async function login(): Promise<void> {
  const id = clientId();
  const secret = clientSecret();

  const device = (await postForm(DEVICE_CODE_URL, { client_id: id, scope: SCOPE })) as {
    device_code?: string;
    user_code?: string;
    verification_url?: string;
    expires_in?: number;
    interval?: number;
    error?: string;
    error_description?: string;
  };
  if (!device.device_code || !device.user_code || !device.verification_url) {
    throw new CliError(device.error_description ?? device.error ?? 'Falha ao iniciar a autorização.');
  }

  console.log(`Abra ${device.verification_url} e digite o código: ${device.user_code}`);
  console.log('Aguardando autorização…');

  let interval = (device.interval ?? 5) * 1000;
  const deadline = Date.now() + (device.expires_in ?? 1800) * 1000;

  while (Date.now() < deadline) {
    await sleep(interval);
    const token = (await postForm(TOKEN_URL, {
      client_id: id,
      client_secret: secret,
      device_code: device.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (token.access_token && token.refresh_token) {
      const email = await fetchEmail(token.access_token);
      saveCredentials({
        refreshToken: token.refresh_token,
        accessToken: token.access_token,
        expiresAt: Date.now() + ((token.expires_in ?? 3600) - 60) * 1000,
        email,
      });
      console.log(email ? `Conectado como ${email}.` : 'Conectado.');
      return;
    }

    if (token.error === 'authorization_pending') continue;
    if (token.error === 'slow_down') {
      interval += 5000;
      continue;
    }
    if (token.error === 'access_denied') throw new CliError('Autorização recusada.');
    if (token.error === 'expired_token') break;
    throw new CliError(`Falha na autorização: ${token.error ?? 'desconhecida'}.`);
  }

  throw new CliError('O código expirou antes da autorização. Rode "auth login" novamente.');
}

async function refresh(creds: Credentials): Promise<Credentials> {
  const token = (await postForm(TOKEN_URL, {
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: creds.refreshToken,
    grant_type: 'refresh_token',
  })) as { access_token?: string; expires_in?: number; error?: string };

  if (!token.access_token) {
    clearCredentials();
    throw new CliError('A autorização do Drive expirou. Rode "auth login" novamente.');
  }

  const next: Credentials = {
    ...creds,
    accessToken: token.access_token,
    expiresAt: Date.now() + ((token.expires_in ?? 3600) - 60) * 1000,
  };
  saveCredentials(next);
  return next;
}

/** Returns a live access token, refreshing on disk if the cached one is stale. */
export async function getAccessToken(): Promise<string> {
  const creds = loadCredentials();
  if (!creds) throw new CliError('Não conectado. Rode "taskmate auth login" primeiro.');
  if (Date.now() < creds.expiresAt) return creds.accessToken;
  return (await refresh(creds)).accessToken;
}

export function status(): { connected: boolean; email: string | null } {
  const creds = loadCredentials();
  return { connected: creds !== null, email: creds?.email ?? null };
}

export async function logout(): Promise<void> {
  const creds = loadCredentials();
  clearCredentials();
  if (!creds) return;
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(creds.refreshToken)}`, {
      method: 'POST',
    });
  } catch {
    // Revocation is best-effort — the local credentials are already gone.
  }
}
