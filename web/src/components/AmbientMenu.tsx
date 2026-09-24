import { TRACKS } from '../lib/ambient';
import { setAmbientOn, setAmbientSequenceOn, setAmbientTrack, useAmbient } from '../lib/useAmbient';
import { Icon } from './Icon';
import { Menu } from './Menu';

interface Props {
  /** The music could not start — offline on first play. */
  onError: () => void;
}

/**
 * The topbar's music picker: on/off, play-in-sequence, and the six tracks. Picking a track also
 * turns the music on, and the menu stays open so tracks can be compared.
 */
export function AmbientMenu({ onError }: Props) {
  const { on, trackId, sequence } = useAmbient();
  const run = (attempt: Promise<boolean>) => void attempt.then((ok) => ok || onError());

  return (
    <Menu
      label={on ? 'Música ambiente (tocando)' : 'Música ambiente'}
      triggerContent={<Icon name="music" />}
      triggerClassName={`btn btn--icon topbar__ambient${on ? ' is-on' : ''}`}
      menuClassName="ambient-menu"
    >
      {() => (
        <>
          <p className="menu__label">Música ambiente</p>
          <p className="menu__hint">
            Deixe as músicas relaxantes ligadas enquanto usa o app: elas ajudam a organizar os
            pensamentos, e a organização das tarefas vem junto.
          </p>

          <label className="ambient-menu__toggle">
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => run(setAmbientOn(e.target.checked))}
            />
            Tocar música
          </label>
          <label className="ambient-menu__toggle">
            <input
              type="checkbox"
              checked={sequence}
              onChange={(e) => setAmbientSequenceOn(e.target.checked)}
            />
            <span>
              Tocar em sequência
              <span className="ambient-menu__note">Ao fim de cada música, passa para a próxima</span>
            </span>
          </label>

          <hr className="menu__sep" />

          <div role="radiogroup" aria-label="Música">
            {TRACKS.map((track) => {
              const picked = track.id === trackId;
              return (
                <button
                  key={track.id}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  className="menu__item ambient-menu__track"
                  onClick={() => run(setAmbientTrack(track.id))}
                >
                  <span className="ambient-menu__mark" aria-hidden="true">
                    {picked && <Icon name={on ? 'music' : 'check'} size={14} />}
                  </span>
                  <span className="ambient-menu__text">
                    <span className="ambient-menu__name">{track.name}</span>
                    <span className="ambient-menu__note">{track.note}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="menu__hint ambient-menu__foot">
            O app lembra a música e se ela estava tocando. Faixas de HoliznaCC0, em domínio público.
          </p>
        </>
      )}
    </Menu>
  );
}
