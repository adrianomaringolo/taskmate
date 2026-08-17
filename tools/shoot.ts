/**
 * Captures the surface in both themes and both breakpoints, plus the two panels
 * that only exist on interaction. Screenshots land in tools/shots/.
 *
 *   npm run dev      (in another terminal)
 *   npm run shots
 */
import { mkdirSync } from 'node:fs';
import { chromium, type Browser } from 'playwright';
import { demoDoc, installDoc } from './seed.js';

const WEB = process.argv[2] ?? 'http://127.0.0.1:5173';
const OUT = new URL('./shots/', import.meta.url).pathname;

async function shot(
  browser: Browser,
  name: string,
  opts: {
    theme: 'light' | 'dark';
    width: number;
    height: number;
    touch?: boolean;
    seeded?: boolean;
    act?: (page: Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>) => Promise<void>;
  }
): Promise<void> {
  const ctx = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    colorScheme: opts.theme,
    deviceScaleFactor: 2,
    locale: 'pt-BR',
    ...(opts.touch ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(WEB, { waitUntil: 'networkidle' });
  if (opts.seeded !== false) {
    await installDoc(page, demoDoc());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.group__name', { hasText: 'Cliente Acme' }).first().waitFor();
  } else {
    await page.locator('.view-head__title').waitFor();
  }

  await opts.act?.(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}${name}.png` });
  if (errors.length) console.log(`  ⚠ ${name}:`, errors.slice(0, 3));
  console.log(`${OUT}${name}.png`);
  await ctx.close();
}

const openList = (label: string) => async (page: { locator: (s: string, o?: unknown) => any }) => {
  await page.locator('button.row', { hasText: label }).click();
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const theme of ['light', 'dark'] as const) {
    await shot(browser, `${theme}-desktop`, {
      theme,
      width: 1440,
      height: 940,
      act: openList('Sprint 14'),
    });
    await shot(browser, `${theme}-mobile`, { theme, width: 390, height: 844, touch: true });
  }

  await shot(browser, 'detail', {
    theme: 'light',
    width: 1440,
    height: 940,
    act: async (page) => {
      await page.locator('button.row', { hasText: 'Contrato e faturamento' }).click();
      await page.getByRole('button', { name: /^Abrir detalhes$/ }).first().click();
    },
  });

  await shot(browser, 'sync-panel', {
    theme: 'light',
    width: 1440,
    height: 940,
    act: async (page) => {
      await page.locator('button.row', { hasText: 'Sprint 14' }).click();
      await page.getByRole('button', { name: /^Sincronização/ }).click();
    },
  });

  for (const theme of ['light', 'dark'] as const) {
    await shot(browser, `first-run-${theme}`, {
      theme,
      width: 1280,
      height: 820,
      seeded: false,
      act: async (page) => {
        await page.locator('button.row', { hasText: 'Entrada' }).click();
      },
    });
  }

  await browser.close();
}

await main();
