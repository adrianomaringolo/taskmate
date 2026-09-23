/**
 * Página de produto: o app partido ao meio.
 *
 * Tudo que aparece nas colunas é marcação real calculada a partir de dados de
 * exemplo, com o mesmo parser (`parse.ts`) e as mesmas datas relativas
 * (`date.ts`) do app — nada aqui é imagem ou div pintada fingindo funcionar.
 * O scroll é o relógio: cada cena é uma função pura do progresso `--sc-p` que
 * o motor do scroll-craft publica no ato, então rolar para trás desfaz o
 * estado sem nenhum código a mais.
 */
import '../styles/tokens.css';
import './scrollcraft.css';
import './produto.css';
import './scrollcraft.js';
import {
  addDays,
  describeDue,
  describeDueFull,
  describeStamp,
  daysFromToday,
  isSameMonth,
  monthGrid,
  monthLabel,
  today,
  weekDays,
  weekdayShort,
} from '../lib/date';
import { parseCapture, stripListMarker, tokenizeCapture, type ParsedCapture } from '../lib/parse';
import { toMarkdown } from '../lib/export';
import { writePref } from '../lib/prefs';
import { PRIORITY_LABELS, RECURRENCE_LABELS, type AppState, type GroupColor } from '../lib/types';

declare global {
  interface Window {
    ScrollCraft: { mount(root: Element): unknown; reduce: boolean };
  }
}

/* --------------------------------------------------------------- icons -- */

// Same 16-unit geometry as `Icon.tsx` (Lucide, scaled by tools/lucide-scale.mjs).
const PATHS: Record<string, string> = {
  plus: '<path d="M3.3 8h9.3"/><path d="M8 3.3v9.3"/>',
  check: '<path d="M13.3 4 6 11.3l-3.3-3.3"/>',
  repeat:
    '<path d="m11.3 1.3 2.7 2.7-2.7 2.7"/><path d="M2 7.3v-.7a2.7 2.7 0 0 1 2.7-2.7h9.3"/><path d="m4.7 14.7-2.7-2.7 2.7-2.7"/><path d="M14 8.7v.7a2.7 2.7 0 0 1-2.7 2.7H2"/>',
  inbox:
    '<polyline points="14.7 8 10.7 8 9.3 10 6.7 10 5.3 8 1.3 8"/><path d="M3.6 3.4 1.3 8v4a1.3 1.3 0 0 0 1.3 1.3h10.7a1.3 1.3 0 0 0 1.3-1.3v-4l-2.3-4.6A1.3 1.3 0 0 0 11.2 2.7H4.8a1.3 1.3 0 0 0-1.2.7z"/>',
  today:
    '<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2"/><circle cx="8" cy="10" r="1.4" fill="currentColor" stroke="none"/>',
  upcoming:
    '<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2"/><path d="M5 9.5h2M9 9.5h2M5 11.5h2M9 11.5h2"/>',
  calendar:
    '<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2"/><path d="M5 9h.01M8 9h.01M11 9h.01M5 11.5h.01M8 11.5h.01M11 11.5h.01"/>',
  alert:
    '<path d="m14.5 12-5.3-9.3a1.3 1.3 0 0 0-2.3 0l-5.3 9.3A1.3 1.3 0 0 0 2.7 14h10.7a1.3 1.3 0 0 0 1.2-2"/><path d="M8 6v2.7M8 11.3h.1"/>',
  list: '<path d="M3 4.5h10M3 8h10M3 11.5h6"/>',
  undo: '<path d="M6 9.3 2.7 6l3.3-3.3"/><path d="M2.7 6h7a3.7 3.7 0 0 1 3.7 3.7a3.7 3.7 0 0 1-3.7 3.7H7.3"/>',
  trash:
    '<path d="M6.7 7.3v4M9.3 7.3v4"/><path d="M12.7 4v9.3a1.3 1.3 0 0 1-1.3 1.3H4.7a1.3 1.3 0 0 1-1.3-1.3V4"/><path d="M2 4h12"/><path d="M5.3 4V2.7a1.3 1.3 0 0 1 1.3-1.3h2.7a1.3 1.3 0 0 1 1.3 1.3v1.3"/>',
  sun: '<circle cx="8" cy="8" r="2.8"/><path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1"/>',
  moon: '<path d="M13 9.7A5.6 5.6 0 0 1 6.3 3a5.6 5.6 0 1 0 6.7 6.7Z"/>',
  // Lucide share-2, tag and search, scaled by tools/lucide-scale.mjs.
  share:
    '<circle cx="12" cy="3.3" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="12.7" r="2"/><line x1="5.7" x2="10.3" y1="9" y2="11.7"/><line x1="10.3" x2="5.7" y1="4.3" y2="7"/>',
  tag: '<path d="M8.4 1.7A1.3 1.3 0 0 0 7.4 1.3H2.7a1.3 1.3 0 0 0-1.3 1.3v4.8a1.3 1.3 0 0 0 .4 .9l5.8 5.8a1.6 1.6 0 0 0 2.3 0l4.4-4.4a1.6 1.6 0 0 0 0-2.3z"/><circle cx="5" cy="5" r=".3" fill="currentColor"/>',
  search: '<path d="m14 14-2.9-2.9"/><circle cx="7.3" cy="7.3" r="5.3"/>',
  // Lucide download, scaled by tools/lucide-scale.mjs.
  download:
    '<path d="M8 10V2"/><path d="M14 10v2.7a1.3 1.3 0 0 1-1.3 1.3H3.3a1.3 1.3 0 0 1-1.3-1.3v-2.7"/><path d="m4.7 6.7 3.3 3.3 3.3-3.3"/>',
  // Lucide monitor, laptop, tablet, smartphone, shield-check, eye-off and
  // file-lock, scaled by tools/lucide-scale.mjs.
  monitor:
    '<rect width="13.3" height="9.3" x="1.3" y="2" rx="1.3"/><line x1="5.3" x2="10.7" y1="14" y2="14"/><line x1="8" x2="8" y1="11.3" y2="14"/>',
  laptop:
    '<path d="M12 3.3a1.3 1.3 0 0 1 1.3 1.3v5.7a1.3 1.3 0 0 0 .1 .6l.7 1.4a.7 .7 0 0 1-.6 1H2.4a.7 .7 0 0 1-.6-1l.7-1.4A1.3 1.3 0 0 0 2.7 10.4V4.7a1.3 1.3 0 0 1 1.3-1.3z"/><path d="M13.4 10.7H2.6"/>',
  tablet: '<rect width="10.7" height="13.3" x="2.7" y="1.3" rx="1.3" ry="1.3"/><line x1="8" x2="8" y1="12" y2="12"/>',
  smartphone: '<rect width="9.3" height="13.3" x="3.3" y="1.3" rx="1.3" ry="1.3"/><path d="M8 12h.1"/>',
  shieldCheck:
    '<path d="M13.3 8.7c0 3.3-2.3 5-5.1 6a.7 .7 0 0 1-.4-.1C5 13.7 2.7 12 2.7 8.7V4a.7 .7 0 0 1 .7-.7c1.3 0 3-.8 4.2-1.8a.8 .8 0 0 1 1 0C9.7 2.5 11.3 3.3 12.7 3.3a.7 .7 0 0 1 .7 .7z"/><path d="m6 8 1.3 1.3 2.7-2.7"/>',
  eyeOff:
    '<path d="M7.2 3.4a7.2 7.2 0 0 1 7.5 4.4 .7 .7 0 0 1 0 .5 7.2 7.2 0 0 1-1 1.7"/><path d="M9.4 9.4a2 2 0 0 1-2.8-2.8"/><path d="M11.7 11.7a7.2 7.2 0 0 1-10.3-3.4 .7 .7 0 0 1 0-.5 7.2 7.2 0 0 1 3-3.4"/><path d="m1.3 1.3 13.3 13.3"/>',
  fileLock:
    '<path d="M2.7 6.5V2.7a1.3 1.3 0 0 1 1.3-1.3h5.3a1.6 1.6 0 0 1 1.1 .5l2.4 2.4A1.6 1.6 0 0 1 13.3 5.3v8a1.3 1.3 0 0 1-1.3 1.3h-2"/><path d="M9.3 1.3v3.3a.7 .7 0 0 0 .7 .7h3.3"/><path d="M6 11.3v-1.3a1.3 1.3 0 0 0-2.7 0v1.3"/><rect width="5.3" height="3.3" x="2" y="11.3" rx=".7"/>',
};

