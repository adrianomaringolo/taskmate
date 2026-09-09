import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  /** Accessible name for the trigger button. */
  label: string;
  triggerContent: ReactNode;
  triggerClassName?: string;
  menuClassName?: string;
  /** Aligns the menu's start or end edge with the trigger. */
  align?: 'start' | 'end';
  children: (close: () => void) => ReactNode;
}

const GAP = 6;
const EDGE = 8;

/**
 * Built on the native Popover API rather than an absolutely-positioned div:
 * the menu is in the top layer, so it escapes the sidebar's `overflow-y: auto`
 * without a portal, and gets light-dismiss plus Escape for free.
 */
export function Menu({
  label,
  triggerContent,
  triggerClassName = 'btn btn--icon',
  menuClassName = '',
  align = 'end',
  children,
}: Props) {
  const id = useId().replace(/:/g, '-');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const t = trigger.getBoundingClientRect();
    const w = menu.offsetWidth || 190;
    const h = menu.offsetHeight || 0;

    let left = align === 'end' ? t.right - w : t.left;
    left = Math.min(Math.max(left, EDGE), window.innerWidth - w - EDGE);

    // Flip above the trigger when there isn't room below.
    const below = t.bottom + GAP;
    const top = below + h > window.innerHeight - EDGE ? Math.max(t.top - h - GAP, EDGE) : below;

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  }, [align]);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    // Only track scroll/resize while the menu is actually open. A closed menu
    // needs no repositioning, and this component is rendered once per task row —
    // dozens of always-on capture-phase scroll listeners would be a real cost.
    const bindReposition = () => {
      window.addEventListener('resize', place);
      // Capture phase: scroll events from the sidebar don't bubble to window.
      window.addEventListener('scroll', place, true);
    };
    const unbindReposition = () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };

    // Position before the first paint of the open state, then correct once the
    // real size is known.
    const onBeforeToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open') place();
    };
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === 'open') {
        place();
        bindReposition();
      } else {
        unbindReposition();
      }
    };

    menu.addEventListener('beforetoggle', onBeforeToggle);
    menu.addEventListener('toggle', onToggle);

    return () => {
      menu.removeEventListener('beforetoggle', onBeforeToggle);
      menu.removeEventListener('toggle', onToggle);
      unbindReposition();
    };
  }, [place]);

  const close = useCallback(() => {
    menuRef.current?.hidePopover();
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        title={label}
        popoverTarget={id}
      >
        {triggerContent}
      </button>
      <div ref={menuRef} id={id} popover="auto" className={`menu ${menuClassName}`.trim()}>
        {children(close)}
      </div>
    </>
  );
}
