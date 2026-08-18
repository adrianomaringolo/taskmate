/**
 * Convergence tests for the sync engine.
 *
 * These are the tests that justify choosing a CRDT. Each scenario reproduces a
 * way a plain "download the file, upload the file" loop loses data, and asserts
 * that this one does not. The fake store below is deliberately hostile: it has
 * no locking, no conditional writes, and it can be told to drop an upload or let
 * one device silently overwrite another — exactly what Google Drive does.
 *
 *   npx tsx tools/sync.test.ts
 */
import * as doc from '../web/src/lib/doc.js';
import { syncOnce, type RemoteFile, type Transport } from '../web/src/lib/sync.js';
import { EMPTY_SYNC_META, type SyncMeta } from '../web/src/lib/storage.js';

// --- a hostile fake Drive ------------------------------------------------

class FakeStore {
  private file: { id: string; bytes: Uint8Array; revision: number } | null = null;
  private nextRevision = 1;

  /** Number of subsequent uploads to accept the request for, then discard. */
  dropUploads = 0;

  readonly counts = { find: 0, create: 0, stat: 0, download: 0, upload: 0 };

  get transport(): Transport {
    return {
      findFile: async (): Promise<RemoteFile | null> => {
        this.counts.find++;
        return this.file ? this.describe() : null;
      },
      createFile: async (bytes: Uint8Array): Promise<RemoteFile> => {
        this.counts.create++;
        this.file = { id: 'file-1', bytes: bytes.slice(), revision: this.nextRevision++ };
        return this.describe();
      },
      statFile: async (): Promise<RemoteFile> => {
        this.counts.stat++;
        if (!this.file) throw new Error('404');
        return this.describe();
      },
      downloadFile: async (): Promise<Uint8Array> => {
        this.counts.download++;
        if (!this.file) throw new Error('404');
        return this.file.bytes.slice();
      },
      uploadFile: async (_id: string, bytes: Uint8Array): Promise<RemoteFile> => {
        this.counts.upload++;
        if (!this.file) throw new Error('404');
        if (this.dropUploads > 0) {
          // The upload "succeeded" from the client's point of view and was then
          // lost — the worst case, because nothing reports an error.
          this.dropUploads--;
          return { id: this.file.id, revision: String(this.nextRevision++), modifiedTime: null };
        }
        this.file = { id: this.file.id, bytes: bytes.slice(), revision: this.nextRevision++ };
        return this.describe();
      },
    };
  }

  private describe(): RemoteFile {
    if (!this.file) throw new Error('no file');
    return { id: this.file.id, revision: String(this.file.revision), modifiedTime: null };
  }

  contents(): doc.Doc | null {
    return this.file ? doc.load(this.file.bytes) : null;
  }

  /** Simulates a write landing without the writer having seen the current file. */
  overwrite(bytes: Uint8Array): void {
    if (!this.file) throw new Error('no file');
    this.file = { id: this.file.id, bytes: bytes.slice(), revision: this.nextRevision++ };
  }

  raw(): Uint8Array | null {
    return this.file ? this.file.bytes.slice() : null;
  }

  truncate(): void {
    if (this.file) this.file = { ...this.file, bytes: new Uint8Array(0), revision: this.nextRevision++ };
  }
}

/** One simulated device: its own document and its own sync metadata. */
class Device {
  doc: doc.Doc;
  meta: SyncMeta = { ...EMPTY_SYNC_META };

  constructor(
    readonly name: string,
    readonly store: FakeStore
  ) {
    this.doc = doc.createDoc();
  }

  edit(fn: (d: doc.Doc) => doc.Doc): this {
    this.doc = fn(this.doc);
    return this;
  }

  async sync(): Promise<void> {
    const out = await syncOnce({ transport: this.store.transport, doc: this.doc, meta: this.meta });
    this.doc = out.doc;
    this.meta = out.meta;
  }

  titles(): string[] {
    return doc.project(this.doc).tasks.map((t) => t.title).sort();
  }

  state() {
    return doc.project(this.doc);
  }
}

// --- test harness -------------------------------------------------------

let failures = 0;
let current = '';

const test = async (name: string, fn: () => Promise<void>) => {
  current = name;
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${name}\n      ${err instanceof Error ? err.message : String(err)}`);
  }
};

function assert(ok: boolean, message: string): void {
  if (!ok) throw new Error(message);
}

function assertSame(a: unknown, b: unknown, message: string): void {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${message}\n      esquerda: ${sa}\n      direita:  ${sb}`);
}

const listOf = (device: Device) => device.state().lists.find((l) => l.isInbox)!.id;

// --- scenarios ----------------------------------------------------------

await test('dois dispositivos editando offline convergem', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  const b = new Device('B', store);

  a.edit((d) => doc.addTask(d, { listId: listOf(a), title: 'do A' })[0]);
  b.edit((d) => doc.addTask(d, { listId: listOf(b), title: 'do B' })[0]);

  await a.sync();
  await b.sync();
  await a.sync();

  assertSame(a.titles(), ['do A', 'do B'], 'A não tem as duas tarefas');
  assertSame(b.titles(), ['do A', 'do B'], 'B não tem as duas tarefas');
  assertSame(a.state(), b.state(), 'as projeções divergem');
});

