#!/usr/bin/env node
/**
 * Generates the empty-state marks from Lucide.
 *
 * Lucide is the same drawing language as the app's own icon set — 24-unit grid,
 * rounded caps, single stroke — so the marks stop being foreign artwork pasted
 * into the product and become the icon system used at a larger size.
 *
 * Two adjustments matter:
 *
 *  - **Stroke is thinned from 2 to 1.5.** Lucide is drawn for 16-24px. Scaled to
 *    60px, a stroke of 2 renders ~5px thick and reads as a bold graphic rather
 *    than a quiet landmark.
 *  - **`currentColor` is preserved**, so a single CSS `color` drives the mark and
 *    both themes are handled by the token, with no per-theme variants.
 *
 * Lucide is ISC-licensed, which — unlike the public-domain vectors this replaced
 * — *requires* the copyright notice to travel with every copy. Hence the header
 * comment kept in each generated file, the vendored `assets/lucide-LICENSE.txt`,
 * and the entry in ATTRIBUTION.md.
 *
 *   npm run illustrations
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ICONS = new URL('../node_modules/lucide-static/icons/', import.meta.url).pathname;
const LICENSE = new URL('../node_modules/lucide-static/LICENSE', import.meta.url).pathname;
const OUT = new URL('../web/src/assets/illustrations/', import.meta.url).pathname;
const VENDOR = new URL('../assets/', import.meta.url).pathname;

const STROKE = 1.5;

/** Local name → Lucide icon. The local name is what the app imports. */
const MAP = {
  'inbox-empty': 'inbox',
  'list-empty': 'list-todo',
  'day-clear': 'coffee',
  'week-free': 'calendar-days',
  'not-found': 'search-x',
};

const version = JSON.parse(
  readFileSync(new URL('../node_modules/lucide-static/package.json', import.meta.url).pathname, 'utf8')
).version;

const NOTICE = `<!-- lucide-static v${version} — ISC. Copyright (c) Lucide Icons and Contributors. See assets/lucide-LICENSE.txt -->`;

function build(iconName) {
  let svg = readFileSync(join(ICONS, `${iconName}.svg`), 'utf8');

  svg = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    // Size comes from CSS so the mark scales with its box.
    .replace(/\s(width|height)="24"/g, '')
    .replace(/\sclass="[^"]*"/g, '')
    .replace(/stroke-width="2"/, `stroke-width="${STROKE}"`)
    .replace(/<svg/, '<svg aria-hidden="true" focusable="false"')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  if (!svg.includes('currentColor')) throw new Error(`${iconName}: perdeu o currentColor`);
  if (!svg.includes(`stroke-width="${STROKE}"`)) throw new Error(`${iconName}: traço não ajustado`);

  return `${NOTICE}\n${svg}\n`;
}

mkdirSync(OUT, { recursive: true });
mkdirSync(VENDOR, { recursive: true });
copyFileSync(LICENSE, join(VENDOR, 'lucide-LICENSE.txt'));

let total = 0;
for (const [local, icon] of Object.entries(MAP)) {
  const out = build(icon);
  writeFileSync(join(OUT, `${local}.svg`), out);
  total += out.length;
  console.log(`${local.padEnd(14)} ← lucide/${icon.padEnd(15)} ${String(out.length).padStart(4)} bytes`);
}
console.log(`\ntotal ${total} bytes · lucide-static v${version} (ISC)`);
console.log(`aviso de licença copiado para assets/lucide-LICENSE.txt`);
