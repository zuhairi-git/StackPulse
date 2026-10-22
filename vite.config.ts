import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';

// Precache only the built, same-origin shell. No runtime API cache or credentials.
export function appShell(): Plugin {
  let base = '/';
  return {
    name: 'stackpulse-offline-shell',
    configResolved(config) { base = config.base; },
    generateBundle(_, bundle) {
      const files = ['', 'index.html', 'icon.svg', 'manifest.webmanifest',
        'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
        ...Object.keys(bundle).filter(name => !name.endsWith('.map'))].map(name => base + name);
      const version = createHash('sha256').update(base + JSON.stringify(Object.values(bundle))).digest('hex').slice(0, 12);
      const namespace = 'stackpulse-shell-' + createHash('sha256').update(base).digest('hex').slice(0, 12) + '-';
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: `
const BASE = ${JSON.stringify(base)};
const PREFIX = ${JSON.stringify(namespace)};
const CACHE = PREFIX + '${version}';
const FILES = ${JSON.stringify([...new Set(files)])};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => {
  // Keep the previous shell's immutable assets for navigations that straddle activation.
  const previous = keys.filter(key => key.startsWith(PREFIX) && key !== CACHE);
  return Promise.all(previous.slice(0, -1).map(key => caches.delete(key)));
})));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE) || event.request.headers.has('authorization')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(BASE + 'index.html', { ignoreVary: true })).then(response => response || fetch(event.request)));
  } else if ((FILES.includes(url.pathname) || url.pathname.startsWith(BASE + 'assets/')) && !url.search) {
    // Static shell responses may carry Vary: Origin (including Vite preview).
    // Same-origin module requests send Origin; precache requests do not.
    event.respondWith(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX)).map(key => caches.open(key).then(cache => cache.match(event.request, { ignoreVary: true }))))).then(responses => responses.find(Boolean) || fetch(event.request)));
  }
});` });
    },
  };
}

export default defineConfig({ server: { proxy: { '/api': 'http://127.0.0.1:3001' } }, plugins: [react(), appShell(), {
  name: 'stackpulse-dev-csp',
  // Vite injects an inline React refresh preamble in development only.
  transformIndexHtml(html, context) {
    return context.server ? html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*\/>/, '') : html;
  },
}], build: { target: 'es2022' } });