await test('upload perdido silenciosamente é recuperado no ciclo seguinte', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  const b = new Device('B', store);

  a.edit((d) => doc.addTask(d, { listId: listOf(a), title: 'do A' })[0]);
  await a.sync();

  b.edit((d) => doc.addTask(d, { listId: listOf(b), title: 'do B' })[0]);
  store.dropUploads = 1; // B's merged upload vanishes without an error
  await b.sync();

  assert(
    !store.contents()!.tasks || !Object.values(store.contents()!.tasks).some((t) => t.title === 'do B'),
    'o upload deveria ter sido descartado pelo fake'
  );

  await b.sync(); // the recovery cycle
  const remote = doc.project(store.contents()!).tasks.map((t) => t.title).sort();
  assertSame(remote, ['do A', 'do B'], 'o arquivo não recuperou a tarefa de B');

  await a.sync();
  assertSame(a.titles(), ['do A', 'do B'], 'A não recebeu a tarefa de B');
});

await test('clobber simultâneo não perde dados de nenhum lado', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  await a.sync(); // publishes the file
  const b = new Device('B', store);
  await b.sync(); // B now knows the file

  // Both edit, both believe they are up to date.
  a.edit((d) => doc.addTask(d, { listId: listOf(a), title: 'do A' })[0]);
  b.edit((d) => doc.addTask(d, { listId: listOf(b), title: 'do B' })[0]);

  await a.sync(); // A uploads
  // B never saw A's revision: force its write to land on top, destroying A's.
  store.overwrite(doc.save(b.doc));

  await a.sync(); // A notices, merges, re-uploads the union
  await b.sync();

  assertSame(a.titles(), ['do A', 'do B'], 'A perdeu algo');
  assertSame(b.titles(), ['do A', 'do B'], 'B perdeu algo');
  assertSame(a.state(), b.state(), 'as projeções divergem');
});

await test('edição concorrente no mesmo campo converge para o mesmo valor', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  const [withTask, taskId] = doc.addTask(a.doc, { listId: listOf(a), title: 'original' });
  a.doc = withTask;
  await a.sync();
  const b = new Device('B', store);
  await b.sync();

  a.edit((d) => doc.patchTask(d, taskId, { title: 'versão do A' }));
  b.edit((d) => doc.patchTask(d, taskId, { title: 'versão do B' }));

  await a.sync();
  await b.sync();
  await a.sync();

  const ta = a.state().tasks.find((t) => t.id === taskId)!;
  const tb = b.state().tasks.find((t) => t.id === taskId)!;
  assert(ta.title === tb.title, `títulos divergiram: ${ta.title} vs ${tb.title}`);
  assert(
    ta.title === 'versão do A' || ta.title === 'versão do B',
    `título virou algo inesperado: ${ta.title}`
  );
});

await test('tarefa recorrente concluída offline nos dois dispositivos avança uma vez só', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  const [withTask, taskId] = doc.addTask(a.doc, {
    listId: listOf(a),
    title: 'regar as plantas',
    dueDate: '2026-08-17',
  });
  a.doc = doc.patchTask(withTask, taskId, { recurrence: { unit: 'week' } });
  await a.sync();
  const b = new Device('B', store);
  await b.sync();

  // Neither device has seen the other complete it — both compute the next
  // date from the same 2026-08-17, so both writes should agree.
  a.edit((d) => doc.patchTask(d, taskId, { done: true }));
  b.edit((d) => doc.patchTask(d, taskId, { done: true }));

  await a.sync();
  await b.sync();
  await a.sync();

  const ta = a.state().tasks.find((t) => t.id === taskId)!;
  const tb = b.state().tasks.find((t) => t.id === taskId)!;
  assert(!ta.done, 'uma tarefa recorrente não deveria ficar marcada como concluída');
  assertSame(ta.dueDate, '2026-08-24', 'o prazo não avançou uma semana');
  assertSame(ta, tb, 'os dois dispositivos divergiram sobre a tarefa');
});

await test('excluir num dispositivo e editar no outro não ressuscita a tarefa', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  const [withTask, taskId] = doc.addTask(a.doc, { listId: listOf(a), title: 'condenada' });
  a.doc = withTask;
  await a.sync();
  const b = new Device('B', store);
  await b.sync();

  a.edit((d) => doc.removeTask(d, taskId));
  b.edit((d) => doc.patchTask(d, taskId, { notes: 'editada offline' }));

  await a.sync();
  await b.sync();
  await a.sync();

  assert(!a.titles().includes('condenada'), 'a tarefa voltou em A');
  assert(!b.titles().includes('condenada'), 'a tarefa voltou em B');
  assertSame(a.state(), b.state(), 'as projeções divergem');
});

