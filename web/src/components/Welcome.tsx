import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

interface Step {
  icon: IconName;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: 'mark',
    title: 'Boas-vindas ao Taskmate, seu companheiro de tarefas',
    body: 'Organiza o que você precisa fazer em grupos, listas e tarefas — mas nada disso é obrigatório para começar, dá pra usar só a Entrada. Os próximos passos são um resumo rápido do que dá pra fazer.',
  },
  {
    icon: 'plus',
    title: 'Capturar é sempre rápido',
    body: 'A tecla N foca a captura em qualquer tela. O que você digitar cai na Entrada — escolher grupo, lista ou prazo pode esperar pra depois.',
  },
  {
    icon: 'folder',
    title: 'Organize quando fizer sentido',
    body: 'Crie grupos e listas pela lateral quando a Entrada começar a misturar assuntos. Arraste tarefas entre listas, ou use as setas no detalhe da tarefa.',
  },
  {
    icon: 'today',
    title: 'Prazo, prioridade e repetição',
    body: 'Cada tarefa pode ter prazo, prioridade e uma repetição — diária, semanal ou mensal. Concluir uma tarefa recorrente só avança para a próxima data; ela nunca some do histórico.',
  },
  {
    icon: 'cloud',
    title: 'Sincronizar é opcional',
    body: 'Sem conectar nada, os dados ficam só neste dispositivo. Pra usar em mais de um, conecte seu Google Drive — sem servidor nosso, sem senha, o arquivo continua seu.',
  },
  {
    icon: 'keyboard',
    title: 'Atalhos e lembretes',
    body: 'O ícone de teclado na barra de cima lista os atalhos, e o de sino ativa um aviso diário sobre tarefas vencendo. Este tour fica sempre disponível em "Ajuda", na lateral.',
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * A native <dialog>, not a hand-rolled overlay div — the same reasoning
 * Menu.tsx gives for the Popover API: focus trap and Escape-to-close come
 * for free instead of being reimplemented.
 *
 * `onClose` is only ever driven by the dialog's own `close` event, never
 * called directly from a button — every dismissal path (X, Pular, Concluir,
 * backdrop click, Escape) closes the native element the same way, so there
 * is exactly one place that notifies the parent.
 */
export function Welcome({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setStep(0);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const close = () => ref.current?.close();
  const last = step === STEPS.length - 1;
  const current = STEPS[step]!;

  return (
    <dialog
      ref={ref}
      className="welcome"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <button type="button" className="btn btn--icon welcome__close" aria-label="Fechar" onClick={close}>
        <Icon name="x" />
      </button>

      <div className="welcome__icon">
        <Icon name={current.icon} size={26} />
      </div>
      <h2 className="welcome__title">{current.title}</h2>
      <p className="welcome__body">{current.body}</p>

      <div className="welcome__dots" role="tablist" aria-label="Etapas">
        {STEPS.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === step}
            aria-label={`Etapa ${i + 1} de ${STEPS.length}`}
            className="welcome__dot"
            data-active={i === step}
            onClick={() => setStep(i)}
          />
        ))}
      </div>

      <div className="welcome__actions">
        {step > 0 ? (
          <button type="button" className="btn btn--sm btn--ghost" onClick={() => setStep((s) => s - 1)}>
            Voltar
          </button>
        ) : (
          <button type="button" className="btn btn--sm btn--ghost" onClick={close}>
            Pular
          </button>
        )}
        <button type="button" className="btn btn--primary" onClick={() => (last ? close() : setStep((s) => s + 1))}>
          {last ? 'Concluir' : 'Avançar'}
        </button>
      </div>
    </dialog>
  );
}
