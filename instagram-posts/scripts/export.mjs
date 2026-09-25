// Exporta os slides HTML de um post para PNG (1080×1350), com o Playwright
// que o repo já usa nos testes.
//
//   node instagram-posts/scripts/export.mjs post-01
//   node instagram-posts/scripts/export.mjs post-01 --slides 1,3
//
// Também gera output/post-NN/caption.md a partir do meta.json.
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [post, flag, list] = process.argv.slice(2);
if (!post) {
  console.error('Uso: node instagram-posts/scripts/export.mjs post-NN [--slides 1,3]');
  process.exit(1);
}
const only = flag === '--slides' ? new Set(list.split(',').map(Number)) : null;
const src = join(root, 'html', post);
const out = join(root, 'output', post);
mkdirSync(out, { recursive: true });

const slides = readdirSync(src)
  .filter((f) => /^slide-\d+\.html$/.test(f))
  .sort()
  .filter((f) => !only || only.has(Number(f.match(/\d+/)[0])));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
for (const file of slides) {
  await page.goto(pathToFileURL(join(src, file)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const png = join(out, file.replace('.html', '.png'));
  await page.screenshot({ path: png, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  console.log('✔', png.slice(root.length + 1));
}
await browser.close();

// caption.md ao lado dos PNGs: o texto para colar na hora de publicar, no
// mesmo formato do export do portfólio (legenda com as hashtags, depois só
// as hashtags).
const meta = JSON.parse(readFileSync(join(src, 'meta.json'), 'utf8'));
const tags = (meta.hashtags ?? []).map((t) => `#${t}`).join(' ');
const caption = `# ${meta.title}

> Post gerado em ${meta.date} · ${meta.type} · ${meta.format}

---

## Legenda

${meta.caption}

${tags}

---

## Hashtags

${tags}
`;
writeFileSync(join(out, 'caption.md'), caption, 'utf8');
console.log('✔', join('output', post, 'caption.md'));
