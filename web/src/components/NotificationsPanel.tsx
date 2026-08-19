import { useCallback, useState } from 'react';
import * as Reminder from '../lib/notify';
import { Icon } from './Icon';
import { Menu } from './Menu';

/**
 * No trigger at all where the API doesn't exist, rather than a button that
 * only explains it can't do anything.
 */
export function NotificationsPanel() {
  const [state, setState] = useState(() => ({
    permission: Reminder.permission(),
    enabled: Reminder.enabled(),
  }));

  const refresh = useCallback(() => {
    setState({ permission: Reminder.permission(), enabled: Reminder.enabled() });
  }, []);

  if (!Reminder.isSupported()) return null;

  const active = state.permission === 'granted' && state.enabled;

  const activate = useCallback(async () => {
    const result = state.permission === 'granted' ? 'granted' : await Reminder.requestPermission();
    if (result === 'granted') Reminder.setEnabled(true);
    refresh();
  }, [state.permission, refresh]);

  const deactivate = useCallback(() => {
    Reminder.setEnabled(false);
    refresh();
  }, [refresh]);

  return (
    <Menu label="Notificações" triggerContent={<Icon name={active ? 'bell' : 'bellOff'} />} menuClassName="sheet">
      {(close) => (
        <>
          <p className="menu__label">Notificações</p>
          <p className="sheet__status">
            {state.permission === 'denied' ? 'Bloqueadas pelo navegador' : active ? 'Ativadas' : 'Desativadas'}
          </p>
          <p className="sheet__body">
            Avisa sobre tarefas ainda não concluídas que vencem hoje ou amanhã, a partir das 8h — na
            próxima vez que o app estiver aberto depois desse horário. Não existe servidor por trás
            disso, então nada chega com o navegador fechado.
          </p>

          {state.permission === 'denied' ? (
            <p className="sheet__body">
              O navegador bloqueou o pedido; o app não pode perguntar de novo. Ative nas configurações
              do site para usar.
            </p>
          ) : active ? (
            <>
              <button
                type="button"
                className="btn btn--sm btn--ghost sheet__action"
                onClick={() => {
                  Reminder.showReminder('Teste', 'É assim que a notificação diária aparece.');
                  close();
                }}
              >
                Testar agora
              </button>
              <button
                type="button"
                className="btn btn--sm btn--ghost sheet__action"
                onClick={() => {
                  deactivate();
                  close();
                }}
              >
                Desativar
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn--primary sheet__action"
              onClick={() => {
                void activate();
                close();
              }}
            >
              <Icon name="bell" />
              Ativar
            </button>
          )}
        </>
      )}
    </Menu>
  );
}
