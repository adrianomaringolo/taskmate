import type { ReactNode } from 'react';

/**
 * One icon set, one stroke weight, one grid. Product UI lives or dies on the
 * icons matching each other; mixing sources is the fastest way to look off.
 */
const PATHS = {
  chevron: <path d="M6.5 3.5 11 8l-4.5 4.5" />,
  plus: <path d="M8 3.5v9M3.5 8h9" />,
  check: <path d="M3.5 8.5l3 3 6-6.5" />,
  x: <path d="M4 4l8 8M12 4l-8 8" />,
  trash: (
    <>
      <path d="M2.5 4.5h11M6 4.5V3h4v1.5M4.5 4.5l.6 8.2a1 1 0 0 0 1 .8h3.8a1 1 0 0 0 1-.8l.6-8.2" />
      <path d="M6.8 7v4M9.2 7v4" />
    </>
  ),
  more: (
    <>
      <circle cx="3.5" cy="8" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="8" cy="8" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12.5" cy="8" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  grip: (
    <>
      <circle cx="6" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="4" r="1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  inbox: (
    <>
      <path d="M2 9.5 3.6 3.7A1 1 0 0 1 4.6 3h6.8a1 1 0 0 1 1 .7L14 9.5v2.8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9.5Z" />
      <path d="M2 9.5h3.2l.8 1.6h4l.8-1.6H14" />
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
  keyboard: (
    <>
      <rect x="1.5" y="4" width="13" height="8" rx="1.5" />
      <path d="M4 6.5h.01M6.5 6.5h.01M9 6.5h.01M11.5 6.5h.01M4 9.5h8" />
    </>
  ),
  alert: (
    <>
      <path d="M8 2.8 14 12.5a.8.8 0 0 1-.7 1.2H2.7a.8.8 0 0 1-.7-1.2L8 2.8Z" />
      <path d="M8 6.5v3M8 11.5h.01" />
    </>
  ),
  list: <path d="M3 4.5h10M3 8h10M3 11.5h6" />,
  /* The brand mark. Deliberately not three bars — at 18px those read as a
     hamburger menu, which is exactly what it sits next to. */
  mark: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="3.6" />
      <path d="M5 8.2l2.2 2.2L11.2 5.8" />
    </>
  ),
  folder: <path d="M2.5 4.5A1 1 0 0 1 3.5 3.5h2.2a1 1 0 0 1 .8.4l.8 1.1h5.2a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-7Z" />,
  undo: <path d="M3 7h6.5a3.2 3.2 0 1 1 0 6.4H6M3 7l2.8-2.8M3 7l2.8 2.8" />,
  cloud: <path d="M4.6 12.5h6.6a2.6 2.6 0 0 0 .3-5.2 3.9 3.9 0 0 0-7.5-.7 2.9 2.9 0 0 0 .6 5.9Z" />,
  cloudOff: (
    <>
      <path d="M4.6 12.5h6.6a2.6 2.6 0 0 0 1.9-.85M5.1 6a3.9 3.9 0 0 1 6.4.6M4 6.9a2.9 2.9 0 0 0 .6 5.6" />
      <path d="M2.2 2.2l11.6 11.6" />
    </>
  ),
  cloudCheck: (
    <>
      <path d="M4.6 11.6h5.1a2.6 2.6 0 0 0 1.8-4.5 3.9 3.9 0 0 0-7.5-.7 2.9 2.9 0 0 0 .6 5.2Z" />
      <path d="M5.8 12.6l1.7 1.7 3.4-3.7" />
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
