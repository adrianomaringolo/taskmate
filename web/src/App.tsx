import { useCallback, useEffect, useRef, useState } from 'react';
import { About } from './components/About';
import { ContentView } from './components/ContentView';
import { Icon } from './components/Icon';
import { Menu } from './components/Menu';
import { Preferences } from './components/Preferences';
import { Sidebar } from './components/Sidebar';
import { SyncPanel } from './components/SyncPanel';
import { Toasts } from './components/Toasts';
import { Welcome } from './components/Welcome';
import { today } from './lib/date';
import * as Reminder from './lib/notify';
import { readPref, writePref } from './lib/prefs';
import { initPwa } from './lib/pwa';
import { StoreProvider, useStore } from './lib/store';
import type { View } from './lib/types';
import { useA11y } from './lib/useA11y';
import { useTheme } from './lib/useTheme';
import { readWeekStart, setWeekStart, type WeekStart } from './lib/weekstart';

const VIEW_KEY = 'view';
const ONBOARDING_KEY = 'onboardingSeen';
const SIDEBAR_KEY = 'sidebarCollapsed';
const BOARD_FULL_KEY = 'boardFull';

const TODAY: View = { kind: 'today' };

function readView(): View {
  try {
    const raw = readPref(VIEW_KEY);
    if (!raw) return TODAY;

    const parsed = JSON.parse(raw) as { kind?: unknown; listId?: unknown; mode?: unknown };
    if (
      parsed.kind === 'today' ||
      parsed.kind === 'upcoming' ||
      parsed.kind === 'review' ||
      parsed.kind === 'trash'
    )
      return { kind: parsed.kind };
    if (parsed.kind === 'list' && typeof parsed.listId === 'string')
      return { kind: 'list', listId: parsed.listId };
    if (parsed.kind === 'board' && typeof (parsed as { groupId?: unknown }).groupId === 'string')
      return { kind: 'board', groupId: (parsed as { groupId: string }).groupId };
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
  const { data, status, addTask, undoLast, notify } = useStore();
  const { choice, setChoice } = useTheme();
  const { vision, setVision } = useA11y();
  const [weekStart, setWeekStartState] = useState<WeekStart>(readWeekStart);

  const [view, setView] = useState<View>(readView);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  // Read lazily, once: a value computed at module load would be stale by the
  // time this component first renders on a slow connection.
  const [welcomeOpen, setWelcomeOpen] = useState(() => readPref(ONBOARDING_KEY) !== '1');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  // Desktop only: the drawer (`drawerOpen`) still drives the phone layout. The
  // two never fight — a media query decides which one is visually in effect.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readPref(SIDEBAR_KEY) === '1');
  const [boardFull, setBoardFull] = useState(() => readPref(BOARD_FULL_KEY) === '1');

  const showSidebar = useCallback(() => {
    setDrawerOpen(true);
    setSidebarCollapsed(false);
    writePref(SIDEBAR_KEY, '0');
  }, []);

  const collapseSidebar = useCallback(() => {
    setDrawerOpen(false);
    setSidebarCollapsed(true);
    writePref(SIDEBAR_KEY, '1');
  }, []);

  const toggleBoardFull = useCallback(() => {
    setBoardFull((full) => {
      const next = !full;
      writePref(BOARD_FULL_KEY, next ? '1' : '0');
      return next;
    });
  }, []);

  const changeWeekStart = useCallback((value: WeekStart) => {
    setWeekStart(value);
    setWeekStartState(value);
  }, []);

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

  // Android share sheet: the PWA is registered as a share target in the
  // manifest, which hands us the shared text as query params on `/`. Drop it
  // into the inbox, land on the inbox so the capture is visible, then scrub the
  // URL so a reload does not re-add it.
  const sharedHandled = useRef(false);
  useEffect(() => {
    if (sharedHandled.current || status !== 'ready') return;
    const params = new URLSearchParams(location.search);
    const shared = [params.get('title'), params.get('text'), params.get('url')]
      .map((v) => v?.trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    if (!shared) return;

    sharedHandled.current = true;
    history.replaceState(null, '', location.pathname);
    const inbox = data.lists.find((l) => l.isInbox);
    if (!inbox) return;
    void addTask(inbox.id, shared.slice(0, 300));
    select({ kind: 'list', listId: inbox.id });
    notify('Adicionado na Entrada.');
  }, [status, data.lists, addTask, notify, select]);

  // Marking "seen" on close, not on open, means reloading mid-tour on a
  // first visit shows it again instead of losing it to a half-read state.
  const closeWelcome = useCallback(() => {
    setWelcomeOpen(false);
    writePref(ONBOARDING_KEY, '1');
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

  const boardIsFull = view.kind === 'board' && boardFull;

  return (
    <div className="app" data-sidebar-collapsed={sidebarCollapsed}>
      <Sidebar
        view={view}
        onSelect={select}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCollapse={collapseSidebar}
        onOpenWelcome={() => setWelcomeOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
      />

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
        <div
          className={`topbar__inner${
            view.kind === 'calendar' || view.kind === 'board' ? ' topbar__inner--wide' : ''
          }${boardIsFull ? ' topbar__inner--full' : ''}`}
        >
          <button
            type="button"
            className="btn btn--icon topbar__menu"
            onClick={showSidebar}
            aria-label="Mostrar a barra lateral"
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

          <button
            type="button"
            className="btn btn--icon"
            aria-label="Preferências"
            onClick={() => setPrefsOpen(true)}
          >
            <Icon name="settings" />
          </button>

          <Menu
            label="Atalhos e captura"
            triggerContent={<Icon name="keyboard" />}
            triggerClassName="btn btn--icon topbar__shortcuts"
            menuClassName="sheet sheet--help"
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

                <hr className="menu__sep" />

                <p className="menu__label">Na captura</p>
                <p className="sheet__body">
                  Escreva prazo, prioridade e repetição no próprio texto — a palavra fica destacada
                  quando é reconhecida. O que o app não entende continua no título.
                </p>
                <dl className="sheet__list sheet__list--tokens">
                  {[
                    ['hoje', 'prazo para hoje'],
                    ['amanhã', 'prazo para amanhã'],
                    ['seg … dom', 'próxima ocorrência do dia'],
                    ['12/03', 'data específica'],
                    ['+3', 'daqui a 3 dias'],
                    ['!alta !media !baixa', 'prioridade'],
                    ['diária semanal mensal', 'repetição'],
                  ].map(([token, what]) => (
                    <div className="sheet__item" key={token}>
                      <dt>
                        <code className="sheet__token">{token}</code>
                      </dt>
                      <dd>{what}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </Menu>
        </div>
        </div>

        <ContentView
          view={view}
          onSelect={select}
          quickAddRef={quickAddRef}
          weekStartKey={weekStart}
          boardFull={boardFull}
          onToggleBoardFull={toggleBoardFull}
        />
      </main>

      <Toasts />
      <Welcome open={welcomeOpen} onClose={closeWelcome} />
      <About open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <Preferences
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        data={data}
        theme={choice}
        onTheme={setChoice}
        vision={vision}
        onVision={setVision}
        weekStart={weekStart}
        onWeekStart={changeWeekStart}
      />
    </div>
  );
}
