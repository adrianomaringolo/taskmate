import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

const BUILT_AT = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(__BUILD_DATE__));

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Same native-<dialog> reasoning as Welcome.tsx. `onClose` is only ever
 * driven by the dialog's own `close` event — the X button and backdrop
 * click both call `dialog.close()` directly rather than the prop, so there
 * is one single path that notifies the parent.
 */
export function About({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      className="dialog about"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <button type="button" className="btn btn--icon dialog__close" aria-label="Fechar" onClick={close}>
        <Icon name="x" />
      </button>

      <h2 className="dialog__title">Sobre o Taskmate</h2>
      <p className="dialog__body">
        Controle de tarefas com grupos, listas e atividades — local-first, sincronização opcional,
        sem conta e sem servidor guardando seus dados.
      </p>

      <dl className="sheet__list about__list">
        <div className="sheet__item">
          <dt>Versão</dt>
          <dd>{__APP_VERSION__}</dd>
        </div>
        <div className="sheet__item">
          <dt>Compilado em</dt>
          <dd>{BUILT_AT}</dd>
        </div>
        <div className="sheet__item">
          <dt>Desenvolvedor</dt>
          <dd>
            <a href="https://adrianomaringolo.dev" target="_blank" rel="noopener noreferrer">
              Adriano Maringolo
              <Icon name="externalLink" size={12} />
            </a>
          </dd>
        </div>
        <div className="sheet__item">
          <dt>Código-fonte</dt>
          <dd>
            <a
              href="https://github.com/adrianomaringolo/taskmate"
              target="_blank"
              rel="noopener noreferrer"
            >
              Repositório no GitHub
              <Icon name="externalLink" size={12} />
            </a>
          </dd>
        </div>
      </dl>

      <p className="about__note">Código aberto — qualquer pessoa pode ler, copiar ou contribuir.</p>
    </dialog>
  );
}