function icon(name: string): string {
  return `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name] ?? ''}</svg>`;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/* ---------------------------------------------------------------- data -- */

interface Group {
  name: string;
  color: string;
  lists: string[];
}

// Tarefas de exemplo. A primeira captura é a do hero; as quatro seguintes são
// "digitadas" pelo scroll. `address` é para onde cada uma vai na triagem.
const CAPTURES: { text: string; address: [number, number] | null }[] = [
  { text: 'Revisar proposta da Norte hoje !alta', address: [0, 0] },
  { text: 'Comprar ração da Nina amanhã', address: [1, 0] },
  { text: 'Pagar condomínio 10/10 mensal', address: [1, 1] },
  { text: 'Estudar capítulo 4 de Rust sex', address: [2, 0] },
  { text: 'Ligar para o contador', address: null },
];

const GROUPS: Group[] = [
  { name: 'Cliente Norte', color: 'var(--g-cobalt)', lists: ['Proposta', 'Execução', 'Financeiro'] },
  { name: 'Casa', color: 'var(--g-green)', lists: ['Compras', 'Contas', 'Reparos'] },
  { name: 'Estudos', color: 'var(--g-violet)', lists: ['Rust'] },
];

const PASTE = ['- Renovar a CNH 15/11', '- Marcar dentista seg', '- Trocar o filtro do ar mensal'];

interface DemoTask extends ParsedCapture {
  where: [number, number] | null;
  overdueDays?: number;
}

const parsedCaptures = CAPTURES.map((c) => ({ ...parseCapture(c.text), where: c.address }));

// A visão Hoje cruzando grupos: a primeira captura e três que já estavam lá.
const TODAY_TASKS: DemoTask[] = [
  parsedCaptures[0]!,
  { title: 'Responder o e-mail do jurídico', dueDate: today(), where: [0, 0] },
  { title: 'Consertar a torneira da cozinha', dueDate: today(), where: [1, 2] },
  { title: 'Enviar nota fiscal de setembro', where: [0, 2], overdueDays: 2 },
];

/* ------------------------------------------------------------- markup -- */

function tokensHTML(text: string): string {
  return tokenizeCapture(text)
    .map((t) =>
      t.kind
        ? `<mark class="qa-mark${t.kind === 'priority' ? ' qa-mark--priority' : ''}">${esc(t.text)}</mark>`
        : esc(t.text)
    )
    .join('');
}

/** The plain-language echo under the field, worded exactly like QuickAdd.tsx. */
function echo(text: string): string {
  if (!text.trim()) return '';
  const p = parseCapture(text);
  if (!(p.dueDate || p.priority || p.recurrence)) return '';
  const showDate = p.dueDate && (!p.recurrence || p.dueDate !== today());
  return [
    p.recurrence ? RECURRENCE_LABELS[p.recurrence].toLowerCase() : null,
    showDate ? describeDueFull(p.dueDate!) : null,
    p.priority ? `prioridade ${PRIORITY_LABELS[p.priority].toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function fieldHTML(text: string, caret: boolean): string {
  const hint = echo(text);
  return `
    <div class="quick-add quick-add--demo" aria-hidden="true">
      <div class="quick-add__field">
        <span class="quick-add__plus">${icon('plus')}</span>
        <div class="quick-add__text">${tokensHTML(text)}${caret ? '<span class="caret"></span>' : ''}</div>
      </div>
      <p class="quick-add__parsed">${hint || '&nbsp;'}</p>
    </div>
    <p class="sr-only">Exemplo: “${esc(text)}”${hint ? `, entendido como ${esc(hint)}` : ''}.</p>`;
}

function prioHTML(priority: number): string {
  const bars = [1, 2, 3]
    .map((i) => `<span class="prio__bar" style="height:${3 + i * 2}px;opacity:${i <= priority ? 1 : 0.28}"></span>`)
    .join('');
  return `<span class="prio prio--${priority}"><span class="prio__bars" aria-hidden="true">${bars}</span>${PRIORITY_LABELS[priority as 1 | 2 | 3]}</span>`;
}

function metaHTML(t: DemoTask, showWhere: boolean): string {
  const parts: string[] = [];
  if (t.overdueDays) {
    parts.push(`<span class="chip chip--overdue">${icon('alert')}atrasada há ${t.overdueDays} dias</span>`);
  } else if (t.dueDate) {
    const diff = daysFromToday(t.dueDate);
    const cls = diff < 0 ? ' chip--overdue' : diff === 0 ? ' chip--today' : '';
    parts.push(`<span class="chip${cls}" title="${esc(describeDueFull(t.dueDate))}">${esc(describeDue(t.dueDate))}</span>`);
  }
  if (t.recurrence) parts.push(`<span class="chip">${icon('repeat')}${RECURRENCE_LABELS[t.recurrence]}</span>`);
  if (t.priority) parts.push(prioHTML(t.priority));
  if (showWhere && t.where) {
    const g = GROUPS[t.where[0]]!;
    parts.push(`<span class="chip chip--where"><span class="dot" style="--group-color:${g.color}"></span>${esc(g.name)} › ${esc(g.lists[t.where[1]]!)}</span>`);
  }
  return parts.length ? `<span class="task__meta">${parts.join('')}</span>` : '';
}

function taskHTML(t: DemoTask, opts: { showWhere?: boolean; extra?: string } = {}): string {
  return `
    <li class="task">
      <div class="task__row">
        <span class="check" aria-hidden="true"><svg class="check__tick" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5 6.8 11 12 5.5"/></svg></span>
        <span class="task__body">
          <span class="task__title">${esc(t.title)}</span>
          ${metaHTML(t, !!opts.showWhere)}
          ${opts.extra ?? ''}
        </span>
      </div>
    </li>`;
}

function viewHead(iconName: string, label: string, count: number | null): string {
  return `<p class="view-head">${icon(iconName)}<span>${label}</span>${count === null ? '' : `<span class="view-head__count">${count}</span>`}</p>`;
}

/* -------------------------------------------------------------- scenes -- */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * The page's one clock, in act progress (0..1). Every scene's cue window and
 * every scene's internal state read from here, so adding a scene means one
 * row, not hunting numbers through the markup. Windows overlap slightly so one
 * scene is still fading while the next arrives.
 */
const SCENES = {
  // The first scene is already on screen while the hero scrolls away (about a
  // viewport of travel before the pin starts), so its own window is short:
  // that way every scene gets roughly the same time in front of the reader.
  hero: [0, 0.035],
  typing: [0.027, 0.111],
  paste: [0.103, 0.187],
  share: [0.179, 0.263],
  today: [0.255, 0.339],
  overdue: [0.331, 0.414],
  details: [0.406, 0.490],
  trash: [0.482, 0.566],
  views: [0.558, 0.642],
  prefs: [0.634, 0.718],
  updates: [0.710, 0.794],
  quiet: [0.786, 0.870],
} as const satisfies Record<string, readonly [number, number]>;
/** The divider travels to the sidebar across this range; the app holds after. */
const COLLAPSE = [0.861, 0.94] as const;

type SceneName = keyof typeof SCENES;
const inScene = (p: number, name: SceneName) => local(p, SCENES[name][0], SCENES[name][1]);

// Cue windows for the engine: `from to rampIn rampOut`, ramps as fractions of
// the window. The hero greets (already visible at p = 0); the final app layer
// holds to the end so the last screen never fades.
document.querySelectorAll<HTMLElement>('[data-scene]').forEach((el) => {
  const name = el.dataset.scene!;
  if (name === 'final') {
    el.dataset.scCue = `${COLLAPSE[0]} 1 0.3 0`;
  } else if (name in SCENES) {
    const [from, to] = SCENES[name as SceneName];
    const ramps = name === 'hero' ? '0 0.2' : name === 'quiet' ? '0.2 0.2' : '0.14 0.12';
    el.dataset.scCue = `${from} ${to} ${ramps}`;
  }
});
const local = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));
const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);

/**
 * Renders only when the scene's visible state actually changes: each scene
 * reduces its progress to a small key (how many characters typed, how many
 * rows landed), and innerHTML is touched once per key, not once per frame.
 */
function scene(el: HTMLElement | null, key: (p: number) => string, render: (p: number) => string) {
  let last = '';
  return (p: number) => {
    if (!el) return;
    const k = key(p);
    if (k === last) return;
    last = k;
    el.innerHTML = render(p);
  };
}

// Hero: the example already typed, and already in the Entrada on the right.
const heroCapture = $('[data-demo="hero-capture"]');
if (heroCapture) heroCapture.innerHTML = fieldHTML(CAPTURES[0]!.text, true);
const heroInbox = $('[data-demo="hero-inbox"]');
if (heroInbox) heroInbox.innerHTML = viewHead('inbox', 'Entrada', 1) + `<ul class="tasks">${taskHTML(parsedCaptures[0]!)}</ul>`;

// Scene 2: scroll is the keyboard. Four captures, each typed then committed.
const TYPED = CAPTURES.slice(1).map((c) => c.text);
function typingState(p: number) {
  const q = local(inScene(p, 'typing'), 0.1, 0.9) * TYPED.length;
  const i = Math.min(Math.floor(q), TYPED.length - 1);
  const t = q - i;
  const text = TYPED[i]!;
  const typing = clamp01(t / 0.62);
  const committed = i + (t >= 0.74 ? 1 : 0);
  return { text: text.slice(0, Math.round(typing * text.length)), committed, done: t >= 0.74 };
}
const typing = scene(
  $('[data-demo="typing"]'),
  (p) => {
    const s = typingState(p);
    return `${s.text}|${s.done}`;
  },
  (p) => {
    const s = typingState(p);
    return fieldHTML(s.done ? '' : s.text, true);
  }
);
const inbox = scene(
  $('[data-demo="inbox"]'),
  (p) => String(typingState(p).committed),
  (p) => {
    const n = 1 + typingState(p).committed;
    const rows = parsedCaptures.slice(0, n).map((t, i) => taskHTML(t).replace('class="task"', `class="task${i === n - 1 && n > 1 ? ' task--new' : ''}"`));
    return viewHead('inbox', 'Entrada', n) + `<ul class="tasks">${rows.join('')}</ul>`;
  }
);

// Scene 3, left: a pasted block splits into one task per line.
const pasted = PASTE.map((l) => parseCapture(stripListMarker(l)));
const paste = scene(
  $('[data-demo="paste"]'),
  (p) => {
    const q = inScene(p, 'paste');
    return String(q < 0.12 ? 0 : Math.min(1 + Math.floor((q - 0.22) / 0.1), 4));
  },
  (p) => {
    const q = inScene(p, 'paste');
    const stage = q < 0.12 ? 0 : Math.min(1 + Math.floor((q - 0.22) / 0.1), 4);
    const clip = `<pre class="clip${stage >= 1 ? ' clip--pasted' : ''}" aria-label="Texto colado">${PASTE.map(esc).join('\n')}</pre>`;
    const rows = pasted
      .slice(0, Math.max(0, stage - 1))
      .map((t) => taskHTML({ ...t, where: null }))
      .join('');
    return clip + `<ul class="tasks tasks--pasted">${rows}</ul>`;
  }
);

// Scene 3, right: the tree grows and the Entrada empties into it.
function treeState(p: number) {
  const q = inScene(p, 'paste');
  const groups = q < 0.55 ? 0 : Math.min(3, 1 + Math.floor((q - 0.55) / 0.07));
  const placed = q < 0.76 ? 0 : Math.min(4, 1 + Math.floor((q - 0.76) / 0.05));
  return { groups, placed };
}
const tree = scene(
  $('[data-demo="tree"]'),
  (p) => {
    const s = treeState(p);
    return `${s.groups}|${s.placed}`;
  },
  (p) => {
    const { groups, placed } = treeState(p);
    const counts = new Map<string, number>();
    parsedCaptures.slice(0, placed).forEach((t) => {
      if (t.where) counts.set(t.where.join(':'), (counts.get(t.where.join(':')) ?? 0) + 1);
    });
    const inboxLeft = parsedCaptures.filter((t, i) => i >= placed || !t.where);
    const groupsHTML = GROUPS.slice(0, groups)
      .map((g, gi) => {
        const lists = g.lists
          .map((l, li) => {
            const n = counts.get(`${gi}:${li}`);
            return `<li class="tree__list"><span class="row">${icon('list')}<span class="row__label">${esc(l)}</span>${n ? `<span class="row__count row__count--new">${n}</span>` : ''}</span></li>`;
          })
          .join('');
        return `<li class="tree__group"><span class="tree__head"><span class="dot" style="--group-color:${g.color}"></span>${esc(g.name)}</span><ul>${lists}</ul></li>`;
      })
      .join('');
    return (
      `<ul class="tree">${groupsHTML}</ul>` +
      viewHead('inbox', 'Entrada', inboxLeft.length) +
      `<ul class="tasks tasks--compact">${inboxLeft.slice(-2).map((t) => taskHTML(t)).join('')}</ul>`
    );
  }
);

// Scene 4, left: a note, which is not a task.
const note = $('[data-demo="note"]');
if (note) {
  note.innerHTML = `
    <article class="note">
      <h3 class="note__title">Artigo sobre CRDTs para ler</h3>
      <p class="note__body">O link que o Paulo mandou. Ver a parte sobre exclusão com tombstones.</p>
      <p class="note__tags"><span class="tag">leitura</span><span class="tag">sync</span></p>
    </article>`;
}

// Scene 4, right: today across groups. Two get done, the overdue one moves.
function todayState(p: number) {
  const q = inScene(p, 'today');
  return {
    doneA: q > 0.3,
    goneA: q > 0.44,
    doneB: q > 0.56,
    goneB: q > 0.7,
    postponed: q > 0.84,
  };
}
const todayView = scene(
  $('[data-demo="today"]'),
  (p) => JSON.stringify(todayState(p)),
  (p) => {
    const s = todayState(p);
    const rows: string[] = [];
    const [a, b, c, d] = TODAY_TASKS as [DemoTask, DemoTask, DemoTask, DemoTask];
    rows.push(taskHTML(a, { showWhere: true }));
    if (!s.goneA) rows.push(withDone(taskHTML(b, { showWhere: true }), s.doneA));
    if (!s.goneB) rows.push(withDone(taskHTML(c, { showWhere: true }), s.doneB));
    if (!s.postponed) {
      rows.push(
        taskHTML(d, {
          showWhere: true,
          extra: snoozeHTML(),
        })
      );
    }
    const left = 1 + (s.doneA ? 0 : 1) + (s.doneB ? 0 : 1) + (s.postponed ? 0 : 1);
    return viewHead('today', 'Hoje', left) + `<ul class="tasks">${rows.join('')}</ul>`;
  }
);
function withDone(html: string, done: boolean) {
  return done ? html.replace('class="task"', 'class="task" data-done="true"') : html;
}


// Scene 5, left: Cliente Norte as a board. One card is dragged from Proposta
// to Desenvolvimento with the app's own drag states (the card dims, the target
// column takes the brand edge), then lands.
const BOARD: DemoTask[][] = [
  [
    { ...parsedCaptures[0]!, where: null },
    { title: 'Ajustar o escopo da home', where: null },
    { title: 'Responder o e-mail do jurídico', dueDate: today(), where: null },
  ],
  [{ ...parseCapture('Integrar o checkout sex'), where: null }],
  [{ title: 'Enviar nota fiscal de setembro', dueDate: addDays(today(), 1), where: null }],
];
function boardState(p: number) {
  const q = inScene(p, 'views');
  return q < 0.3 ? 'rest' : q < 0.55 ? 'drag' : 'moved';
}
const board = scene(
  $('[data-demo="board"]'),
  boardState,
  (p) => {
    const state = boardState(p);
    const moving = BOARD[0]![1]!;
    const cols = BOARD.map((cards, ci) => {
      let list = cards;
      if (state === 'moved') {
        if (ci === 0) list = cards.filter((c) => c !== moving);
        if (ci === 1) list = [moving, ...cards];
      }
      const drop = state === 'drag' && ci === 1 ? ' data-drop="true"' : '';
      const rows = list
        .map((t) => {
          let html = taskHTML(t);
          if (t === moving && state === 'drag') html = html.replace('class="task"', 'class="task" data-dragging="true"');
          if (t === moving && state === 'moved') html = html.replace('class="task"', 'class="task task--new"');
          return html;
        })
        .join('');
      return `
        <section class="board-col"${drop} aria-label="${esc(GROUPS[0]!.lists[ci]!)}">
          <header class="board-col__head"><span class="board-col__name">${esc(GROUPS[0]!.lists[ci]!)}</span><span class="row__count">${list.length}</span></header>
          <ul class="tasks board-col__cards">${rows}</ul>
        </section>`;
    }).join('');
    return (
      `<p class="board-crumb"><span class="dot" style="--group-color:${GROUPS[0]!.color}"></span>${esc(GROUPS[0]!.name)} · Quadro</p>` +
      `<div class="board" style="--group-color:${GROUPS[0]!.color}">${cols}</div>`
    );
  }
);

// Scene 5, right: this month, every dated task on its day in its group's
// colour. The overdue invoice postponed in the Hoje scene lands on tomorrow.
const CAL_TASKS: DemoTask[] = [
  ...TODAY_TASKS.slice(0, 3),
  parsedCaptures[1]!,
  parsedCaptures[2]!,
  parsedCaptures[3]!,
  { ...parseCapture('Integrar o checkout sex'), where: [0, 1] },
];
const POSTPONED: DemoTask = { title: 'Enviar nota fiscal de setembro', dueDate: addDays(today(), 1), where: [0, 2] };
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const calendar = scene(
  $('[data-demo="calendar"]'),
  (p) => String(inScene(p, 'views') > 0.62),
  (p) => {
    const landed = inScene(p, 'views') > 0.62;
    const t = today();
    const tasks = landed ? [...CAL_TASKS, POSTPONED] : CAL_TASKS;
    const byDay = new Map<string, DemoTask[]>();
    tasks.forEach((task) => {
      if (!task.dueDate) return;
      byDay.set(task.dueDate, [...(byDay.get(task.dueDate) ?? []), task]);
    });
    const days = monthGrid(t);
    const todayRow = Math.floor(days.indexOf(t) / 7);
    const head = weekDays(t).map((d) => `<span>${capitalize(weekdayShort(d))}</span>`).join('');
    const cells = days
      .map((day, i) => {
        const list = byDay.get(day) ?? [];
        const visible = list.slice(0, 2);
        const more = list.length - visible.length;
        const row = Math.floor(i / 7);
        const chips = visible
          .map((task) => {
            const fresh = landed && task === POSTPONED ? ' cal-chip--new' : '';
            const color = task.where ? GROUPS[task.where[0]]!.color : 'var(--g-honey)';
            return `<span class="cal-chip${fresh}"><span class="cal-chip__dot" style="background:${color}"></span><span class="cal-chip__text">${esc(task.title)}</span></span>`;
          })
          .join('');
        return `<span class="cal-cell"${isSameMonth(day, t) ? '' : ' data-muted'}${day === t ? ' data-today' : ''}${row === todayRow || row === todayRow + 1 ? ' data-near' : ''}><span class="cal-cell__num">${Number(day.slice(-2))}</span>${
          list.length ? `<span class="cal-cell__chips">${chips}${more > 0 ? `<span class="cal-chip cal-chip--more">+${more}</span>` : ''}</span>` : ''
        }</span>`;
      })
      .join('');
    return `
      <div class="cal-toolbar" aria-hidden="true">
        <span class="cal-month-label">${esc(capitalize(monthLabel(t)))}</span>
        <span class="seg"><span class="seg__btn" aria-pressed="true">Mês</span><span class="seg__btn">Semana</span><span class="seg__btn">Dia</span></span>
      </div>
      <div class="cal-month" aria-hidden="true">
        <div class="cal-month__weekdays">${head}</div>
        <div class="cal-month__grid">${cells}</div>
      </div>
      <p class="sr-only">Calendário de ${esc(monthLabel(t))} com ${tasks.length} tarefas de exemplo nos seus dias.</p>`;
  }
);



// The app's own quick-schedule shortcuts (TaskRow.tsx): an overdue task gets
// "Adiar", an undated one gets "Dar prazo". Same labels, same order.
const SNOOZE = ['Amanhã', '3 dias', '1 semana', '1 mês'] as const;
const GIVE_DUE = ['Hoje', 'Amanhã', 'Em 1 semana'] as const;
function snoozeHTML(picked?: string, label = 'Adiar:', options: readonly string[] = SNOOZE) {
  return `<span class="snooze"><span class="snooze__label">${label}</span>${options
    .map((o) => `<span class="snooze__btn${o === picked ? ' is-picked' : ''}">${o}</span>`)
    .join('')}</span>`;
}

// Overdue scene, left: three late tasks, each postponed in turn with a
// different shortcut, until the list says so in one sentence.
const OVERDUE: { task: DemoTask; pick: (typeof SNOOZE)[number] }[] = [
  { task: { title: 'Enviar nota fiscal de setembro', where: [0, 2], overdueDays: 2 }, pick: 'Amanhã' },
  { task: { title: 'Agendar revisão do carro', where: [1, 2], overdueDays: 5 }, pick: '1 semana' },
  { task: { title: 'Ler capítulo 3 de Rust', where: [2, 0], overdueDays: 1 }, pick: '3 dias' },
];
function overdueState(p: number) {
  const q = inScene(p, 'overdue');
  // Per row: picked at its first mark, gone at its second.
  const marks = [0.1, 0.17, 0.24, 0.31, 0.38, 0.46];
  return OVERDUE.map((_, i) => (q >= marks[i * 2 + 1]! ? 'gone' : q >= marks[i * 2]! ? 'picked' : 'late'));
}
const overdue = scene(
  $('[data-demo="overdue"]'),
  (p) => overdueState(p).join(),
  (p) => {
    const states = overdueState(p);
    const rows = OVERDUE.map(({ task, pick }, i) => {
      if (states[i] === 'gone') return '';
      return taskHTML(task, { showWhere: true, extra: snoozeHTML(states[i] === 'picked' ? pick : undefined) });
    }).join('');
    const left = states.filter((st) => st !== 'gone').length;
    const done = OVERDUE.filter((_, i) => states[i] === 'gone')
      .map(({ task, pick }) => `<li>${esc(task.title)} <span>→ ${pick.toLowerCase()}</span></li>`)
      .join('');
    return (
      `<p class="view-head view-head--late">${icon('alert')}<span>Atrasadas</span><span class="view-head__count">${left}</span></p>` +
      (left ? `<ul class="tasks">${rows}</ul>` : `<p class="empty-line">Nada atrasado.</p>`) +
      (done ? `<ul class="moved">${done}</ul>` : '')
    );
  }
);

// Overdue scene, right: A revisar, the undated tasks of every list. Two get a
// date with "Dar prazo" and leave the view; one stays, because it can.
const REVIEW: { task: DemoTask; list: string; pick?: (typeof GIVE_DUE)[number] }[] = [
  { task: { title: 'Ligar para o contador', where: null }, list: 'Entrada', pick: 'Amanhã' },
  { task: { title: 'Ajustar o escopo da home', where: null }, list: 'Cliente Norte › Execução', pick: 'Em 1 semana' },
  { task: { title: 'Trocar a lâmpada da varanda', where: null }, list: 'Casa › Reparos' },
];
function reviewState(p: number) {
  const q = inScene(p, 'overdue');
  const marks = [0.56, 0.66, 0.74, 0.84];
  return REVIEW.map((r, i) => (!r.pick ? 'open' : q >= marks[i * 2 + 1]! ? 'gone' : q >= marks[i * 2]! ? 'picked' : 'open'));
}
const review = scene(
  $('[data-demo="review"]'),
  (p) => reviewState(p).join(),
  (p) => {
    const states = reviewState(p);
    const rows = REVIEW.map(({ task, list, pick }, i) => {
      if (states[i] === 'gone') return '';
      return `<li class="review-row"><span class="review-row__list">${esc(list)}</span>${taskHTML(task, {
        extra: snoozeHTML(states[i] === 'picked' ? pick : undefined, 'Dar prazo:', GIVE_DUE),
      }).replace(/^\s*<li class="task">|<\/li>\s*$/g, '')}</li>`;
    }).join('');
    const left = states.filter((st) => st !== 'gone').length;
    return `${viewHead('list', 'A revisar', left)}<ul class="tasks">${rows}</ul>`;
  }
);


// Share scene, left: a post seen in another app, its Compartilhar button, then
// the app's own intake dialog (same title, question and buttons as
// ShareIntake.tsx), where Nota is chosen.
const SHARED_TEXT = '10 alongamentos para quem trabalha sentado';
const SHARED_URL = 'instagram.com/p/C8x2…';
function shareState(p: number) {
  const q = inScene(p, 'share');
  return q < 0.28 ? 'source' : q < 0.56 ? 'dialog' : 'saved';
}
const share = scene($('[data-demo="share"]'), shareState, (p) => {
  const state = shareState(p);
  if (state === 'source') {
    return `
      <div class="share-src" aria-hidden="true">
        <p class="share-src__app">Instagram</p>
        <p class="share-src__title">${esc(SHARED_TEXT)}</p>
        <p class="share-src__url">${esc(SHARED_URL)}</p>
        <span class="share-src__btn">${icon('share')}Compartilhar</span>
      </div>
      <p class="sr-only">Exemplo: um post do Instagram prestes a ser compartilhado com o Taskmate.</p>`;
  }
  const picked = state === 'saved';
  return `
    <div class="share-dialog" aria-hidden="true">
      <p class="share-dialog__title">Compartilhado com o Taskmate</p>
      <p class="share-dialog__body">Guardar como tarefa ou como nota?</p>
      <p class="share-dialog__text">${esc(SHARED_TEXT)} ${esc(SHARED_URL)}</p>
      <span class="share-dialog__actions">
        <span class="share-dialog__btn">Tarefa</span>
        <span class="share-dialog__btn${picked ? ' is-picked' : ''}">Nota</span>
      </span>
    </div>
    <p class="sr-only">O Taskmate pergunta se o link vira tarefa ou nota; a escolha é Nota.</p>`;
});

// Share scene, right: Notas. The shared post lands as a note, with the app's
// own confirmation toast.
const shared = scene(
  $('[data-demo="shared"]'),
  (p) => String(shareState(p) === 'saved'),
  (p) => {
    const saved = shareState(p) === 'saved';
    const noteRow = (title: string, body: string, tagsList: string[], fresh = false) => `
      <article class="note note--row${fresh ? ' task--new' : ''}">
        <h3 class="note__title">${esc(title)}</h3>
        <p class="note__body">${esc(body)}</p>
        ${tagsList.length ? `<p class="note__tags">${tagsList.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</p>` : ''}
      </article>`;
    return (
      viewHead('list', 'Notas', saved ? 2 : 1) +
      `<div class="notes-demo">${saved ? noteRow(SHARED_TEXT, SHARED_URL, [], true) : ''}${noteRow('Artigo sobre CRDTs para ler', 'O link que o Paulo mandou.', ['leitura', 'sync'])}</div>` +
      (saved ? `<div class="toast"><span class="toast__text">Nota criada.</span></div>` : '')
    );
  }
);

// Details scene, left: one task opened, the way the list shows it inline, with
// its checklist being worked through; the row's progress count follows.
const STEPS = ['Reservar o hotel', 'Comprar as passagens', 'Separar os documentos', 'Fazer a mala'];
function stepsDone(p: number) {
  const q = inScene(p, 'details');
  return q < 0.2 ? 0 : q < 0.32 ? 1 : q < 0.44 ? 2 : 3;
}
const tick = `<svg class="check__tick" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5 6.8 11 12 5.5"/></svg>`;
const detail = scene(
  $('[data-demo="detail"]'),
  (p) => String(stepsDone(p)),
  (p) => {
    const done = stepsDone(p);
    const due = parseCapture('x sex').dueDate!;
    const steps = STEPS.map(
      (st, i) =>
        `<li class="step${i < done ? ' is-done' : ''}"><span class="check"${i < done ? ' aria-checked="true"' : ''}>${tick}</span><span class="step__text">${esc(st)}</span></li>`
    ).join('');
    return `
      <div class="detail-demo" aria-hidden="true">
        <div class="task__row">
          <span class="check">${tick}</span>
          <span class="task__body">
            <span class="task__title">Preparar a viagem para Floripa</span>
            <span class="task__meta">
              <span class="chip">${esc(describeDue(due))}</span>
              ${prioHTML(2)}
              <span class="chip chip--steps">${icon('list')}${done}/${STEPS.length}</span>
              <span class="chip">${icon('tag')}viagem</span>
            </span>
          </span>
        </div>
        <div class="detail-demo__panel">
          <p class="detail-demo__label">Notas</p>
          <p class="detail-demo__notes">Reservas e documentos até sexta. Voo de manhã.</p>
          <p class="detail-demo__label">Checklist</p>
          <ul class="steps">${steps}</ul>
        </div>
      </div>
      <p class="sr-only">Exemplo: tarefa com checklist de ${STEPS.length} itens, ${done} concluídos.</p>`;
  }
);

// Details scene, right: search by a tag; tasks and notes come back together,
// in the app's search layout (quoted query, count, tasks, then notes).
const TAG_QUERY = 'viagem';
function tagChars(p: number) {
  return Math.round(clamp01(local(inScene(p, 'details'), 0.6, 0.85)) * TAG_QUERY.length);
}
const tags = scene(
  $('[data-demo="tags"]'),
  (p) => String(tagChars(p)),
  (p) => {
    const n = tagChars(p);
    const typed = TAG_QUERY.slice(0, n);
    const full = n === TAG_QUERY.length;
    const taskRow = (title: string, due: number | null) =>
      `<li class="task task--new"><div class="task__row"><span class="check"></span><span class="task__body"><span class="task__title">${esc(title)}</span><span class="task__meta">${
        due === null ? '' : `<span class="chip">${esc(describeDue(addDays(today(), due)))}</span>`
      }<span class="chip">${icon('tag')}viagem</span></span></span></div></li>`;
    const results = full
      ? `<p class="search-demo__count">3 resultados</p>
         <ul class="tasks">${taskRow('Preparar a viagem para Floripa', 2)}${taskRow('Renovar o passaporte', 30)}</ul>
         <article class="note note--row task--new"><h3 class="note__title">Roteiro de Floripa</h3><p class="note__body">Praias do norte, trilha da Lagoinha.</p><p class="note__tags"><span class="tag">viagem</span></p></article>`
      : `<p class="search-demo__count">&nbsp;</p>`;
    return `
      <div class="search-demo" aria-hidden="true">
        <p class="search-demo__field">${icon('search')}<span>${esc(typed) || '<span class="search-demo__ph">Buscar</span>'}</span>${n && !full ? '<span class="caret"></span>' : ''}</p>
        ${results}
      </div>
      <p class="sr-only">Exemplo: buscar a etiqueta viagem traz duas tarefas e uma nota.</p>`;
  }
);

// Trash scene, left: a task is deleted, the app's own toast offers Desfazer,
// then Desfazer is taken and the row comes back.
const UNDO_ROWS: DemoTask[] = [
  { ...parsedCaptures[1]!, where: [1, 0] },
  { ...parsedCaptures[2]!, where: [1, 1] },
  { title: 'Consertar a torneira da cozinha', dueDate: today(), where: [1, 2] },
];
function undoState(p: number) {
  const q = inScene(p, 'trash');
  return q < 0.3 ? 'rest' : q < 0.64 ? 'deleted' : 'undone';
}
const truncate = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);
const undo = scene($('[data-demo="undo"]'), undoState, (p) => {
  const state = undoState(p);
  const victim = UNDO_ROWS[0]!;
  const rows = UNDO_ROWS.filter((t) => state !== 'deleted' || t !== victim)
    .map((t) => {
      const html = taskHTML(t, { showWhere: true });
      return t === victim && state === 'undone' ? html.replace('class="task"', 'class="task task--new"') : html;
    })
    .join('');
  const toast =
    state === 'deleted'
      ? `<div class="toast"><span class="toast__text">"${esc(truncate(victim.title))}" foi excluída.</span><span class="toast__action">${icon('undo')}Desfazer</span></div>`
      : '';
  return `${viewHead('list', 'Casa', null)}<ul class="tasks">${rows}</ul>${toast}`;
});

// Trash scene, right: the Lixeira. The deleted task lands here, then leaves
// again when it is undone.
const HOUR = 3_600_000;
const TRASH_ITEMS = [
  { title: 'Ideias para o fim de semana', subtitle: 'Nota', at: Date.now() - 26 * HOUR },
  { title: 'Revisar o contrato antigo', subtitle: 'Financeiro', at: Date.now() - 3 * 24 * HOUR },
];
const trashView = scene($('[data-demo="trash"]'), undoState, (p) => {
  const state = undoState(p);
  const items = state === 'deleted' ? [{ title: UNDO_ROWS[0]!.title, subtitle: 'Compras', at: Date.now(), fresh: true }, ...TRASH_ITEMS] : TRASH_ITEMS;
  const rows = items
    .map(
      (it) => `
      <li class="trash__row${'fresh' in it ? ' task--new' : ''}">
        <span class="trash__body"><span class="trash__title">${esc(it.title)}</span><span class="trash__meta">${esc(it.subtitle)} · excluída em ${esc(describeStamp(new Date(it.at).toISOString()))}</span></span>
        <span class="trash__restore">${icon('undo')}Restaurar</span>
      </li>`
    )
    .join('');
  return `${viewHead('trash', 'Lixeira', items.length)}<ul class="trash">${rows}</ul>`;
});

// Prefs scene, left: a miniature of Preferências. Scroll moves the theme from
// Claro to Escuro, then turns Texto ampliado on; the sample row under it
// changes with it, scoped to the panel (the page itself keeps your theme).
function prefsState(p: number) {
  const q = inScene(p, 'prefs');
  return { dark: q >= 0.32, vision: q >= 0.62 };
}
const prefs = scene(
  $('[data-demo="prefs"]'),
  (p) => JSON.stringify(prefsState(p)),
  (p) => {
    const { dark, vision } = prefsState(p);
    const seg = (
      [
        ['monitor', 'Sistema', false],
        ['sun', 'Claro', !dark],
        ['moon', 'Escuro', dark],
      ] as const
    )
      .map(([ic, label, on]) => `<span class="seg__btn"${on ? ' aria-pressed="true"' : ''}>${icon(ic)}${label}</span>`)
      .join('');
    return `
      <div class="prefs-mini${dark ? ' pp-dark' : ''}${vision ? ' pp-vision' : ''}" aria-hidden="true">
        <p class="prefs-mini__label">Tema</p>
        <span class="seg">${seg}</span>
        <p class="prefs-mini__label">Texto ampliado</p>
        <span class="prefs-mini__toggle"><span class="check"${vision ? ' aria-checked="true"' : ''}><svg class="check__tick" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5 6.8 11 12 5.5"/></svg></span>Aumenta o texto, os alvos de toque e o contorno de foco em todo o app.</span>
        <ul class="tasks">${taskHTML(TODAY_TASKS[0]!, { showWhere: true })}</ul>
      </div>
      <p class="sr-only">Exemplo das preferências: tema ${dark ? 'escuro' : 'claro'}, texto ampliado ${vision ? 'ligado' : 'desligado'}.</p>`;
  }
);

// Prefs scene, right: the Markdown the app's own exporter (export.ts) writes
// for this page's sample data, revealed line by line, and downloadable.
const STAMP = new Date().toISOString();
const base = { order: 'a0', createdAt: STAMP, updatedAt: STAMP, deletedAt: null };
const COLOR_KEYS: GroupColor[] = ['cobalt', 'green', 'violet'];
const SAMPLE: AppState = {
  groups: GROUPS.map((g, gi) => ({ ...base, id: `g${gi}`, name: g.name, color: COLOR_KEYS[gi]! })),
  lists: [
    { ...base, id: 'inbox', groupId: null, name: 'Entrada', isInbox: true },
    ...GROUPS.flatMap((g, gi) => g.lists.map((l, li) => ({ ...base, id: `l${gi}-${li}`, groupId: `g${gi}`, name: l, isInbox: false }))),
  ],
  tasks: [...parsedCaptures, ...TODAY_TASKS.slice(1), { ...parseCapture('Integrar o checkout sex'), where: [0, 1] as [number, number] }].map((t, i) => ({
    ...base,
    id: `t${i}`,
    listId: t.where ? `l${t.where[0]}-${t.where[1]}` : 'inbox',
    title: t.title,
    notes: '',
    done: false,
    doneAt: null,
    dueDate: t.dueDate ?? null,
    startDate: null,
    priority: t.priority ?? 0,
    recurrence: t.recurrence ? { unit: t.recurrence } : null,
    tags: [],
    steps: [],
  })),
  notes: [
    { ...base, id: 'n0', title: 'Artigo sobre CRDTs para ler', body: '<p>O link que o Paulo mandou.</p>', tags: ['leitura', 'sync'] },
  ],
};
const MD = toMarkdown(SAMPLE);
// The preview drops blank lines to fit; the download keeps the file as written.
const MD_LINES = MD.trimEnd().split('\n').filter((line) => line.trim() !== '');
const mdCount = (p: number) => Math.min(MD_LINES.length, Math.ceil(local(inScene(p, 'prefs'), 0.62, 0.95) * MD_LINES.length));
const mdHost = $('[data-demo="markdown"]');
if (mdHost) {
  mdHost.innerHTML = `
    <pre class="md" aria-label="Exemplo de exportação em Markdown"><code></code></pre>
    <button type="button" class="md__download" data-md-download>${icon('download')}Baixar o exemplo (.md)</button>`;
  mdHost.querySelector('[data-md-download]')?.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([MD], { type: 'text/markdown;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'taskmate-exemplo.md' });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
const markdown = scene(
  mdHost?.querySelector<HTMLElement>('code') ?? null,
  (p) => String(mdCount(p)),
  (p) => MD_LINES.slice(0, mdCount(p)).map(esc).join('\n') || ' '
);


// Updates scene, left: the app's own update toast arrives over a list, with
// the label the app really uses (Recarregar), and stays until clicked.
function updateState(p: number) {
  const q = inScene(p, 'updates');
  return q < 0.25 ? 'idle' : q < 0.7 ? 'toast' : 'reloaded';
}
const updateToast = scene($('[data-demo="update-toast"]'), updateState, (p) => {
  const state = updateState(p);
  const rows = TODAY_TASKS.slice(0, 2)
    .map((t) => taskHTML(t, { showWhere: true }))
    .join('');
  const toast =
    state === 'toast'
      ? `<div class="toast"><span class="toast__text">Uma versão nova do Taskmate está pronta.</span><span class="toast__action">Recarregar</span></div>`
      : state === 'reloaded'
        ? `<p class="update-note">Recarregado. Tudo continua onde estava.</p>`
        : '';
  return `${viewHead('today', 'Hoje', 2)}<ul class="tasks">${rows}</ul>${toast}`;
});

// Updates scene, right: a miniature of Sobre with this build's real version
// and build date (the same `define` values the app's About panel reads).
const aboutHost = $('[data-demo="about"]');
if (aboutHost) {
  const built = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(__BUILD_DATE__));
  aboutHost.innerHTML = `
    <div class="about-mini">
      <p class="about-mini__title">Sobre o Taskmate</p>
      <dl class="about-mini__list">
        <div><dt>Versão</dt><dd>${esc(__APP_VERSION__)}</dd></div>
        <div><dt>Compilado em</dt><dd>${esc(built)}</dd></div>
      </dl>
    </div>`;
}

// Final sidebar tree: the whole structure, the same one scene 3 grew.
const sideTree = $('[data-demo="side-tree"]');
if (sideTree) {
  sideTree.innerHTML = GROUPS.map(
    (g) =>
      `<div class="side-group"><span class="side-group__head"><span class="dot" style="--group-color:${g.color}"></span>${esc(g.name)}</span>${g.lists
        .map((l) => `<span class="row row--list"><span class="row__label">${esc(l)}</span></span>`)
        .join('')}</div>`
  ).join('');
}
document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
  el.innerHTML = icon(el.dataset.icon!);
});

/* ------------------------------------------------------------ the close -- */

// The one real input on the page: the same parser as the app, and whatever the
// visitor writes rides along to the app's Entrada through `?capturar=`.
const form = $<HTMLFormElement>('[data-capture-form]');
const input = $<HTMLInputElement>('#capture');
const mirror = $('.quick-add__mirror', form ?? document);
const parsedOut = $('.quick-add__parsed', form ?? document);
const finalList = $<HTMLUListElement>('[data-demo="final-list"]');
const openApp = $<HTMLAnchorElement>('[data-open-app]');
const closeNote = $('[data-close-note]');
const todayLabel = $('[data-today-label]');
if (todayLabel) todayLabel.textContent = describeDueFull(today());

const visitor: { raw: string; task: DemoTask; done: boolean }[] = [];

function renderFinal() {
  if (!finalList) return;
  const rows = visitor
    .map((v, i) => finalRow(v.task, v.done, i))
    .concat(finalRow(TODAY_TASKS[0]!, false, -1));
  finalList.innerHTML = rows.join('');
  const counts = document.querySelectorAll<HTMLElement>('[data-count]');
  counts.forEach((c) => {
    c.textContent = c.dataset.count === 'today' ? String(1 + visitor.filter((v) => !v.done).length) : '1';
  });
  if (openApp) {
    const qs = visitor.map((v) => `capturar=${encodeURIComponent(v.raw)}`).join('&');
    openApp.href = qs ? `/?${qs}` : '/';
  }
  if (closeNote) {
    closeNote.textContent = visitor.length
      ? visitor.length === 1
        ? 'Sua tarefa vai junto para a Entrada do app.'
        : `Suas ${visitor.length} tarefas vão junto para a Entrada do app.`
      : 'No navegador, sem conta. Instala como app e funciona sem internet.';
  }
}

function finalRow(t: DemoTask, done: boolean, index: number): string {
  const check =
    index >= 0
      ? `<button type="button" class="check" role="checkbox" aria-checked="${done}" aria-label="Concluir ${esc(t.title)}" data-toggle="${index}"><svg class="check__tick" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5 6.8 11 12 5.5"/></svg></button>`
      : `<span class="check" aria-hidden="true"></span>`;
  return `
    <li class="task${index >= 0 ? ' task--new' : ''}"${done ? ' data-done="true"' : ''}>
      <div class="task__row">${check}<span class="task__body"><span class="task__title">${esc(t.title)}</span>${metaHTML(t, t.where !== null)}</span></div>
    </li>`;
}

function syncField() {
  if (!input || !mirror || !parsedOut) return;
  const value = input.value;
  const marked = tokenizeCapture(value).some((t) => t.kind);
  mirror.innerHTML = marked ? `<span class="quick-add__mirror-text">${tokensHTML(value)}</span>` : '';
  mirror.scrollLeft = input.scrollLeft;
  parsedOut.textContent = echo(value);
}

input?.addEventListener('input', syncField);
input?.addEventListener('scroll', () => {
  if (mirror && input) mirror.scrollLeft = input.scrollLeft;
});
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!input) return;
  const raw = input.value.trim();
  if (!raw) return;
  input.value = '';
  syncField();
  visitor.unshift({ raw, task: { ...parseCapture(raw), where: null }, done: false });
  visitor.splice(10);
  renderFinal();
});
finalList?.addEventListener('click', (e) => {
  const btn = (e.target as Element).closest<HTMLElement>('[data-toggle]');
  if (!btn) return;
  const v = visitor[Number(btn.dataset.toggle)];
  if (!v) return;
  v.done = !v.done;
  renderFinal();
  finalList.querySelector<HTMLElement>(`[data-toggle="${btn.dataset.toggle}"]`)?.focus();
});
renderFinal();

