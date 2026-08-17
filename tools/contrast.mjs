#!/usr/bin/env node
// Verifies WCAG contrast for every token pair the design relies on.
// Run: node tools/contrast.mjs

function oklchToSrgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  const clipped = lin.some((v) => v < -0.001 || v > 1.001);
  return { lin: lin.map((v) => Math.min(1, Math.max(0, v))), clipped };
}

function relLuminance(lin) {
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function hex(lin) {
  const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  return (
    '#' +
    lin
      .map((v) => Math.round(Math.min(1, Math.max(0, enc(v))) * 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

function ratio(a, b) {
  const la = relLuminance(oklchToSrgb(...a).lin);
  const lb = relLuminance(oklchToSrgb(...b).lin);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// --- tokens under test -------------------------------------------------
const T = {
  // light
  'l/bg': [1.0, 0.0, 0],
  'l/surface': [0.976, 0.004, 255],
  'l/surface-2': [0.955, 0.005, 255],
  'l/line': [0.905, 0.006, 255],
  'l/ink': [0.215, 0.012, 255],
  'l/ink-2': [0.44, 0.014, 255],
  'l/ink-3': [0.545, 0.014, 255],
  'l/brand': [0.66, 0.135, 62],
  'l/brand-hover': [0.615, 0.14, 62],
  'l/brand-ink': [0.485, 0.112, 58],
  'l/on-brand': [0.24, 0.03, 62],
  'l/danger': [0.53, 0.2, 25],
  'l/success': [0.53, 0.12, 152],
  'l/illo-line': [0.545, 0.014, 255],
  'l/illo-plate': [0.93, 0.006, 255],
  // dark
  'd/bg': [0.165, 0.008, 255],
  'd/surface': [0.205, 0.009, 255],
  'd/surface-2': [0.245, 0.01, 255],
  'd/line': [0.315, 0.011, 255],
  'd/ink': [0.955, 0.004, 255],
  'd/ink-2': [0.755, 0.011, 255],
  'd/ink-3': [0.655, 0.013, 255],
  'd/brand': [0.755, 0.135, 64],
  'd/brand-ink': [0.8, 0.13, 64],
  'd/on-brand': [0.2, 0.03, 62],
  'd/danger': [0.68, 0.18, 25],
  'd/success': [0.72, 0.13, 152],
  'd/illo-line': [0.655, 0.013, 255],
  'd/illo-plate': [0.285, 0.011, 255],
};

// Group accents: one L/C, sixteen hues, so they read as one family rather
// than sixteen unrelated colors. Both themes must clear 3:1 against their
// surface — these are 8px dots and 2px rails, i.e. non-text UI.
const GROUP_HUES = {
  red: 12,
  rust: 30,
  amber: 46,
  honey: 62,
  lime: 106,
  green: 150,
  jade: 172,
  teal: 195,
  cyan: 213,
  blue: 232,
  cobalt: 250,
  indigo: 268,
  purple: 286,
  violet: 305,
  magenta: 330,
  rose: 355,
};
for (const [name, h] of Object.entries(GROUP_HUES)) {
  // C is capped at the weakest hue's sRGB limit (teal, 0.102 @ L .60) so no
  // swatch silently gamut-clips and breaks the family's uniform intensity.
  T[`l/g-${name}`] = [0.6, 0.1, h];
  T[`d/g-${name}`] = [0.74, 0.125, h];
}

// [fg, bg, minimum, label]
const PAIRS = [
  ...Object.keys(GROUP_HUES).flatMap((n) => [
    [`l/g-${n}`, 'l/surface', 3.0, `group dot on sidebar`],
    [`d/g-${n}`, 'd/surface', 3.0, `group dot on sidebar`],
  ]),
  ['l/ink', 'l/bg', 4.5, 'body text on page'],
  ['l/ink', 'l/surface', 4.5, 'body text on sidebar'],
  ['l/ink-2', 'l/bg', 4.5, 'secondary text on page'],
  ['l/ink-2', 'l/surface', 4.5, 'secondary text on sidebar'],
  ['l/ink-3', 'l/bg', 4.5, 'placeholder / meta on page'],
  ['l/ink-3', 'l/surface', 4.5, 'placeholder / meta on sidebar'],
  ['l/brand-ink', 'l/bg', 4.5, 'brand text/link on page'],
  ['l/brand-ink', 'l/surface', 4.5, 'brand text on sidebar'],
  ['l/on-brand', 'l/brand', 4.5, 'label on brand button'],
  ['l/danger', 'l/bg', 4.5, 'danger text on page'],
  ['l/success', 'l/bg', 4.5, 'success text on page'],
  ['l/brand', 'l/bg', 3.0, 'brand fill vs page (non-text)'],
  ['l/line', 'l/bg', 1.2, 'hairline vs page (visible)'],
  // Empty-state marks are decorative and aria-hidden, so no text minimum
  // applies — but a single-stroke glyph still has to separate from the plate it
  // sits on, or the mark disappears into its own backing.
  ['l/illo-line', 'l/illo-plate', 3.0, 'mark stroke vs its plate'],
  ['l/illo-line', 'l/bg', 3.0, 'mark stroke vs page'],
  ['l/illo-plate', 'l/bg', 1.1, 'plate visible against page'],
  ['d/illo-line', 'd/illo-plate', 3.0, 'mark stroke vs its plate'],
  ['d/illo-line', 'd/bg', 3.0, 'mark stroke vs page'],
  ['d/illo-plate', 'd/bg', 1.1, 'plate visible against page'],
  ['d/ink', 'd/bg', 4.5, 'body text on page'],
  ['d/ink', 'd/surface', 4.5, 'body text on sidebar'],
  ['d/ink-2', 'd/bg', 4.5, 'secondary text on page'],
  ['d/ink-2', 'd/surface', 4.5, 'secondary text on sidebar'],
  ['d/ink-3', 'd/bg', 4.5, 'placeholder / meta on page'],
  ['d/ink-3', 'd/surface', 4.5, 'placeholder / meta on sidebar'],
  ['d/brand-ink', 'd/bg', 4.5, 'brand text/link on page'],
  ['d/brand-ink', 'd/surface', 4.5, 'brand text on sidebar'],
  ['d/on-brand', 'd/brand', 4.5, 'label on brand button'],
  ['d/danger', 'd/bg', 4.5, 'danger text on page'],
  ['d/success', 'd/bg', 4.5, 'success text on page'],
  ['d/line', 'd/bg', 1.2, 'hairline vs page (visible)'],
];

let failures = 0;
console.log('token                          hex       gamut');
for (const [name, v] of Object.entries(T)) {
  const { lin, clipped } = oklchToSrgb(...v);
  if (clipped) failures++;
  console.log(
    `${name.padEnd(30)} ${hex(lin)}   ${clipped ? 'OUT OF sRGB GAMUT' : 'ok'}`
  );
}

console.log('\nratio   min   pair');
for (const [fg, bg, min, label] of PAIRS) {
  const r = ratio(T[fg], T[bg]);
  const pass = r >= min;
  if (!pass) failures++;
  console.log(
    `${pass ? 'PASS' : 'FAIL'} ${r.toFixed(2).padStart(6)} ${String(min).padStart(4)}   ${fg} on ${bg} — ${label}`
  );
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
