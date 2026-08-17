/**
 * Verifies the Trellis → Taskmate rename did not strand anyone's data.
 *
 * Renaming an app is cosmetic right up to the moment it touches a persisted
 * identifier. Three did: the IndexedDB database, the localStorage namespace, and
 * the filename in Drive. The first two are covered here by planting data under
 * the *old* names and asserting the app adopts it.
 *
 * (The Drive filename is handled in `drive.ts` by looking for the legacy name and
 * renaming it in place. That path needs a real Drive to exercise and is the one
 * thing to watch on the first sync after the rename.)
 *
 *   npm run dev          (in another terminal)
 *   npm run test:rename
 */
import { chromium, type Page } from 'playwright';
import { demoDoc } from './seed.js';
import * as doc from '../web/src/lib/doc.js';

const WEB = process.argv[2] ?? 'http://127.0.0.1:5173';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

/** Plants a document in the pre-rename IndexedDB database, as the old build would. */
async function installLegacy(page: Page, bytes: Uint8Array): Promise<void> {
  const base64 = Buffer.from(bytes).toString('base64');
  await page.evaluate(async (b64: string) => {
    const binary = atob(b64);
    const raw = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) raw[i] = binary.charCodeAt(i);

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('trellis', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv');
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(raw, 'doc');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });

    // And the old preference namespace.
    localStorage.setItem('trellis:theme', 'dark');
    localStorage.setItem('trellis:collapsed', '[]');
  }, base64);
}

const dbNames = (page: Page) =>
  page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name).filter(Boolean).sort());

async function run() {
  const browser = await chromium.launch();

  // --- a browser that used the old build --------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    /*
     * Reach the origin via a plain asset, not the app. Loading the SPA first would
     * boot it, and boot creates empty storage under the *new* names — after which
     * the migration correctly finds nothing to adopt and the test would be
     * measuring its own setup. A real user already has the old data on disk before
     * the new build ever runs.
     */
    await page.goto(`${WEB}/icon-192.png`, { waitUntil: 'domcontentloaded' });
    await installLegacy(page, doc.save(demoDoc()));

    await page.goto(WEB, { waitUntil: 'networkidle' });

    await page.locator('.view-head__title').waitFor();

    // The demo document has three groups; a first-run document has none.
    const groups = await page.locator('.group__name').allInnerTexts();
    check(
      'documento do banco antigo é adotado, não descartado',
      groups.length === 3,
      groups.join(' / ') || '(nenhum grupo — dados perdidos)'
    );

    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    check('tema salvo no namespace antigo é preservado', theme === 'dark', `data-theme=${theme}`);

    const migrated = await page.evaluate(() => ({
      novo: localStorage.getItem('taskmate:theme'),
      antigo: localStorage.getItem('trellis:theme'),
    }));
    check(
      'a preferência migra de namespace e o antigo é limpo',
      migrated.novo === 'dark' && migrated.antigo === null,
      JSON.stringify(migrated)
    );

    // The adopted document must now live under the current name, so the legacy
    // read happens once rather than on every boot.
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.group__name').first().waitFor();
    const stillThere = await page.locator('.group__name').count();
    check('sobrevive a um segundo reload (foi copiado, não só lido)', stillThere === 3, `${stillThere} grupos`);

    check('sem erros de console', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // --- a browser that never saw the old build ---------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
    const page = await ctx.newPage();
    await page.goto(WEB, { waitUntil: 'networkidle' });
    await page.locator('.view-head__title').waitFor();

    const names = await dbNames(page);
    check(
      'primeiro uso não cria o banco antigo como efeito colateral',
      names.includes('taskmate') && !names.includes('trellis'),
      names.join(', ')
    );
    await ctx.close();
  }

  await browser.close();
  console.log(failures === 0 ? '\nMigração da renomeação verificada.' : `\n${failures} falha(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

await run();
