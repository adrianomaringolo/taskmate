/**
 * Renders the app icons from the brand mark. Uses the browser already installed
 * for tests rather than adding a rasteriser dependency.
 *
 *   npx tsx tools/icons.ts
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = new URL('../web/public/', import.meta.url).pathname;

// The "rising check": the same mark as the sidebar and the favicon — a check
// whose long arm carries up into a ray, with a detached dash just ahead of the
// tip. Dark ink on an amber field, matching --on-brand / --brand: it reads as
// brass/highlighter, not a generic coloured button.
const BRAND = '#cc7d2a';
const INK = '#2a1c10';

const mark = (weight: number) => `
  <path d="M3.4 10.4 5.5 12.7 11.6 4.6"
        fill="none" stroke="${INK}" stroke-width="${weight}"
        stroke-linecap="round" stroke-linejoin="round" />
  <path d="M12.9 2.9 13.9 1.6"
        fill="none" stroke="${INK}" stroke-width="${weight}"
        stroke-linecap="round" stroke-linejoin="round" />`;

interface Spec {
  file: string;
  size: number;
  /** Maskable icons fill edge to edge; the OS supplies the shape. */
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

    // Maskable fills the frame and lets the launcher crop it; the plain icon is
    // a rounded square with transparent corners and a touch more inset so the
    // mark is not clipped by a launcher that rounds it further.
    const radius = spec.maskable ? '0' : '22.5%';
    const glyph = spec.maskable ? '52%' : '58%';

    await page.setContent(`<style>
      html,body{margin:0;width:${spec.size}px;height:${spec.size}px}
      body{display:grid;place-items:center}
      .tile{
        width:100%;height:100%;
        background:${BRAND};
        border-radius:${radius};
        display:grid;place-items:center;
      }
      svg{width:${glyph};height:${glyph};display:block}
    </style><div class="tile"><svg viewBox="0 0 16 16">${mark(1.5)}</svg></div>`);

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