await test('reordenação concorrente não duplica nem divide a ordem', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  let d = a.doc;
  const ids: string[] = [];
  for (const title of ['um', 'dois', 'três', 'quatro']) {
    const [next, id] = doc.addTask(d, { listId: listOf(a), title });
    d = next;
    ids.push(id);
  }
  a.doc = d;
  await a.sync();
  const b = new Device('B', store);
  await b.sync();

  const list = listOf(a);
  a.edit((x) => doc.moveTask(x, ids[3]!, list, 0)); // "quatro" to the top
  b.edit((x) => doc.moveTask(x, ids[0]!, list, 3)); // "um" to the bottom

  await a.sync();
  await b.sync();
  await a.sync();

  const ta = a.state().tasks.map((t) => t.title);
  const tb = b.state().tasks.map((t) => t.title);
  assertSame(ta, tb, 'a ordem divergiu entre dispositivos');
  assert(new Set(ta).size === ta.length, `há duplicatas: ${ta.join(', ')}`);
  assert(ta.length === 4, `número de tarefas mudou: ${ta.length}`);
});

await test('a Entrada criada de forma independente converge para uma só', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  const b = new Device('B', store); // both created their own inbox offline

  a.edit((x) => doc.addTask(x, { listId: listOf(a), title: 'do A' })[0]);
  b.edit((x) => doc.addTask(x, { listId: listOf(b), title: 'do B' })[0]);

  await a.sync();
  await b.sync();
  await a.sync();

  const inboxes = a.state().lists.filter((l) => l.isInbox);
  assert(inboxes.length === 1, `${inboxes.length} Entradas em vez de 1`);
  assertSame(a.titles(), ['do A', 'do B'], 'tarefas se perderam entre as Entradas');
  assertSame(a.state(), b.state(), 'as projeções divergem');
});

await test('terceiro dispositivo entra e recebe tudo', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  let d = a.doc;
  const [g, groupId] = doc.addGroup(d, 'Trabalho', 'indigo');
  d = g;
  const [l, listId] = doc.addList(d, groupId, 'Sprint');
  d = l;
  d = doc.addTask(d, { listId, title: 'tarefa em grupo' })[0];
  a.doc = d;
  await a.sync();

  const c = new Device('C', store);
  await c.sync();

  assertSame(c.titles(), ['tarefa em grupo'], 'C não recebeu a tarefa');
  assertSame(
    c.state().groups.map((x) => x.name),
    ['Trabalho'],
    'C não recebeu o grupo'
  );
  assertSame(c.state().lists.map((x) => x.name).sort(), ['Entrada', 'Sprint'], 'C não recebeu a lista');
});

await test('fila offline longa chega inteira num único sync', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  await a.sync();
  const b = new Device('B', store);
  await b.sync();

  let d = b.doc;
  for (let i = 0; i < 40; i++) d = doc.addTask(d, { listId: listOf(b), title: `offline ${i}` })[0];
  b.doc = d;

  await b.sync();
  await a.sync();

  assert(a.titles().length === 40, `A recebeu ${a.titles().length} de 40`);
  assertSame(a.state(), b.state(), 'as projeções divergem');
});

await test('sync sem mudanças não gasta upload', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  a.edit((x) => doc.addTask(x, { listId: listOf(a), title: 'única' })[0]);
  await a.sync();

  const uploadsAfterFirst = store.counts.upload + store.counts.create;
  await a.sync();
  await a.sync();

  assert(
    store.counts.upload + store.counts.create === uploadsAfterFirst,
    `gastou ${store.counts.upload + store.counts.create - uploadsAfterFirst} upload(s) à toa`
  );
  assert(store.counts.download <= 1, `baixou ${store.counts.download} vezes sem necessidade`);
});

await test('arquivo remoto truncado não apaga os dados locais', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  a.edit((x) => doc.addTask(x, { listId: listOf(a), title: 'preciosa' })[0]);
  await a.sync();

  store.truncate(); // an interrupted upload left a 0-byte file
  await a.sync();

  assertSame(a.titles(), ['preciosa'], 'os dados locais foram perdidos');
  const remote = store.contents();
  assert(remote !== null, 'o arquivo remoto continuou vazio');
  assertSame(
    doc.project(remote!).tasks.map((t) => t.title),
    ['preciosa'],
    'o arquivo remoto não foi reconstruído'
  );
});

await test('tarefa move entre listas e a origem não fica com fantasma', async () => {
  const store = new FakeStore();
  const a = new Device('A', store);
  let d = a.doc;
  const [g, groupId] = doc.addGroup(d, 'Casa', 'green');
  d = g;
  const [l, listId] = doc.addList(d, groupId, 'Mercado');
  d = l;
  const [t, taskId] = doc.addTask(d, { listId: listOf(a), title: 'comprar café' });
  d = t;
  a.doc = d;
  await a.sync();
  const b = new Device('B', store);
  await b.sync();

  a.edit((x) => doc.moveTask(x, taskId, listId, 0));
  await a.sync();
  await b.sync();

  const inB = b.state().tasks.filter((x) => x.title === 'comprar café');
  assert(inB.length === 1, `${inB.length} cópias em B`);
  assert(inB[0]!.listId === listId, 'a tarefa não chegou na lista de destino em B');
});

console.log(
  failures === 0
    ? `\nTodos os cenários de convergência passaram.`
    : `\n${failures} cenário(s) falharam. Último: ${current}`
);
process.exit(failures === 0 ? 0 : 1);
