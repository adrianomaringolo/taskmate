import { useMemo, useRef, useState, type ClipboardEvent, type RefObject } from 'react';
import { describeDueFull } from '../lib/date';
import { parseCapture, stripListMarker, tokenizeCapture } from '../lib/parse';
import { useStore } from '../lib/store';
import { PRIORITY_LABELS } from '../lib/types';
import { Icon } from './Icon';

interface Props {
  listId: string;
  listName: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function QuickAdd({ listId, listName, inputRef }: Props) {
  const { addTask, addTasks } = useStore();
  const [value, setValue] = useState('');
  const mirrorRef = useRef<HTMLDivElement>(null);

  // Recognised words (prazo, prioridade) get a highlight box behind them, drawn
  // by a mirror div under the transparent input — an <input> can't hold styled
  // spans of its own. Plus a plain-language echo below of what that resolves to.
  const tokens = useMemo(() => tokenizeCapture(value), [value]);
  const parsed = useMemo(() => (value.trim() ? parseCapture(value) : null), [value]);
  const hint =
    parsed && (parsed.dueDate || parsed.priority)
      ? [
          parsed.dueDate ? describeDueFull(parsed.dueDate) : null,
          parsed.priority ? `prioridade ${PRIORITY_LABELS[parsed.priority].toLowerCase()}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  const syncScroll = (el: HTMLInputElement) => {
    if (mirrorRef.current) mirrorRef.current.scrollLeft = el.scrollLeft;
  };

  const submit = () => {
    if (!value.trim()) return;
    const { title, dueDate, priority } = parseCapture(value);
    // Clear first: the field must feel instant even if the write is in flight.
    setValue('');
    void addTask(listId, title, { dueDate: dueDate ?? null, priority });
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const lines = e.clipboardData
      .getData('text')
      .split('\n')
      .map((l) => stripListMarker(l))
      .filter(Boolean);
    // One line is a normal paste; two or more is a checklist.
    if (lines.length < 2) return;
    e.preventDefault();
    setValue('');
    void addTasks(
      listId,
      lines.map((line) => {
        const { title, dueDate, priority } = parseCapture(line);
        return { title, dueDate: dueDate ?? null, priority };
      })
    );
  };

  const marked = tokens.some((t) => t.kind !== null);

  return (
    <div className="quick-add">
      <div className="quick-add__field">
        <span className="quick-add__plus" aria-hidden="true">
          <Icon name="plus" />
        </span>
        <div className="quick-add__editor">
          {marked && (
            <div className="quick-add__mirror" ref={mirrorRef} aria-hidden="true">
              <span className="quick-add__mirror-text">
                {tokens.map((t, i) =>
                  t.kind ? (
                    <mark key={i} className={`quick-add__mark quick-add__mark--${t.kind}`}>
                      {t.text}
                    </mark>
                  ) : (
                    <span key={i}>{t.text}</span>
                  )
                )}
              </span>
            </div>
          )}
          <input
            ref={inputRef}
            className="quick-add__input"
            value={value}
            placeholder={`Adicionar em ${listName}…`}
            aria-label={`Nova tarefa em ${listName}`}
            aria-describedby={hint ? 'quick-add-hint' : undefined}
            maxLength={300}
            onChange={(e) => {
              setValue(e.target.value);
              syncScroll(e.target);
            }}
            onScroll={(e) => syncScroll(e.currentTarget)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setValue('');
                e.currentTarget.blur();
              }
            }}
          />
        </div>
        {value.trim() ? (
          <button type="button" className="btn btn--sm btn--primary" onClick={submit}>
            Adicionar
          </button>
        ) : (
          <span className="quick-add__hint" aria-hidden="true">
            <kbd className="kbd">N</kbd>
          </span>
        )}
      </div>
      {hint && (
        <p className="quick-add__parsed" id="quick-add-hint">
          {hint}
        </p>
      )}
    </div>
  );
}
