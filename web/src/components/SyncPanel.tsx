import { useState } from 'react';
import { useStore } from '../lib/store';
import { describeSyncState } from '../lib/sync';
import { Icon, type IconName } from './Icon';
import { Menu } from './Menu';

/**
 * Sync is visible but never in the way: one icon whose shape says which of four
 * states the app is in, and a panel that only appears when asked. A task app
 * should not open with a dialog about storage.
 */
export function SyncPanel() {
  const { sync } = useStore();
  const [confirmingForget, setConfirmingForget] = useState(false);

  const { state } = sync;
  const icon: IconName =
    state.kind === 'error'
      ? 'alert'
      : state.kind === 'idle'
        ? 'cloudCheck'
        : state.kind === 'syncing'
          ? 'cloud'
          : 'cloudOff';

  const summary = describeSyncState(state);

  return (
    <Menu
      label={`Sincronização — ${summary}`}
      triggerClassName={`btn btn--icon sync-trigger${state.kind === 'error' ? ' sync-trigger--error' : ''}${
        state.kind === 'syncing' ? ' sync-trigger--busy' : ''
      }`}
      triggerContent={<Icon name={icon} />}
      menuClassName="sheet sync-sheet"
    >
      {(close) => (
        <>
          <p className="menu__label">Sincronização</p>
          <p className="sync-sheet__status">{summary}</p>

          {!sync.configured && (
            <p className="sync-sheet__body">
              Este build não tem um ID de cliente do Google. Defina{' '}
              <code>VITE_GOOGLE_CLIENT_ID</code> e recompile — o passo a passo está no README. Sem
              isso o app funciona normalmente, só neste dispositivo.
            </p>
          )}

          {sync.configured && !sync.connected && (
            <>
              <p className="sync-sheet__body">
                Guarda um arquivo <code>taskmate.automerge</code> no seu Drive e mantém os
                dispositivos em dia. O app só vê arquivos que ele mesmo criou.
              </p>
              <button
                type="button"
                className="btn btn--primary sync-sheet__action"
                onClick={() => {
                  void sync.connect();
                  close();
                }}
              >
                <Icon name="cloud" />
                Conectar ao Google Drive
              </button>
            </>
          )}

          {sync.configured && sync.connected && (
            <>
              {state.kind === 'error' && state.needsAuth && (
                <button
                  type="button"
                  className="btn btn--primary sync-sheet__action"
                  onClick={() => {
                    void sync.connect();
                    close();
                  }}
                >
                  Reconectar
                </button>
              )}
              <button
                type="button"
                className="menu__item"
                disabled={state.kind === 'syncing'}
                onClick={() => {
                  void sync.now();
                  close();
                }}
              >
                <Icon name="undo" />
                Sincronizar agora
              </button>
              <button
                type="button"
                className="menu__item"
                onClick={() => {
                  void sync.disconnect();
                  close();
                }}
              >
                <Icon name="cloudOff" />
                Desconectar deste dispositivo
              </button>
            </>
          )}

          <hr className="menu__sep" />

          {confirmingForget ? (
            <div className="confirm">
              <p className="confirm__text">
                Apaga tudo que está guardado neste navegador. Se você estiver conectado ao Drive, o
                arquivo lá continua intacto e volta no próximo login.
              </p>
              <div className="confirm__actions">
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => setConfirmingForget(false)}
                >
                  Manter
                </button>
                <button type="button" className="btn btn--sm btn--danger" onClick={() => void sync.forget()}>
                  Apagar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="menu__item menu__item--danger"
              onClick={() => setConfirmingForget(true)}
            >
              <Icon name="trash" />
              Esquecer dados deste dispositivo
            </button>
          )}
        </>
      )}
    </Menu>
  );
}