/* ------------------------------------------------------ the split frame -- */

const act = $('.split');
const stage = $('.split__stage');
const divider = $('.divider');
const groundLeft = $('.ground--left');
const appMain = $('.app-main');
const appSide = $('.app-side');
const narrow = matchMedia('(max-width: 860px)');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const labelWords = document.querySelectorAll<HTMLElement>('.divider__word');
const SIDEBAR_W = 264;
const HEADER_H = 56;

let lastP = -1;
let lastW = 0;
let lastH = 0;

function frame() {
  requestAnimationFrame(frame);
  if (!act || !stage) return;
  const p = parseFloat(act.style.getPropertyValue('--sc-p')) || 0;
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  if (p === lastP && W === lastW && H === lastH) return;
  lastP = p;
  lastW = W;
  lastH = H;

  typing(p);
  inbox(p);
  paste(p);
  tree(p);
  todayView(p);
  overdue(p);
  review(p);
  share(p);
  shared(p);
  detail(p);
  tags(p);
  board(p);
  calendar(p);
  undo(p);
  trashView(p);
  prefs(p);
  markdown(p);
  updateToast(p);

  // The collapse: the divider travels to where the app's sidebar ends, and the
  // left ground travels with it, so the capture half literally becomes the
  // sidebar. Everything here is transform and opacity.
  const t = smooth(local(p, COLLAPSE[0], COLLAPSE[1]));
  const argument = local(p, 0, COLLAPSE[0]);
  // Scenes that are not about capture and triage relabel the divider.
  let relabel = 0;
  labelWords.forEach((word) => {
    const name = word.dataset.label as SceneName | '';
    if (!name) return;
    const q = inScene(p, name);
    const w = smooth(clamp01(Math.min(q / 0.12, (1 - q) / 0.12)));
    relabel = Math.max(relabel, w);
    word.style.opacity = w.toFixed(3);
  });
  labelWords.forEach((word) => {
    if (!word.dataset.label) word.style.opacity = (1 - relabel).toFixed(3);
  });
  stage.style.setProperty('--collapse', t.toFixed(4));
  stage.style.setProperty('--argument', argument.toFixed(4));

  if (narrow.matches) {
    const y = lerp(H / 2, HEADER_H, t);
    divider?.style.setProperty('transform', `translate3d(0, ${y}px, 0)`);
    groundLeft?.style.setProperty('transform', `scaleY(${(y / H).toFixed(5)})`);
    appMain?.style.setProperty('transform', `translate3d(0, ${((1 - t) * (H / 2 - HEADER_H)).toFixed(1)}px, 0)`);
  } else {
    const x = lerp(W / 2, SIDEBAR_W, t);
    divider?.style.setProperty('transform', `translate3d(${x}px, 0, 0)`);
    groundLeft?.style.setProperty('transform', `scaleX(${(x / W).toFixed(5)})`);
    const offset = W * 0.25 - SIDEBAR_W / 2;
    appMain?.style.setProperty('transform', `translate3d(${((1 - t) * offset).toFixed(1)}px, 0, 0)`);
  }

  // The app layers sit on top of the panes the whole time; they only take
  // pointer input once they are actually there.
  const live = t > 0.5;
  appMain?.classList.toggle('is-live', live);
  appSide?.classList.toggle('is-live', live);
}

