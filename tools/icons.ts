/**
 * Renders the app icons from the brand mark. Uses the browser already installed
 * for tests rather than adding a rasteriser dependency.
 *
 *   npx tsx tools/icons.ts
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = new URL('../web/public/', import.meta.url).pathname;

// The same mark as the sidebar and favicon: a checkbox with a tick. Amber fill
// with dark ink, matching --brand / --on-brand rather than white-on-colour.
const BRAND = '#cc7d2a';
const INK = '#2a1c10';

const mark = (stroke: string, weight: number) => `
  <rect x="2" y="2" width="12" height="12" rx="3.6"
        fill="none" stroke="${stroke}" stroke-width="${weight}"
        stroke-linejoin="round" />
  <path d="M5 8.2l2.2 2.2L11.2 5.8"
        fill="none" stroke="${stroke}" stroke-width="${weight}"
        stroke-linecap="round" stroke-linejoin="round" />`;

interface Spec {
  file: string;
  size: number;
  /** Maskable icons need the art inside a ~80% safe zone on an opaque field. */
  maskable?: boolean;
}

const SPECS: Spec[] = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const spec of SPECS) {
    const ctx = await browser.newContext({
      viewport: { width: spec.size, height: spec.size },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();

    const inner = spec.maskable
      ? `<div class="pad"><svg viewBox="0 0 16 16">${mark(INK, 1.7)}</svg></div>`
      : `<svg viewBox="0 0 16 16">${mark(BRAND, 1.6)}</svg>`;

    await page.setContent(`<style>
      html,body{margin:0;width:${spec.size}px;height:${spec.size}px}
      body{background:${spec.maskable ? BRAND : 'transparent'};display:grid;place-items:center}
      svg{width:100%;height:100%;display:block}
      .pad{width:72%;height:72%}
    </style>${inner}`);

    await page.screenshot({
      path: `${OUT}${spec.file}`,
      omitBackground: !spec.maskable,
    });
    console.log(`${OUT}${spec.file} (${spec.size}px${spec.maskable ? ', maskable' : ''})`);
    await ctx.close();
  }

  await browser.close();
}

await main();
