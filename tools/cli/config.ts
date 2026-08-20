/**
 * Filesystem home for the CLI: `$XDG_CONFIG_HOME/taskmate-cli` or
 * `~/.config/taskmate-cli`. Three files live there — OAuth credentials, the
 * last-known sync position, and a cached copy of the document — the same
 * three things `web/src/lib/storage.ts` keeps in IndexedDB for the browser.
 */
import { mkdirSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export class CliError extends Error {}

function configRoot(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  return join(xdg && xdg.length > 0 ? xdg : join(homedir(), '.config'), 'taskmate-cli');
}

export function ensureConfigDir(): string {
  const dir = configRoot();
  mkdirSync(dir, { recursive: true });
  // Credentials live in this directory; keep it private on POSIX systems.
  try {
    chmodSync(dir, 0o700);
  } catch {
    // Best-effort — e.g. unsupported on the current filesystem.
  }
  return dir;
}

export const credentialsPath = (): string => join(ensureConfigDir(), 'credentials.json');
export const syncMetaPath = (): string => join(ensureConfigDir(), 'sync-meta.json');
export const docCachePath = (): string => join(ensureConfigDir(), 'doc.automerge');

/**
 * The CLI is its own OAuth client, distinct from the web app's — Google issues
 * "Desktop app" / "TVs and Limited Input devices" clients a client_secret too,
 * but not as something that stays confidential (it ships in public samples),
 * so requiring it here is normal for this client type, not a leak.
 */
export function clientId(): string {
  const id = process.env.TASKMATE_CLI_CLIENT_ID?.trim();
  if (!id) throw new CliError('TASKMATE_CLI_CLIENT_ID não está definido. Veja tools/cli/README.md.');
  return id;
}

export function clientSecret(): string {
  const secret = process.env.TASKMATE_CLI_CLIENT_SECRET?.trim();
  if (!secret) throw new CliError('TASKMATE_CLI_CLIENT_SECRET não está definido. Veja tools/cli/README.md.');
  return secret;
}
