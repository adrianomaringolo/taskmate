/**
 * Demo dataset, built with the app's own document module and injected straight
 * into IndexedDB. Building it here rather than clicking through the UI keeps the
 * fixture fast and, more importantly, exercises the same `doc.ts` the app runs —
 * a fixture written against a parallel implementation would drift.
 */
import type { Page } from 'playwright';
import * as doc from '../web/src/lib/doc.js';

const day = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function demoDoc(): doc.Doc {
  let d = doc.createDoc();
  const inbox = doc.INBOX_ID;

  const [g1, acme] = doc.addGroup(d, 'Cliente Acme', 'indigo');
  d = g1;
  const [g2, casa] = doc.addGroup(d, 'Casa', 'green');
  d = g2;
  const [g3, estudos] = doc.addGroup(d, 'Estudos', 'violet');
  d = g3;

  const [l1, sprint] = doc.addList(d, acme, 'Sprint 14');
  d = l1;
  const [l2, contrato] = doc.addList(d, acme, 'Contrato e faturamento');
  d = l2;
  const [l3, reforma] = doc.addList(d, casa, 'Reforma da cozinha');
  d = l3;
  const [l4] = doc.addList(d, casa, 'Mercado');
  d = l4;
  const [l5, rust] = doc.addList(d, estudos, 'Rust');
  d = l5;

  const rows: Array<[string, string, { dueDate?: string; priority?: 0 | 1 | 2 | 3 }]> = [
    [sprint, 'Revisar PR do módulo de cobrança', { dueDate: day(0), priority: 3 }],
    [sprint, 'Quebrar a épica de importação em histórias', { dueDate: day(-2), priority: 2 }],
    [sprint, 'Subir migração do índice de busca', { dueDate: day(1) }],
    [sprint, 'Escrever o teste de carga do endpoint /export', {}],
    [contrato, 'Enviar nota fiscal de julho', { dueDate: day(-1), priority: 3 }],
    [contrato, 'Confirmar o reajuste anual antes da renovação', { dueDate: day(4), priority: 1 }],
    [reforma, 'Pedir três orçamentos de bancada', { dueDate: day(2) }],
    [reforma, 'Medir o vão da geladeira nova', { dueDate: day(0), priority: 1 }],
    [rust, 'Terminar o capítulo de ownership', { dueDate: day(3) }],
    [rust, 'Reescrever o parser do exercício 4 sem clone()', {}],
    [inbox, 'Ver se vale trocar o plano do celular', {}],
    [inbox, 'Marcar dentista', { dueDate: day(6) }],
  ];

  const ids = new Map<string, string>();
  for (const [listId, title, extra] of rows) {
    const [next, id] = doc.addTask(d, { listId, title, ...extra });
    d = next;
    ids.set(title, id);
  }

  // A couple completed and one with notes, so those states are real in shots.
  d = doc.patchTask(d, ids.get('Escrever o teste de carga do endpoint /export')!, { done: true });
  d = doc.patchTask(d, ids.get('Medir o vão da geladeira nova')!, { done: true });
  d = doc.patchTask(d, ids.get('Enviar nota fiscal de julho')!, {
    notes: 'Valor fechado em 18.400. Anexar o relatório de horas de julho antes de emitir.',
  });

  return d;
}

const toBase64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

/**
 * Writes a document into the page's IndexedDB before the app boots. Must run
 * before the first navigation to the app, or the store will have already
 * created an empty document.
 */
export async function installDoc(page: Page, document: doc.Doc): Promise<void> {
  const base64 = toBase64(doc.save(document));

  await page.evaluate(async (b64: string) => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('taskmate', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv');
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(bytes, 'doc');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  }, base64);
}

/** Empties local storage for the origin, so a run starts from first-use state. */
export async function wipe(page: Page): Promise<void> {
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('taskmate');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
}