// Hero clip: plays only while on screen, and never under reduced motion,
// where the poster frame is the whole picture.
const heroVideo = $<HTMLVideoElement>('[data-hero-video]');
if (heroVideo) {
  // The clip is already slowed to 0.6x in the file itself, with motion-
  // interpolated frames (30 fps real), so it plays at 1x. Slowing it in the
  // browser instead left 25 fps footage at ~15 effective frames, visibly
  // stepped.
  const play = () => {
    if (reduce.matches) return;
    void heroVideo.play().catch(() => {
      /* autoplay refused: the poster stays, which is fine */
    });
  };
  new IntersectionObserver(([entry]) => (entry?.isIntersecting ? play() : heroVideo.pause()), {
    threshold: 0.1,
  }).observe(heroVideo);
  reduce.addEventListener('change', () => (reduce.matches ? heroVideo.pause() : play()));
}

// Hero on scroll: the clip lags the page at a third of its speed while the
// copy rides at 1x (depth from differential movement, never on the text). The
// gap the lag opens is always above the viewport, and the hero's overflow
// clips the bottom, so no scale-up is needed. The scroll link has done its
// job once the visitor starts scrolling: it fades over the first third of the
// hero and stops taking focus or clicks.
const HERO_PARALLAX = 0.35;
const heroMore = $('[data-hero-more]');
const heroEl = $('.hero');
let heroTicking = false;
function heroScroll() {
  heroTicking = false;
  const y = scrollY;
  if (heroMore) {
    const o = clamp01(1 - y / (innerHeight * 0.35));
    heroMore.style.setProperty('--more-o', o.toFixed(3));
    heroMore.style.visibility = o === 0 ? 'hidden' : '';
  }
  if (heroVideo && heroEl) {
    const inView = y < heroEl.offsetHeight;
    heroVideo.style.transform =
      inView && !reduce.matches ? `translate3d(0, ${(y * HERO_PARALLAX).toFixed(1)}px, 0)` : '';
  }
}
addEventListener(
  'scroll',
  () => {
    if (heroTicking) return;
    heroTicking = true;
    requestAnimationFrame(heroScroll);
  },
  { passive: true }
);
heroScroll();

