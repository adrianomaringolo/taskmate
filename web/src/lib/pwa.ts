import { registerSW } from 'virtual:pwa-register';

interface Handlers {
  /** A new build is cached and waiting. Calling `reload` activates it. */
  onUpdate: (reload: () => void) => void;
  /** First install finished; the app now opens without a network. */
  onReady: () => void;
}

/**
 * Registers the service worker.
 *
 * This is what turns "works offline while the tab is open" into "opens offline":
 * without it the document itself cannot be fetched, so a reload on a plane fails
 * even though every byte of data is already in IndexedDB.
 *
 * Registration is deliberately *not* awaited and never blocks first paint. The
 * install downloads Automerge's ~3.5 MB wasm, and the app must stay usable while
 * that happens in the background.
 */
export function initPwa({ onUpdate, onReady }: Handlers): void {
  if (!('serviceWorker' in navigator)) return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Never reload on its own: the user may be mid-sentence in a note.
      onUpdate(() => void updateSW(true));
    },
    onOfflineReady() {
      onReady();
    },
    onRegisterError(error) {
      // Not worth a toast. The app works fine unregistered; it just will not
      // open without a network.
      console.warn('Service worker não registrado:', error);
    },
  });
}
