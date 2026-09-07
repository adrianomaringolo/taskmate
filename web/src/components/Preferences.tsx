import { useCallback, useEffect, useRef, useState } from 'react';
import { toMarkdown } from '../lib/export';
import * as Reminder from '../lib/notify';
import { today } from '../lib/date';
import type { AppState } from '../lib/types';
import type { ThemeChoice } from '../lib/useTheme';
import type { VisionChoice } from '../lib/useA11y';
import type { WeekStart } from '../lib/weekstart';
import { Icon, type IconName } from './Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  data: AppState;
  theme: ThemeChoice;
  onTheme: (value: ThemeChoice) => void;
  vision: VisionChoice;
  onVision: (value: VisionChoice) => void;
  weekStart: WeekStart;
  onWeekStart: (value: WeekStart) => void;
}

const THEMES: [ThemeChoice, IconName, string][] = [
  ['system', 'monitor', 'Sistema'],
  ['light', 'sun', 'Claro'],
  ['dark', 'moon', 'Escuro'],
];

/**
 * One home for every device-local preference — theme, low-vision mode, the
 * daily reminder, week start — plus the Markdown export. Same native-`<dialog>`
 * handling as About/Welcome: `onClose` fires only from the dialog's own `close`
 * event, and the X and the backdrop both call `dialog.close()`.
 */
export function Preferences({
  open,
  onClose,
  data,
  theme,
  onTheme,
  vision,
  onVision,
  weekStart,
  onWeekStart,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => ref.current?.close();

  const [reminder, setReminder] = useState(() => ({
    permission: Reminder.permission(),
    enabled: Reminder.enabled(),
  }));
  const refreshReminder = useCallback(
    () => setReminder({ permission: Reminder.permission(), enabled: Reminder.enabled() }),
    []
  );
  const reminderActive = reminder.permission === 'granted' && reminder.enabled;

  const toggleReminder = useCallback(async () => {
    if (reminderActive) {
      Reminder.setEnabled(false);
    } else {
      const result =
        reminder.permission === 'granted' ? 'granted' : await Reminder.requestPermission();
      if (result === 'granted') Reminder.setEnabled(true);
    }
    refreshReminder();
  }, [reminderActive, reminder.permission, refreshReminder]);

  const exportMarkdown = () => {
    const blob = new Blob([toMarkdown(data)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskmate-${today()}.md`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <dialog
      ref={ref}
      className="dialog prefs"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <button type="button" className="btn btn--icon dialog__close" aria-label="Fechar" onClick={close}>
        <Icon name="x" />
      </button>

      <h2 className="dialog__title">Preferências</h2>

      <section className="prefs__section">
        <p className="prefs__label">Tema</p>
        <div className="seg" role="group" aria-label="Tema">
          {THEMES.map(([value, icon, label]) => (
            <button
              key={value}
              type="button"
              className="seg__btn"
              aria-pressed={theme === value}
              onClick={() => onTheme(value)}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="prefs__section">
        <p className="prefs__label">Texto ampliado</p>
        <label className="prefs__toggle">
          <input
            type="checkbox"
            checked={vision === 'low-vision'}
            onChange={(e) => onVision(e.target.checked ? 'low-vision' : 'default')}
          />
          <span>
            Aumenta o texto, os alvos de toque e o contorno de foco em todo o app.
          </span>
        </label>
      </section>

      <section className="prefs__section">
        <p className="prefs__label">Início da semana</p>
        <div className="seg" role="group" aria-label="Início da semana">
          <button
            type="button"
            className="seg__btn"
            aria-pressed={weekStart === 'monday'}
            onClick={() => onWeekStart('monday')}
          >
            Segunda
          </button>
          <button
            type="button"
            className="seg__btn"
            aria-pressed={weekStart === 'sunday'}
            onClick={() => onWeekStart('sunday')}
          >
            Domingo
          </button>
        </div>
      </section>

      {Reminder.isSupported() && (
        <section className="prefs__section">
          <p className="prefs__label">Lembrete diário</p>
          {reminder.permission === 'denied' ? (
            <p className="prefs__note">
              O navegador bloqueou as notificações para este site. Libere nas configurações do site
              para usar o lembrete.
            </p>
          ) : (
            <>
              <label className="prefs__toggle">
                <input type="checkbox" checked={reminderActive} onChange={() => void toggleReminder()} />
                <span>
                  Avisa sobre tarefas vencendo hoje ou amanhã, a partir das 8h, na próxima vez que o
                  app estiver aberto. Sem servidor por trás — nada chega com o navegador fechado.
                </span>
              </label>
              {reminderActive && (
                <button
                  type="button"
                  className="btn btn--sm btn--ghost prefs__action"
                  onClick={() =>
                    Reminder.showReminder('Teste', 'É assim que a notificação diária aparece.')
                  }
                >
                  Testar agora
                </button>
              )}
            </>
          )}
        </section>
      )}

      <section className="prefs__section">
        <p className="prefs__label">Seus dados</p>
        <p className="prefs__note">
          O arquivo sincronizado no Drive é binário. Exporte um Markdown legível para ler, versionar
          ou levar para outro lugar.
        </p>
        <button type="button" className="btn btn--sm btn--ghost prefs__action" onClick={exportMarkdown}>
          <Icon name="externalLink" size={14} />
          Exportar Markdown
        </button>
      </section>
    </dialog>
  );
}