/* ---------------------------------------------------------- auto-scroll -- */

// "Rolar sozinho": the page scrolls itself at a reading pace. The speed is in
// viewport-heights per second so every screen size gets the same rhythm: at
// 0.15 each scene stays on screen about fourteen seconds, enough to read the
// headline and the line under it and to watch its demo play out. Time-based,
// not frame-based, so a slow device reads at the same pace. It stops at the
// end of the page, on the toggle, on Escape, and the moment the visitor
// scrolls by themselves: two hands on one scrollbar is a fight.
const AUTO_SPEED_VH = 0.15;
const autoStart = $<HTMLButtonElement>('[data-autoscroll-start]');
const autoToggle = $<HTMLButtonElement>('[data-autoscroll-toggle]');
const autoLabel = $('[data-autoscroll-label]');
let autoOn = false;
let autoY = 0;
let autoLast = 0;
let autoFrame = 0;

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Escape']);
const onUserScroll = () => stopAuto();
const onKey = (e: KeyboardEvent) => {
  if (!SCROLL_KEYS.has(e.key)) return;
  // Space on the toggle is the button doing its job.
  if (e.target === autoToggle && e.key === ' ') return;
  stopAuto();
};

function renderToggle() {
  if (!autoToggle) return;
  autoToggle.setAttribute('aria-pressed', String(autoOn));
  autoToggle.classList.toggle('is-on', autoOn);
  if (autoLabel) autoLabel.textContent = autoOn ? 'Parar a rolagem' : 'Rolar sozinho';
  document.documentElement.classList.toggle('pp-autoscroll', autoOn);
  syncToggleVisibility();
}

