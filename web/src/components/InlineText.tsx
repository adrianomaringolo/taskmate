import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  ariaLabel: string;
  placeholder?: string;
  maxLength?: number;
}

/**
 * Text that edits itself in place, so renaming needs no "edit mode". Commits on
 * blur and on Enter; Escape restores the original. Empty input reverts rather
 * than saving a nameless row.
 *
 * It is a `<textarea>`, not an `<input>`, for one reason: task titles and list
 * names run long, and a single-line input can only scroll them out of sight —
 * on a narrow viewport the end of the title simply disappears. Enter never
 * inserts a newline here, so the value stays single-line either way.
 */
export function InlineText({ value, onCommit, className = '', ariaLabel, placeholder, maxLength = 80 }: Props) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const escaped = useRef(false);

  // Adopt external changes (another tab, a failed save that refetched) unless
  // the user is mid-edit.
  useEffect(() => {
    if (document.activeElement !== ref.current) setDraft(value);
  }, [value]);

  // Grow to fit the wrapped text. Before paint, so there is no jump.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const commit = () => {
    const next = draft.trim();
    if (!next || next === value) {
      setDraft(value);
      return;
    }
    onCommit(next);
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      maxLength={maxLength}
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value.replace(/\r?\n/g, ' '))}
      onBlur={() => {
        if (escaped.current) {
          escaped.current = false;
          return;
        }
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
          ref.current?.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          escaped.current = true;
          setDraft(value);
          ref.current?.blur();
        }
      }}
    />
  );
}
