/**
 * Proves the service worker does the one thing it exists for: opening the app
 * with no network at all.
 *
 * Needs the *production* build behind a static server, because the service
 * worker is deliberately disabled in dev (it would shadow HMR and hide errors):
 *
 *   npm run build
 *   npx vite preview --port 5180 --strictPort   (in another terminal)
 *   npx tsx tools/offline.test.ts
 */
import { chromium, type Page } from 'playwright';
import { demoDoc, installDoc } from './seed.js';

const WEB = process.argv[2] ?? 'http://127.0.0.1:5180';

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

const swState = (page: Page) =>
  page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      registered: !!reg,
      controlled: !!navigator.serviceWorker.controller,
      active: reg?.active?.state ?? null,
    };
  });

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // --- install ----------------------------------------------------------
  await page.goto(WEB, { waitUntil: 'networkidle' });
  await page.locator('.view-head__title').waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);

  let state = await swState(page);
  check('service worker registrado e ativo', state.registered && state.active === 'activated', JSON.stringify(state));

  // With registerType 'prompt' the worker does not claim the page that installed
  // it; it takes control on the next navigation.
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.view-head__title').waitFor();
  state = await swState(page);
  check('a página passa a ser controlada pelo worker', state.controlled, JSON.stringify(state));

  // --- data to look for after the lights go out -------------------------
  await installDoc(page, demoDoc());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('button.row', { hasText: 'Entrada' }).click();

  const quick = page.getByLabel('Nova tarefa em Entrada');
  await quick.fill('escrita antes de ficar offline');
  await quick.press('Enter');
  await page.locator('.task', { hasText: 'escrita antes de ficar offline' }).waitFor();
  await page.waitForTimeout(300);

  // --- the actual test --------------------------------------------------
  await ctx.setOffline(true);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.view-head__title').waitFor({ timeout: 15_000 });
  check('o app ABRE com a rede desligada', true);

  await page.locator('button.row', { hasText: 'Entrada' }).click();
  await page.locator('.task', { hasText: 'escrita antes de ficar offline' }).waitFor({ timeout: 10_000 });
  check('os dados estão lá depois do reload offline', true);

  // Automerge lives in WebAssembly; if the wasm had not been precached the app
  // would render its shell and then fail to read its own document.
  const counts = await page.evaluate(() => document.querySelectorAll('.task').length);
  check('o wasm do Automerge veio do cache (documento legível)', counts > 0, `${counts} linhas`);

  // Still fully writable while offline.
  const quickOffline = page.getByLabel('Nova tarefa em Entrada');
  await quickOffline.fill('criada já offline');
  await quickOffline.press('Enter');
  await page.locator('.task', { hasText: 'criada já offline' }).waitFor();
  check('escreve normalmente estando offline', true);

  // The row appears from React state; the IndexedDB write lands on the next
  // tick. Playwright reloads faster than any human could, so settle first —
  // this is test timing, not a durability gap.
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('button.row', { hasText: 'Entrada' }).click();
  await page.locator('.task', { hasText: 'criada já offline' }).waitFor({ timeout: 10_000 });
  check('segundo reload offline mantém a escrita offline', true);

  await ctx.setOffline(false);

  // The manifest is what makes it installable.
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
    if (!href) return null;
    return (await (await fetch(href)).json()) as Record<string, unknown>;
  });
  check(
    'manifest instalável (nome, display, ícones)',
    !!manifest &&
      manifest.display === 'standalone' &&
      Array.isArray(manifest.icons) &&
      (manifest.icons as unknown[]).length >= 3,
    manifest ? `display=${String(manifest.display)}, ícones=${(manifest.icons as unknown[]).length}` : 'ausente'
  );

  const maskable = Array.isArray(manifest?.icons)
    ? (manifest.icons as Array<{ purpose?: string }>).some((i) => i.purpose === 'maskable')
    : false;
  check('tem ícone maskable', maskable);

  check('sem erros de console', errors.length === 0, errors.slice(0, 3).join(' | '));

  await ctx.close();
  await browser.close();
  console.log(failures === 0 ? '\nOffline verificado.' : `\n${failures} falha(s).`);
  process.exit(failures === 0 ? 0 : 1);
}

await run();
