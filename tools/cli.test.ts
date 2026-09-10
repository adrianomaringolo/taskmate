/**
 * Exercises the CLI's own pull/push wrapper (tools/cli/data.ts) against a fake
 * Drive, the same way tools/sync.test.ts exercises syncOnce itself. What this
 * adds on top: proof that the `--create` gate actually refuses to create a
 * file on a fresh cache, and that two separate CLI "installs" (distinct
 * config directories, same fake Drive) converge — the scenario a second
 * device or a second agent process is really standing in for.
 *
 *   npx tsx tools/cli.test.ts
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as doc from '../web/src/lib/doc.js';
import type { RemoteFile, Transport } from '../web/src/lib/sync.js';

let failures = 0;
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    failures++;
    console.error(`FAIL: ${msg}`);
  } else {
    console.log(`ok: ${msg}`);
  }
}

class FakeStore {
  private file: { id: string; bytes: Uint8Array; revision: number } | null = null;
  private nextRevision = 1;

  get transport(): Transport {
    return {
      findFile: async (): Promise<RemoteFile | null> => (this.file ? this.describe() : null),
      createFile: async (bytes: Uint8Array): Promise<RemoteFile> => {
        this.file = { id: 'file-1', bytes: bytes.slice(), revision: this.nextRevision++ };
        return this.describe();
      },
      statFile: async (): Promise<RemoteFile> => {
        if (!this.file) throw new Error('404');
        return this.describe();
      },
      downloadFile: async (): Promise<Uint8Array> => {
        if (!this.file) throw new Error('404');
        return this.file.bytes.slice();
      },
      uploadFile: async (_id: string, bytes: Uint8Array): Promise<RemoteFile> => {
        if (!this.file) throw new Error('404');
        this.file = { id: this.file.id, bytes: bytes.slice(), revision: this.nextRevision++ };
        return this.describe();
      },
    };
  }

  private describe(): RemoteFile {
    if (!this.file) throw new Error('no file');
    return { id: this.file.id, revision: String(this.file.revision), modifiedTime: null };
  }
}

/** A fresh config dir per "install", so cli/data.ts's cache does not bleed across scenarios. */
function freshInstall<T>(run: () => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'taskmate-cli-test-'));
  process.env.XDG_CONFIG_HOME = dir;
  return run().finally(() => rmSync(dir, { recursive: true, force: true }));
}

async function main(): Promise<void> {
  const originalXdg = process.env.XDG_CONFIG_HOME;

  // Import after env is set per-scenario, and reset the module's require cache
  // is unnecessary: config.ts reads process.env.XDG_CONFIG_HOME on every call,
  // not once at import time, so a fresh directory per scenario is enough.
  const { pull, push } = await import('./cli/data.js');
  const { CliError } = await import('./cli/config.js');

  // Scenario 1: empty Drive, no --create → refuses rather than forking.
  await freshInstall(async () => {
    const store = new FakeStore();
    let threw = false;
    try {
      await pull(store.transport, false);
    } catch (err) {
      threw = err instanceof CliError;
    }
    assert(threw, '--create gate refuses to pull/create against an empty Drive without the flag');
  });

  // Scenario 2: empty Drive, --create → creates and returns a usable doc.
  await freshInstall(async () => {
    const store = new FakeStore();
    const d = await pull(store.transport, true);
    const state = doc.project(d);
    assert(state.lists.some((l) => l.isInbox), '--create seeds a document with the shared inbox');
  });

  // Scenario 3: two independent installs against the same Drive file converge.
  const store = new FakeStore();
  let taskId = '';
  await freshInstall(async () => {
    const d = await pull(store.transport, true);
    const [next, id] = doc.addTask(d, { listId: 'inbox', title: 'Da CLI A' });
    taskId = id;
    await push(store.transport, next);
  });

  await freshInstall(async () => {
    const d = await pull(store.transport, false); // file already exists; no --create needed
    const state = doc.project(d);
    assert(
      state.tasks.some((t) => t.id === taskId && t.title === 'Da CLI A'),
      'a second install pulls the task the first one pushed'
    );
    const next = doc.patchTask(d, taskId, { done: true });
    await push(store.transport, next);
  });

  await freshInstall(async () => {
    const d = await pull(store.transport, false);
    const state = doc.project(d);
    const task = state.tasks.find((t) => t.id === taskId);
    assert(task?.done === true, 'the first install would see the second install’s completion on its next pull');
  });

  if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = originalXdg;

  if (failures > 0) {
    console.error(`\n${failures} failure(s).`);
    process.exitCode = 1;
  } else {
    console.log('\nAll CLI sync scenarios passed.');
  }
}

void main();
