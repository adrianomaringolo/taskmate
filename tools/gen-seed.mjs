#!/usr/bin/env node
/**
 * Generates the constant seed document embedded in web/src/lib/doc.ts.
 *
 * Every device MUST start from these exact bytes. Two documents created by
 * separate A.from() calls have unrelated roots, and merging them silently keeps
 * one side and discards the other — no error, no warning. A shared seed gives
 * every device a common ancestor, which is what makes merge total.
 *
 * Deterministic: fixed actor id, fixed timestamps. Re-running prints the same
 * bytes. Changing the seed is a breaking change for existing documents.
 *
 *   node tools/gen-seed.mjs
 */
import * as A from '@automerge/automerge';

const ACTOR = '00000000000000000000000000000001';
const EPOCH = '2026-01-01T00:00:00.000Z';

let doc = A.from(
  {
    schema: 1,
    groups: {},
    lists: {
      inbox: {
        id: 'inbox',
        groupId: null,
        name: 'Entrada',
        order: 'a0',
        isInbox: true,
        createdAt: EPOCH,
        updatedAt: EPOCH,
        deletedAt: null,
      },
    },
    tasks: {},
  },
  { actor: ACTOR }
);

const bytes = A.save(doc);
const b64 = Buffer.from(bytes).toString('base64');

// Prove it: two independent loads of these bytes must merge without loss.
let x = A.load(A.save(A.load(bytes)));
let y = A.load(bytes);
x = A.change(x, (d) => { d.tasks.a = { id: 'a', title: 'X' }; });
y = A.change(y, (d) => { d.tasks.b = { id: 'b', title: 'Y' }; });
const merged = A.merge(A.clone(x), y);
const keys = Object.keys(merged.tasks).sort().join(',');
if (keys !== 'a,b') {
  console.error(`FALHA: merge da semente perdeu dados (chaves: ${keys})`);
  process.exit(1);
}

console.log(`bytes: ${bytes.byteLength}`);
console.log(`merge check: ok (${keys})`);
console.log(`\n${b64}`);
