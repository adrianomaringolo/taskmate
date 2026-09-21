import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './Icon';

interface Props {
  /** Label on the collapsed trigger. */
  label: string;
  placeholder: string;
  onCreate: (name: string) => void | Promise<void>;
  className?: string;
  /** Renders only the icon; the label goes to the accessible name. */
  compact?: boolean;
  maxLength?: number;
  /**
   * Existing values to offer via the browser's own autocomplete (a native
   * `<datalist>`) — e.g. tags already used elsewhere. Optional: callers that
   * pass nothing get the plain input, unchanged.
   */
  suggestions?: string[];
}

/**
 * Creating a group or list happens in place: the button becomes the input.
 * No dialog, which is the product register's default-modal trap.
 */
export function InlineCreate({
  label,
  placeholder,
  onCreate,
  className = 'btn btn--add',
  compact = false,
  maxLength = 80,
  suggestions,
}: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const datalistId = useId();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = async () => {
    const name = value.trim();
    if (!name) {
      setOpen(false);
      setValue('');
      return;
    }
    setBusy(true);
    await onCreate(name);
    setBusy(false);
    setValue('');
    // Stay open: creating several lists in a row is the common case.
    inputRef.current?.focus();
  };

  if (!open) {
    return (
      <button
        type="button"
        className={compact ? 'btn btn--icon' : className}
        onClick={() => setOpen(true)}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
      >
        <Icon name="plus" />
        {!compact && label}
      </button>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        className="input input--inline"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        maxLength={maxLength}
        disabled={busy}
        list={suggestions?.length ? datalistId : undefined}
        autoComplete="off"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value.trim()) void submit();
          else setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setValue('');
            setOpen(false);
          }
        }}
      />
      {suggestions?.length ? (
        <datalist id={datalistId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}
