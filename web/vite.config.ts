import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import wasm from 'vite-plugin-wasm';

/**
 * Vite copies `public/` into `dist/` verbatim, including dot-directories that
 * tooling drops there. One editor hook's cache made it into a deployed build
 * carrying absolute paths from the build machine — nothing dangerous, but not
 * something to publish either, and easy to miss because the build reports
 * nothing about copied files.
 */
function stripDotDirs(): Plugin {
  return {
    name: 'strip-dot-dirs',
    apply: 'build',
    closeBundle() {
      const dist = join(import.meta.dirname, 'dist');
      for (const entry of readdirSync(dist, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.startsWith('.')) continue;
        rmSync(join(dist, entry.name), { recursive: true, force: true });
        this.warn(`removido do build: ${entry.name}/`);
      }
    },
  };
}

export default defineConfig({
  plugins: [
    stripDotDirs(),
    // Automerge's core is WebAssembly imported as an ESM module, which Rollup
    // cannot resolve on its own. The wasm glue also initialises with a top-level
    // await; no transform plugin is needed for that because the es2022 target
    // below supports it natively.
    wasm(),
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate': reloading without asking would throw away
      // whatever the user was typing. The app offers a toast instead.
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Taskmate — controle de tarefas',
        short_name: 'Taskmate',
        description: 'Grupos, listas e atividades. Funciona offline.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        // Matches --bg and --brand in the light theme.
        background_color: '#ffffff',
        theme_color: '#cc7d2a',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // `wasm` is the one that matters and is not in the default list. Without
        // it the app shell caches but Automerge does not, so it opens offline
        // and then fails to read its own document — worse than not working.
        globPatterns: ['**/*.{js,css,html,wasm,svg,png,ico,woff2}'],
        // Automerge's wasm is ~3.5 MB and the default ceiling is 2 MiB, which
        // would silently skip it.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Single-page app: any in-scope navigation resolves to the shell.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // No runtimeCaching on purpose. Drive requests must always hit the
        // network: a cached file listing or a cached document revision would
        // make the sync loop reason about stale state, and sync already has its
        // own freshness check.
      },
      // A service worker in dev shadows Vite's HMR and hides real errors.
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173 },
  preview: { port: 5173 },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // The wasm glue relies on top-level await, which needs a modern target.
    target: 'es2022',
  },
});