// At rest the fixed toggle waits until the hero's own button has faded, so the
// first screen never shows two of them; while running it is always there.
function syncToggleVisibility() {
  autoToggle?.classList.toggle('is-visible', autoOn || scrollY > innerHeight * 0.35);
}
addEventListener('scroll', syncToggleVisibility, { passive: true });

function autoStep(now: number) {
  if (!autoOn) return;
  const dt = Math.min(0.05, (now - autoLast) / 1000);
  autoLast = now;
  const max = document.documentElement.scrollHeight - innerHeight;
  autoY = Math.min(max, autoY + innerHeight * AUTO_SPEED_VH * dt);
  scrollTo({ top: autoY, behavior: 'instant' });
  if (autoY >= max) {
    stopAuto();
    return;
  }
  autoFrame = requestAnimationFrame(autoStep);
}

function startAuto() {
  if (autoOn) return;
  const max = document.documentElement.scrollHeight - innerHeight;
  // Started from the very end, it would stop on the same frame: start over.
  if (scrollY >= max - 4) scrollTo({ top: 0, behavior: 'instant' });
  autoOn = true;
  autoY = scrollY;
  autoLast = performance.now();
  renderToggle();
  autoToggle?.focus({ preventScroll: true });
  addEventListener('wheel', onUserScroll, { passive: true });
  addEventListener('touchstart', onUserScroll, { passive: true });
  addEventListener('keydown', onKey);
  autoFrame = requestAnimationFrame(autoStep);
}

