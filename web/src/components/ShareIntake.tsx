import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  /** The joined title/text/url the OS share sheet handed the app. */
  content: string;
  onSaveAsTask: (text: string) => void;
  onSaveAsNote: (text: string) => void;
  /** Fires when the dialog closes without a choice — X, backdrop, Escape. */
  onDismiss: () => void;
}

/**
 * What a link or post shared from another app (Instagram, a browser, …)
 * lands on before it becomes anything — the OS share sheet hands over text,
 * not intent, so asking "tarefa ou nota?" here is the one unavoidable
 * question. Same native-<dialog> handling as every other panel: `onDismiss`
 * only ever fires from the dialog's own `close` event.
 */
export function ShareIntake({ open, content, onSaveAsTask, onSaveAsNote, onDismiss }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(content);

  useEffect(() => setText(content), [content]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => ref.current?.close();

  const commit = (save: (text: string) => void) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    save(trimmed);
    close();
  };

  return (
    <dialog
      ref={ref}
      className="dialog share"
      onClose={onDismiss}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <button type="button" className="btn btn--icon dialog__close" aria-label="Fechar" onClick={close}>
        <Icon name="x" />
      </button>

      <h2 className="dialog__title">Compartilhado com o Taskmate</h2>
      <p className="dialog__body">Guardar como tarefa ou como nota?</p>

      <textarea
        className="textarea share__text"
        value={text}
        aria-label="Conteúdo compartilhado"
        maxLength={2000}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="share__actions">
        <button type="button" className="btn btn--primary share__choice" onClick={() => commit(onSaveAsTask)}>
          <Icon name="inbox" size={16} />
          Tarefa
        </button>
        <button type="button" className="btn btn--primary share__choice" onClick={() => commit(onSaveAsNote)}>
          <Icon name="notepadText" size={16} />
          Nota
        </button>
      </div>
    </dialog>
  );
}
