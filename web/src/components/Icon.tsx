import type { ReactNode } from 'react';

/**
 * One icon set, one stroke weight, one grid. Product UI lives or dies on the
 * icons matching each other; mixing sources is the fastest way to look off.
 *
 * Most paths below are Lucide's own geometry, scaled 24→16 with
 * `tools/lucide-scale.mjs` rather than retraced by hand: hand-typed arc
 * parameters are exactly what produced the malformed `cloudCheck` this
 * replaces (see git history) — real, tested path data removes that failure
 * mode entirely. A few icons stay custom on purpose: `mark` (the brand),
 * `today`/`upcoming`/`calendar` (bespoke dot-grid compositions), `list`
 * (lines-of-text reads better than Lucide's bulleted-list for a notes
 * indicator), and `moon`/`search`/`sun`/`keyboard`/`monitor`/`menu` (simple
 * enough to carry no arc risk, or deliberately simplified for legibility at
 * 16px).
 *
 * Copyright (c) 2026 Lucide Icons and Contributors — ISC License, full text
 * in assets/lucide-LICENSE.txt. See ATTRIBUTION.md.
 */
const PATHS = {
  chevron: <path d="m6 12 4-4-4-4" />,
  help: (
    <>
      <circle cx="8" cy="8" r="6.7" />
      <path d="M6.1 6a2 2 0 0 1 3.9 .7c0 1.3-2 2-2 2" />
      <path d="M8 11.3h.1" />
    </>
  ),
  externalLink: (
    <>
      <path d="M10 2h4v4" />
      <path d="M6.7 9.3 14 2" />
      <path d="M12 8.7v4a1.3 1.3 0 0 1-1.3 1.3H3.3a1.3 1.3 0 0 1-1.3-1.3V5.3a1.3 1.3 0 0 1 1.3-1.3h4" />
    </>
  ),
  arrowUp: (
    <>
      <path d="m3.3 8 4.7-4.7 4.7 4.7" />
      <path d="M8 12.7V3.3" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M8 3.3v9.3" />
      <path d="m12.7 8-4.7 4.7-4.7-4.7" />
    </>
  ),
  bell: (
    <>
      <path d="M6.8 14a1.3 1.3 0 0 0 2.3 0" />
      <path d="M2.2 10.2A.7 .7 0 0 0 2.7 11.3h10.7a.7 .7 0 0 0 .5-1.1C12.9 9.3 12 8.3 12 5.3A4 4 0 0 0 4 5.3c0 3-.9 4-1.8 4.9" />
    </>
  ),
  bellOff: (
    <>
      <path d="M6.8 14a1.3 1.3 0 0 0 2.3 0" />
      <path d="M11.3 11.3H2.7a.7 .7 0 0 1-.5-1.1C3.1 9.3 4 8.3 4 5.3a4 4 0 0 1 .2-1.2" />
      <path d="m1.3 1.3 13.3 13.3" />
      <path d="M5.8 2A4 4 0 0 1 12 5.3c0 1.8 .5 3.1 1.1 4" />
    </>
  ),
  plus: (
    <>
      <path d="M3.3 8h9.3" />
      <path d="M8 3.3v9.3" />
    </>
  ),
  check: <path d="M13.3 4 6 11.3l-3.3-3.3" />,
  repeat: (
    <>
      <path d="m11.3 1.3 2.7 2.7-2.7 2.7" />
      <path d="M2 7.3v-.7a2.7 2.7 0 0 1 2.7-2.7h9.3" />
      <path d="m4.7 14.7-2.7-2.7 2.7-2.7" />
      <path d="M14 8.7v.7a2.7 2.7 0 0 1-2.7 2.7H2" />
    </>
  ),
  x: (
    <>
      <path d="M12 4 4 12" />
      <path d="m4 4 8 8" />
    </>
  ),
  trash: (
    <>
      <path d="M6.7 7.3v4M9.3 7.3v4" />
      <path d="M12.7 4v9.3a1.3 1.3 0 0 1-1.3 1.3H4.7a1.3 1.3 0 0 1-1.3-1.3V4" />
      <path d="M2 4h12" />
      <path d="M5.3 4V2.7a1.3 1.3 0 0 1 1.3-1.3h2.7a1.3 1.3 0 0 1 1.3 1.3v1.3" />
    </>
  ),
  more: (
    <>
      <circle cx="8" cy="8" r=".7" fill="currentColor" stroke="none" />
      <circle cx="12.7" cy="8" r=".7" fill="currentColor" stroke="none" />
      <circle cx="3.3" cy="8" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  grip: (
    <>
      <circle cx="6" cy="8" r=".7" fill="currentColor" stroke="none" />
      <circle cx="6" cy="3.3" r=".7" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12.7" r=".7" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r=".7" fill="currentColor" stroke="none" />
      <circle cx="10" cy="3.3" r=".7" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12.7" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  inbox: (
    <>
      <polyline points="14.7 8 10.7 8 9.3 10 6.7 10 5.3 8 1.3 8" />
      <path d="M3.6 3.4 1.3 8v4a1.3 1.3 0 0 0 1.3 1.3h10.7a1.3 1.3 0 0 0 1.3-1.3v-4l-2.3-4.6A1.3 1.3 0 0 0 11.2 2.7H4.8a1.3 1.3 0 0 0-1.2.7z" />
    </>
  ),
  today: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" />
      <circle cx="8" cy="10" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  upcoming: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" />
      <path d="M5 9.5h2M9 9.5h2M5 11.5h2M9 11.5h2" />
    </>
  ),
  calendar: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" />
      <path d="M5 9h.01M8 9h.01M11 9h.01M5 11.5h.01M8 11.5h.01M11 11.5h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3.5 3.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1" />
    </>
  ),
  moon: <path d="M13 9.7A5.6 5.6 0 0 1 6.3 3a5.6 5.6 0 1 0 6.7 6.7Z" />,
  monitor: (
    <>
      <rect x="2" y="3" width="12" height="8" rx="1.2" />
      <path d="M6 13.5h4M8 11v2.5" />
    </>
  ),
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  eye: (
    <>
      <path d="M1.3 8S4 3.2 8 3.2 14.7 8 14.7 8 12 12.8 8 12.8 1.3 8 1.3 8Z" />
      <circle cx="8" cy="8" r="2.1" />
    </>
  ),
  keyboard: (
    <>
      <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
      <path d="M4 6.5h.01M6.5 6.5h.01M9 6.5h.01M11.5 6.5h.01M4 9.5h8" />
    </>
  ),
  alert: (
    <>
      <path d="m14.5 12-5.3-9.3a1.3 1.3 0 0 0-2.3 0l-5.3 9.3A1.3 1.3 0 0 0 2.7 14h10.7a1.3 1.3 0 0 0 1.2-2" />
      <path d="M8 6v2.7M8 11.3h.1" />
    </>
  ),
  list: <path d="M3 4.5h10M3 8h10M3 11.5h6" />,
  /* The brand mark: a check whose long arm keeps going, up into a ray, with a
     detached dash just ahead of the tip — "done, and moving up". Deliberately
     not a checkbox square (reads as a UI control) and not three bars (reads as
     the hamburger it sits next to). */
  mark: (
    <>
      <path d="M3.4 10.4 5.5 12.7 11.6 4.6" />
      <path d="M12.9 2.9 13.9 1.6" />
    </>
  ),
  folder: (
    <path d="M13.3 13.3a1.3 1.3 0 0 0 1.3-1.3V5.3a1.3 1.3 0 0 0-1.3-1.3h-5.3a1.3 1.3 0 0 1-1.1-.6L6.4 2.6A1.3 1.3 0 0 0 5.3 2H2.7a1.3 1.3 0 0 0-1.3 1.3v8.7a1.3 1.3 0 0 0 1.3 1.3Z" />
  ),
  undo: (
    <>
      <path d="M6 9.3 2.7 6l3.3-3.3" />
      <path d="M2.7 6h7a3.7 3.7 0 0 1 3.7 3.7a3.7 3.7 0 0 1-3.7 3.7H7.3" />
    </>
  ),
  cloud: <path d="M11.7 12.7H6a4.7 4.7 0 1 1 4.5-6h1.2a3 3 0 1 1 0 6Z" />,
  cloudOff: (
    <>
      <path d="M7.3 3.5A4.7 4.7 0 0 1 10.5 6.7h1.2a3 3 0 0 1 2.8 4" />
      <path d="M12.5 12.5A3 3 0 0 1 11.7 12.7H6A4.7 4.7 0 0 1 3.9 3.9" />
      <path d="m1.3 1.3 13.3 13.3" />
    </>
  ),
  /* Same cloud outline as `cloud`, deliberately — a family of three sync
     states should share one silhouette, not three independently-hand-typed
     near-copies of it. The tick is custom: nothing in Lucide's own
     cloud-check nests a checkmark inside this outline, so it is fitted and
     verified at render size rather than pretending it's a straight port. */
  cloudCheck: (
    <>
      <path d="M11.7 12.7H6a4.7 4.7 0 1 1 4.5-6h1.2a3 3 0 1 1 0 6Z" />
      <path d="M5.7 9.4l1.7 1.7 3.2-3.4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

interface Props {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