function stopAuto() {
  if (!autoOn) return;
  autoOn = false;
  cancelAnimationFrame(autoFrame);
  renderToggle();
  removeEventListener('wheel', onUserScroll);
  removeEventListener('touchstart', onUserScroll);
  removeEventListener('keydown', onKey);
}

autoStart?.addEventListener('click', startAuto);
autoToggle?.addEventListener('click', () => (autoOn ? stopAuto() : startAuto()));
renderToggle();

/* ------------------------------------------------------ the problem -- */

// One set of items travels through three layouts, all measured from real
// (invisible) slots so the geometry is CSS, not numbers in here:
//   cloud  — scattered, jostling, more of them arriving as you scroll
//   inbox  — every item dropped into one Entrada, in the order it came
//   groups — the same items sorted into the contexts they belong to
// Position is a pure function of the act's progress, so scrolling back
// un-sorts and un-dumps. The jostle is the only time-based motion, and it
// grows with the clutter and stops dead once an item is captured.
const PB_GROUPS = [
  { name: 'Casa', color: 'var(--g-green)' },
  { name: 'Cliente Norte', color: 'var(--g-cobalt)' },
  { name: 'Estudos', color: 'var(--g-violet)' },
];
// [label, short label for phones, group, due in days from today (null = no
// date), priority 0-3]. Interleaved, the way things arrive.
const PB_ITEMS: [string, string, number, number | null, number][] = [
  ['Pagar o boleto da luz', 'Boleto da luz', 0, 1, 2],
  ['Revisar a proposta', 'Proposta', 1, 0, 3],
  ['Capítulo 4 de Rust', 'Rust, cap. 4', 2, 4, 0],
  ['Responder o jurídico', 'Jurídico', 1, 0, 2],
  ['Consertar a torneira', 'Torneira', 0, 2, 1],
  ['Decidir o fornecedor', 'Fornecedor', 1, 3, 3],
  ['Aniversário da mãe', 'Aniversário', 0, 9, 2],
  ['Artigo sobre CRDTs', 'CRDTs', 2, null, 0],
  ['Pauta da reunião de quinta', 'Pauta', 1, 5, 1],
  ['Comprar ração da Nina', 'Ração', 0, 1, 0],
  ['Ideia para o blog', 'Blog', 2, null, 0],
  ['Enviar nota fiscal', 'Nota fiscal', 1, 0, 3],
  ['Trocar o filtro do ar', 'Filtro do ar', 0, 12, 0],
  ['Curso de design', 'Design', 2, null, 1],
  ['Integrar o checkout', 'Checkout', 1, 6, 2],
  ['Renovar a CNH', 'CNH', 0, 20, 1],
  ['Backup do notebook', 'Backup', 2, 2, 0],
  ['Cancelar a assinatura', 'Assinatura', 0, 3, 0],
];

/** Card-sized due label: the app's own words for today and tomorrow, then the
 *  short weekday inside a week, then the date. */
function shortDue(days: number): string {
  if (days === 0) return 'hoje';
  if (days === 1) return 'amanhã';
  const key = addDays(today(), days);
  if (days < 7) return weekdayShort(key);
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}
const PHONE_ITEMS = 12;

const arena = $('[data-arena]');
const pbItemsHost = $('[data-pb-items]');
const pbInboxSlots = $('[data-pb-slots="inbox"]');
const pbGroupsHost = $('[data-pb-groups]');
const pbCount = $('[data-pb-count]');
const problemAct = $('.problem');

// Deterministic jitter so the cloud looks the same on every visit.
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

interface PbItem {
  el: HTMLElement;
  group: number;
  cloud: { x: number; y: number; s: number; o: number };
  inbox: { x: number; y: number };
  groups: { x: number; y: number };
  phase: number;
}
const pbItems: PbItem[] = [];

if (arena && pbItemsHost && pbInboxSlots && pbGroupsHost) {
  pbGroupsHost.innerHTML = PB_GROUPS.map(
    (g, gi) =>
      `<div class="pb-col"><p class="pb-head" data-pb-head="groups"><span class="dot" style="--group-color:${g.color}"></span>${esc(g.name)}</p><div class="pb-col__slots" data-pb-slots="g${gi}"></div></div>`
  ).join('');
  const slot = () => '<span class="pb-slot"></span>';
  PB_ITEMS.forEach(([label, short, group, due, prio], i) => {
    const phoneOnlyHidden = i >= PHONE_ITEMS ? ' pb--wide' : '';
    pbInboxSlots.insertAdjacentHTML('beforeend', slot().replace('pb-slot', `pb-slot${phoneOnlyHidden}`));
    pbGroupsHost.querySelector(`[data-pb-slots="g${group}"]`)?.insertAdjacentHTML('beforeend', slot().replace('pb-slot', `pb-slot${phoneOnlyHidden}`));
    const el = document.createElement('span');
    el.className = `pb-item${phoneOnlyHidden}`;
    const dueHTML =
      due === null ? '' : `<span class="pb-due${due === 0 ? ' pb-due--today' : ''}">${esc(shortDue(due))}</span>`;
    const prioHTMLs = prio
      ? `<span class="prio prio--${prio} pb-prio" title="Prioridade ${PRIORITY_LABELS[prio as 1 | 2 | 3].toLowerCase()}"><span class="prio__bars">${[1, 2, 3]
          .map((b) => `<span class="prio__bar" style="height:${3 + b * 2}px;opacity:${b <= prio ? 1 : 0.28}"></span>`)
          .join('')}</span></span>`
      : '';
    el.innerHTML = `<span class="pb-item__box"></span><span class="pb-item__label" data-short="${esc(short)}">${esc(label)}</span>${
      dueHTML || prioHTMLs ? `<span class="pb-item__meta">${dueHTML}${prioHTMLs}</span>` : ''
    }`;
    pbItemsHost.appendChild(el);
    pbItems.push({
      el,
      group,
      cloud: { x: 0, y: 0, s: 0.86 + rand(i, 3) * 0.28, o: 0.5 + rand(i, 4) * 0.45 },
      inbox: { x: 0, y: 0 },
      groups: { x: 0, y: 0 },
      phase: rand(i, 5) * Math.PI * 2,
    });
  });
}

function measureProblem() {
  if (!arena) return;
  // Room each card's label must give up once its date and priority show.
  pbItems.forEach((it) => {
    const meta = it.el.querySelector<HTMLElement>('.pb-item__meta');
    it.el.style.setProperty('--meta-w', meta ? `${meta.offsetWidth + 8}px` : '0px');
  });
  const a = arena.getBoundingClientRect();
  const visible = pbItems.filter((it) => getComputedStyle(it.el).display !== 'none');
  const inboxSlots = [...arena.querySelectorAll<HTMLElement>('[data-pb-slots="inbox"] .pb-slot')].filter(
    (s) => getComputedStyle(s).display !== 'none'
  );
  const groupSlots = PB_GROUPS.map((_, gi) =>
    [...arena.querySelectorAll<HTMLElement>(`[data-pb-slots="g${gi}"] .pb-slot`)].filter((s) => getComputedStyle(s).display !== 'none')
  );
  const used = PB_GROUPS.map(() => 0);
  // Cloud: a jittered grid over the arena, so items scatter without piling up.
  const cols = a.width > 520 ? 3 : 2;
  const rows = Math.ceil(visible.length / cols);
  const w = visible[0]?.el.offsetWidth ?? 0;
  const h = visible[0]?.el.offsetHeight ?? 0;
  visible.forEach((it, i) => {
    // Step through the cells by 7 (coprime with 12 and 18) so neighbours in
    // the list land far apart in the cloud.
    const cell = (i * 7) % visible.length;
    const cx = cell % cols;
    const cy = Math.floor(cell / cols);
    const cw = a.width / cols;
    const ch = a.height / rows;
    it.cloud.x = cx * cw + rand(i, 6) * Math.max(0, cw - w);
    it.cloud.y = cy * ch + rand(i, 7) * Math.max(0, ch - h);
    const is = inboxSlots[i]?.getBoundingClientRect();
    if (is) it.inbox = { x: is.left - a.left, y: is.top - a.top };
    const gs = groupSlots[it.group]?.[used[it.group]!++]?.getBoundingClientRect();
    if (gs) it.groups = { x: gs.left - a.left, y: gs.top - a.top };
  });
}

