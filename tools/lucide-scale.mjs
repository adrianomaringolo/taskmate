#!/usr/bin/env node
/**
 * One-off helper: reads a lucide-static icon and prints its shapes scaled
 * uniformly from the 24-unit Lucide grid to this app's 16-unit icon grid,
 * so paths pasted into Icon.tsx come from real, tested Lucide geometry
 * instead of hand-typed arc parameters.
 *
 *   node tools/lucide-scale.mjs <icon-name> [<icon-name> ...]
 */
import { readFileSync } from 'node:fs';

const SCALE = 16 / 24;
const DIR = new URL('../node_modules/lucide-static/icons/', import.meta.url).pathname;

// One decimal place matches the file's existing hand-drawn paths; a second
// decimal would be sub-pixel noise at 16px and just makes the JSX noisier.
// Lucide draws a "dot" as a zero-length stroke with a round cap (e.g.
// `h.01`) — scaled and rounded to one decimal that would collapse to a
// literal 0, losing the dot, so a genuinely nonzero input is kept nonzero.
function num(n) {
  const r = Math.round(n * 10) / 10;
  if (r === 0 && n !== 0) return n > 0 ? '.1' : '-.1';
  return String(r).replace(/^0\./, '.').replace(/^-0\./, '-.');
}

// Splits an SVG path `d` string into [command, ...rawNumberStrings] tokens.
//
// Arc (`A`/`a`) parameters are the one place a naive number regex breaks:
// the large-arc-flag and sweep-flag are each exactly one digit (0 or 1), and
// SVG allows writing them with no separator before the next token — "00-1.999"
// is flag 0, flag 0, then the number -1.999, not the number 00 followed by
// -1.999. A regex greedy enough to tokenize ordinary numbers is *always*
// greedy enough to swallow "00" as one number here, which then shifts every
// remaining parameter in the path by one and produces silent garbage (this
// is not hypothetical — `book-open` hits it). So arcs are walked with a
// dedicated single-character read for those two slots instead of the
// generic number matcher.
function tokenizePath(d) {
  const tokens = [];
  const numRe = /-?\d*\.?\d+(?:e[+-]?\d+)?/y;
  const flagRe = /[01]/y;
  let i = 0;
  let cmd = null;
  let paramIndex = 0; // position within the current command's parameter group

  const skipSep = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++;
  };

  while (i < d.length) {
    skipSep();
    if (i >= d.length) break;
    if (/[MLHVACSQTZmlhvacsqtz]/.test(d[i])) {
      cmd = d[i];
      paramIndex = 0;
      tokens.push(cmd);
      i++;
      continue;
    }
    // Arc flags sit at parameter slots 3 and 4 of every 7-number group; every
    // other command's parameters are ordinary numbers.
    const isFlagSlot = cmd && cmd.toUpperCase() === 'A' && (paramIndex % 7 === 3 || paramIndex % 7 === 4);
    const re = isFlagSlot ? flagRe : numRe;
    re.lastIndex = i;
    const m = re.exec(d);
    if (!m) throw new Error(`Could not parse "${d}" at position ${i}`);
    tokens.push(m[0]);
    i = re.lastIndex;
    paramIndex++;
  }
  return tokens;
}

// Every param of C/S/Q/T is a coordinate (no flags to leave unscaled), so the
// generic branch in scalePath handles them once their arity is here.
const ARITY = { M: 2, L: 2, H: 1, V: 1, A: 7, C: 6, S: 4, Q: 4, T: 2, Z: 0 };

/**
 * Appends a number to `out`, adding a separating space only when omitting it
 * would merge two tokens — the same terse style the rest of the file's
 * hand-drawn paths already use. Emitted this way, not hand-tightened
 * afterward, so there is no manual retyping step where a digit could slip.
 *
 * A leading `-` is always safe to glue on with no space: a number can't
 * validly end in one, so it unambiguously starts a new token (this is what
 * lets ".3-5.2" already appear in the file's own hand-written paths). A
 * leading `.` is safe only when the previous token *already* used its
 * decimal point — gluing ".2" straight onto "1" reads back as one number,
 * "1.2", not two. Telling those apart from a string alone would mean
 * re-parsing what was just built, so the simple, always-correct rule is
 * applied instead: a leading `.` gets a space unless it follows a command
 * letter, at the cost of a few bytes it would sometimes not have needed.
 */
function append(out, str) {
  if (out === '' || /[A-Za-z]$/.test(out) || str[0] === '-') return out + str;
  return out + ' ' + str;
}

function scalePath(d) {
  const tokens = tokenizePath(d);
  let out = '';
  let i = 0;
  let cmd = null;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[MLHVACSQTZmlhvacsqtz]/.test(t)) {
      cmd = t;
      out += cmd;
      i++;
      continue;
    }
    const arity = ARITY[cmd.toUpperCase()];
    if (arity === 0) continue; // Z takes no params
    const group = tokens.slice(i, i + arity).map(Number);
    i += arity;
    if (cmd.toUpperCase() === 'A') {
      const [rx, ry, rot, laf, sf, x, y] = group;
      for (const v of [num(rx * SCALE), num(ry * SCALE), String(rot), String(laf), String(sf), num(x * SCALE), num(y * SCALE)])
        out = append(out, v);
    } else {
      for (const v of group) out = append(out, num(v * SCALE));
    }
  }
  return out;
}

function scaleAttrs(el, attrs) {
  for (const a of attrs) {
    const v = el.match(new RegExp(`${a}="(-?[\\d.]+)"`));
    if (v) el = el.replace(v[0], `${a}="${num(Number(v[1]) * SCALE)}"`);
  }
  return el;
}

function scalePolyline(points) {
  return points
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map((n) => num(Number(n) * SCALE)).join(','))
    .join(' ');
}

for (const name of process.argv.slice(2)) {
  const svg = readFileSync(`${DIR}${name}.svg`, 'utf8');
  console.log(`\n== ${name} ==`);
  const shapeRe = /<(path|circle|rect|line|polyline)\b[^>]*\/?>/g;
  let m;
  while ((m = shapeRe.exec(svg))) {
    const tag = m[1];
    let el = m[0];
    if (tag === 'path') {
      const d = el.match(/d="([^"]*)"/)[1];
      console.log(`<path d="${scalePath(d)}" />`);
    } else if (tag === 'circle') {
      console.log(scaleAttrs(el, ['cx', 'cy', 'r']));
    } else if (tag === 'rect') {
      console.log(scaleAttrs(el, ['x', 'y', 'width', 'height', 'rx', 'ry']));
    } else if (tag === 'line') {
      console.log(scaleAttrs(el, ['x1', 'y1', 'x2', 'y2']));
    } else if (tag === 'polyline') {
      const points = el.match(/points="([^"]*)"/)[1];
      console.log(`<polyline points="${scalePolyline(points)}" />`);
    }
  }
}
