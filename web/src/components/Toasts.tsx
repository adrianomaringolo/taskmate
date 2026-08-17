import { useStore } from '../lib/store';
import { Icon } from './Icon';

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;

  return (
    /* Polite, not assertive: an undo offer shouldn't interrupt what the user is
       typing next. Errors carry their own alert role below. */
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast${toast.kind === 'error' ? ' toast--error' : ''}`}
          role={toast.kind === 'error' ? 'alert' : undefined}
        >
          {toast.kind === 'error' && <Icon name="alert" className="toast__icon" />}
          <p className="toast__text">{toast.text}</p>
          {toast.action && (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                toast.action?.run();
                dismissToast(toast.id);
              }}
            >
              <Icon name="undo" />
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            className="btn btn--icon"
            onClick={() => dismissToast(toast.id)}
            aria-label="Fechar aviso"
          >
            <Icon name="x" />
          </button>
        </div>
      ))}
    </div>
  );
}