let problemVisible = false;
if (problemAct) {
  new IntersectionObserver(([e]) => (problemVisible = !!e?.isIntersecting)).observe(problemAct);
}
addEventListener('resize', () => requestAnimationFrame(measureProblem));
document.fonts?.ready.then(measureProblem);

function problemFrame(now: number) {
  requestAnimationFrame(problemFrame);
  if (!problemVisible || !problemAct) return;
  const q = parseFloat(problemAct.style.getPropertyValue('--sc-p')) || 0;
  const still = reduce.matches;
  const visible = pbItems.filter((it) => it.el.offsetParent !== null);
  const n = visible.length;
  // Phase A: the mind fills up. A third start already on screen (so the first
  // view is never empty); the rest arrive over the first third of the act.
  const arrived = Math.round(n * 0.35 + clamp01(q / 0.22) * n * 0.65);
  let captured = 0;
  visible.forEach((it, i) => {
    // Four beats over the act: cloud (0-.25), inbox (.25-.5), groups
    // (.5-.75), dates and priorities (.75-1). Staggered so items move one
    // after another; every one has settled before the next beat's copy.
    const b = clamp01((q - (0.27 + i * 0.007)) / 0.08);
    const c = clamp01((q - (0.52 + i * 0.006)) / 0.08);
    const d = clamp01((q - (0.77 + i * 0.006)) / 0.06);
    const B = still ? Math.round(b) : smooth(b);
    const C = still ? Math.round(c) : smooth(c);
    if (b >= 0.5) captured++;
    const here = i < arrived || b > 0;
    // Jostle: louder as more items crowd in, gone once captured.
    const crowd = arrived / n;
    const amp = still ? 0 : (2 + crowd * 7) * (1 - B);
    const jx = Math.sin(now / 900 + it.phase) * amp;
    const jy = Math.cos(now / 1100 + it.phase * 1.3) * amp;
    const x = lerp(lerp(it.cloud.x + jx, it.inbox.x, B), it.groups.x, C);
    const y = lerp(lerp(it.cloud.y + jy, it.inbox.y, B), it.groups.y, C);
    const scale = lerp(it.cloud.s, 1, B);
    const opacity = here ? lerp(it.cloud.o, 1, B) : 0;
    it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
    it.el.style.opacity = opacity.toFixed(3);
    it.el.style.setProperty('--boxed', B.toFixed(3));
    it.el.style.setProperty('--planned', (still ? Math.round(d) : smooth(d)).toFixed(3));
  });
  if (pbCount) pbCount.textContent = captured ? String(captured) : '';
  const inboxIn = clamp01((q - 0.25) / 0.05);
  const inboxOut = clamp01((q - 0.5) / 0.05);
  arena?.style.setProperty('--inbox-head', (inboxIn * (1 - inboxOut)).toFixed(3));
  arena?.style.setProperty('--groups-head', clamp01((q - 0.52) / 0.06).toFixed(3));
}
measureProblem();
requestAnimationFrame(problemFrame);

/* ---------------------------------------------------------- focus arrow -- */

// Two halves on screen means two places to look. The arrow says which, one
// side at a time: [scene-progress where this beat starts, side]. The demos
// above are timed so the side it points at is the side that is moving.
type Side = 'L' | 'R';
const FOCUS: Record<SceneName, [number, Side][]> = {
  hero: [[0, 'L'], [0.5, 'R']],
  typing: [[0, 'L'], [0.6, 'R']],
  paste: [[0, 'L'], [0.55, 'R']],
  share: [[0, 'L'], [0.58, 'R']],
  today: [[0, 'L'], [0.22, 'R']],
  overdue: [[0, 'L'], [0.5, 'R']],
  details: [[0, 'L'], [0.56, 'R']],
  trash: [[0, 'L'], [0.42, 'R']],
  views: [[0, 'L'], [0.58, 'R']],
  prefs: [[0, 'L'], [0.64, 'R']],
  updates: [[0, 'L'], [0.62, 'R']],
  quiet: [[0, 'L'], [0.5, 'R']],
};
const focusArrow = $('[data-focus-arrow]');
const heroSection = $('.hero');
const splitAct = $('.split');
const dividerEl = $('.divider');
const captureInput = $<HTMLInputElement>('#capture');
const arrowNow = { x: 0, y: 0, a: 0, o: 0, placed: false };
let lastAngle = 0;
let pulseUntil = 0;

function currentScene(p: number): SceneName {
  // The scene whose window centre is nearest, among those p is inside.
  let best: SceneName = 'hero';
  let bestD = Infinity;
  (Object.keys(SCENES) as SceneName[]).forEach((name) => {
    const [a, b] = SCENES[name];
    if (p < a || p > b) return;
    const d = Math.abs(p - (a + b) / 2);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  });
  return best;
}

function arrowTarget(): { x: number; y: number; a: number; o: number } | null {
  const vw = innerWidth;
  const vh = innerHeight;
  const phone = narrow.matches;
  const clampY = (y: number) => Math.min(vh - 72, Math.max(72, y));
  // Hero: one part only, and it has its own link to the demo.
  if (heroSection && heroSection.getBoundingClientRect().bottom > vh * 0.45) return { ...arrowNow, o: 0 };
  // The problem: point at the cards.
  const probRect = problemAct?.getBoundingClientRect();
  if (probRect && arena && probRect.top <= vh * 0.5 && probRect.bottom > vh * 0.55) {
    const r = arena.getBoundingClientRect();
    if (phone) return { x: vw / 2, y: r.top - 22, a: 90, o: 1 };
    return { x: r.left - 40, y: clampY(r.top + Math.min(r.height, 360) / 2), a: 0, o: 1 };
  }
  if (!splitAct || !dividerEl) return null;
  const p = parseFloat(splitAct.style.getPropertyValue('--sc-p')) || 0;
  const d = dividerEl.getBoundingClientRect();
  // The close: from the sidebar's edge to the one real input.
  if (p >= COLLAPSE[0]) {
    const inp = captureInput?.getBoundingClientRect();
    if (phone) return { x: 36, y: d.top, a: 90, o: 1 };
    return { x: d.left, y: clampY(inp ? inp.top + inp.height / 2 : vh / 3), a: 0, o: 1 };
  }
  const name = currentScene(p);
  const q = inScene(p, name);
  const beats = FOCUS[name];
  let side: Side = beats[0]![1];
  for (const [at, s] of beats) if (q >= at) side = s;
  const pane = side === 'L' ? '.pane--left' : '.pane--right';
  const demo = document.querySelector<HTMLElement>(`${pane} [data-scene="${name}"] .demo`) ??
    document.querySelector<HTMLElement>(`${pane} [data-scene="${name}"]`);
  const r = demo?.getBoundingClientRect();
  if (phone) return { x: vw - 40, y: d.top, a: side === 'L' ? -90 : 90, o: 1 };
  const y = r && r.height ? clampY(r.top + Math.min(r.height, 320) / 2) : vh / 2;
  return { x: d.left, y, a: side === 'L' ? 180 : 0, o: 1 };
}

function arrowFrame(now: number) {
  requestAnimationFrame(arrowFrame);
  if (!focusArrow) return;
  const t = arrowTarget();
  if (!t) return;
  const jump = reduce.matches || !arrowNow.placed;
  const k = jump ? 1 : 0.16;
  arrowNow.x += (t.x - arrowNow.x) * k;
  arrowNow.y += (t.y - arrowNow.y) * k;
  // Shortest way round, so left-to-right turns through the top, not a spin.
  let da = t.a - arrowNow.a;
  while (da > 180) da -= 360;
  while (da < -180) da += 360;
  arrowNow.a += da * (jump ? 1 : 0.2);
  arrowNow.o += (t.o - arrowNow.o) * (jump ? 1 : 0.2);
  if (t.o > 0) arrowNow.placed = true;
  if (t.a !== lastAngle) {
    lastAngle = t.a;
    if (!reduce.matches && arrowNow.placed) pulseUntil = now + 420;
  }
  const pulse = now < pulseUntil ? 1 + 0.18 * Math.sin(((pulseUntil - now) / 420) * Math.PI) : 1;
  focusArrow.style.transform = `translate3d(${arrowNow.x.toFixed(1)}px, ${arrowNow.y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${arrowNow.a.toFixed(1)}deg) scale(${pulse.toFixed(3)})`;
  focusArrow.style.opacity = arrowNow.o.toFixed(3);
}
requestAnimationFrame(arrowFrame);

/* ------------------------------------------------------- visit marker -- */

// Every way into the app from this page (the CTAs, the brand, the capture
// hand-off) marks this device as visited, so the app's root stops sending it
// back here (see the inline script in /index.html). Capture phase and
// auxclick, so a middle-click or a new tab counts too.
function markVisit(e: MouseEvent) {
  const link = (e.target as Element | null)?.closest?.('a[href]');
  if (!(link instanceof HTMLAnchorElement)) return;
  const url = new URL(link.href, location.href);
  if (url.origin === location.origin && url.pathname === '/') writePref('visited', '1');
}
document.addEventListener('click', markVisit, true);
document.addEventListener('auxclick', markVisit, true);

window.ScrollCraft.mount(document.body);
requestAnimationFrame(frame);
reduce.addEventListener('change', () => (lastP = -1));
narrow.addEventListener('change', () => (lastP = -1));
