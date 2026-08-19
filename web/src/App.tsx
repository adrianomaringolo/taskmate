import { useCallback, useEffect, useRef, useState } from 'react';
import { ContentView } from './components/ContentView';
import { Icon } from './components/Icon';
import { Menu } from './components/Menu';
import { NotificationsPanel } from './components/NotificationsPanel';
import { Sidebar } from './components/Sidebar';
import { SyncPanel } from './components/SyncPanel';
import { Toasts } from './components/Toasts';
import { today } from './lib/date';
import * as Reminder from './lib/notify';
import { readPref, writePref } from './lib/prefs';
import { initPwa } from './lib/pwa';
import { StoreProvider, useStore } from './lib/store';
import type { View } from './lib/types';
import { useA11y, type VisionChoice } from './lib/useA11y';
import { useTheme, type ThemeChoice } from './lib/useTheme';

const VIEW_KEY = 'view';

const TODAY: View = { kind: 'today' };

function readView(): View {
  try {
    const raw = readPref(VIEW_KEY);
    if (!raw) return TODAY;

    const parsed = JSON.parse(raw) as { kind?: unknown; listId?: unknown; mode?: unknown };
    if (parsed.kind === 'today' || parsed.kind === 'upcoming') return { kind: parsed.kind };
    if (parsed.kind === 'list' && typeof parsed.listId === 'string')
      return { kind: 'list', listId: parsed.listId };
    // Restore the mode (month/week/day) but never a stale date — a calendar
    // reopened days later should land on today, not wherever it was left.
    if (parsed.kind === 'calendar' && (parsed.mode === 'month' || parsed.mode === 'week' || parsed.mode === 'day'))
      return { kind: 'calendar', mode: parsed.mode, date: today() };
  } catch {
    /* corrupt or unavailable storage: start at Today */
  }
  return TODAY;
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { data, undoLast, notify } = useStore();
  const { choice, setChoice } = useTheme();
  const { vision, setVision } = useA11y();

  const [view, setView] = useState<View>(readView);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);

  const quickAddRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // Search is transient; only durable views are worth restoring.
  useEffect(() => {
    if (view.kind === 'search') return;
    writePref(VIEW_KEY, JSON.stringify(view));
  }, [view]);

  // Registered from inside the tree so the update prompt can use the toast the
  // rest of the app already uses, instead of inventing a second notification.
  const pwaStarted = useRef(false);
  useEffect(() => {
    if (pwaStarted.current) return;
    pwaStarted.current = true;
    initPwa({
      onUpdate: (reload) =>
        notify('Uma versão nova do Taskmate está pronta.', 'info', {
          label: 'Recarregar',
          run: reload,
        }),
      onReady: () => notify('Pronto para funcionar sem internet.'),
    });
  }, [notify]);

  // Checked on mount, whenever the task list changes, and every minute while
  // the tab stays open — the closest this can get to "at 8h" without a
  // server to wake it up while closed. See lib/notify.ts.
  useEffect(() => {
    const checkReminder = () => {
      if (!Reminder.enabled() || Reminder.permission() !== 'granted') return;
      if (!Reminder.shouldRemindNow()) return;
      const { dueToday, dueTomorrow } = Reminder.dueSoon(data.tasks);
      const text = Reminder.reminderText(dueToday, dueTomorrow);
      if (!text) return;
      Reminder.showReminder(text.title, text.body);
      Reminder.markShownToday();
    };
    checkReminder();
    const timer = window.setInterval(checkReminder, 60_000);
    return () => window.clearInterval(timer);
  }, [data.tasks]);

  const select = useCallback((next: View) => {
    setView(next);
    setDrawerOpen(false);
    if (next.kind !== 'search') setQuery('');
    mainRef.current?.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

      if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && !typing) {
        e.preventDefault();
        undoLast();
        return;
      }

      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
        return;
      }

      // Single-letter accelerators must never fire while the user is writing.
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        quickAddRef.current?.focus();
      } else if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, undoLast]);

  return (
    <div className="app">
      <Sidebar view={view} onSelect={select} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Backdrop only exists while the drawer is open, so it can't swallow clicks. */}
      {drawerOpen && (
        <button
          type="button"
          className="scrim"
          aria-label="Fechar menu"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <main className="main" ref={mainRef} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}>
        <div className="topbar" data-scrolled={scrolled}>
        <div className={`topbar__inner${view.kind === 'calendar' ? ' topbar__inner--wide' : ''}`}>
          <button
            type="button"
            className="btn btn--icon topbar__menu"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
          >
            <Icon name="menu" />
          </button>

          <div className="search">
            <span className="search__icon" aria-hidden="true">
              <Icon name="search" size={14} />
            </span>
            <input
              ref={searchRef}
              className="search__input"
              type="search"
              value={query}
              placeholder="Buscar"
              aria-label="Buscar tarefas"
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                setView(next ? { kind: 'search', query: next } : readView());
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setQuery('');
                  setView(readView());
                  e.currentTarget.blur();
                }
              }}
            />
            {!query && (
              <span className="search__hint" aria-hidden="true">
                <kbd className="kbd">/</kbd>
              </span>
            )}
          </div>

          <span className="topbar__spacer" />

          <SyncPanel />

          <NotificationsPanel />

          <Menu
            label="Tema e acessibilidade"
            triggerContent={<Icon name={choice === 'system' ? 'monitor' : choice === 'dark' ? 'moon' : 'sun'} />}
          >
            {(close) => (
              <>
                <p className="menu__label">Tema</p>
                {(
                  [
                    ['system', 'monitor', 'Seguir o sistema'],
                    ['light', 'sun', 'Claro'],
                    ['dark', 'moon', 'Escuro'],
                  ] as const
                ).map(([value, icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="menu__item"
                    aria-pressed={choice === (value as ThemeChoice)}
                    onClick={() => {
                      setChoice(value as ThemeChoice);
                      close();
                    }}
                  >
                    <Icon name={icon} />
                    {label}
                    {choice === value && <Icon name="check" className="menu__check" />}
                  </button>
                ))}

                <hr className="menu__sep" />

                <p className="menu__label">Acessibilidade</p>
                {(
                  [
                    ['default', 'eye', 'Padrão'],
                    ['low-vision', 'eye', 'Ampliado (baixa visão)'],
                  ] as const
                ).map(([value, icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="menu__item"
                    aria-pressed={vision === (value as VisionChoice)}
                    onClick={() => {
                      setVision(value as VisionChoice);
                      close();
                    }}
                  >
                    <Icon name={icon} />
                    {label}
                    {vision === value && <Icon name="check" className="menu__check" />}
                  </button>
                ))}
                <p className="menu__hint">
                  Aumenta o texto, os alvos de toque e o contorno de foco em todo o app.
                </p>
              </>
            )}
          </Menu>

          <Menu
            label="Atalhos de teclado"
            triggerContent={<Icon name="keyboard" />}
            triggerClassName="btn btn--icon topbar__shortcuts"
            menuClassName="sheet"
          >
            {() => (
              <>
                <p className="menu__label">Atalhos</p>
                <dl className="sheet__list">
                  {[
                    ['N', 'Nova tarefa'],
                    ['/', 'Buscar'],
                    ['Enter', 'Salvar o campo atual'],
                    ['Esc', 'Cancelar / fechar'],
                    ['Alt + ↑ ↓', 'Mover tarefa (na alça)'],
                    ['Ctrl + Z', 'Desfazer exclusão'],
                  ].map(([keys, what]) => (
                    <div className="sheet__item" key={keys}>
                      <dt>{what}</dt>
                      <dd>
                        <kbd className="kbd">{keys}</kbd>
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </Menu>
        </div>
        </div>

        <ContentView view={view} onSelect={select} quickAddRef={quickAddRef} />
      </main>

      <Toasts />
    </div>
  );
}
