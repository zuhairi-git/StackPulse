
const BASE = "/StackPulse/";
const PREFIX = "stackpulse-shell-11b2703c0709-";
const CACHE = PREFIX + '1ae474d8ccdd';
const FILES = ["/StackPulse/","/StackPulse/index.html","/StackPulse/icon.svg","/StackPulse/manifest.webmanifest","/StackPulse/icons/icon-192.png","/StackPulse/icons/icon-512.png","/StackPulse/icons/maskable-512.png","/StackPulse/icons/apple-touch-icon.png","/StackPulse/assets/index-dXFTWZHy.css","/StackPulse/assets/index-VintTf1p.js"];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => {
  // Keep the previous shell's immutable assets for navigations that straddle activation.
  const previous = keys.filter(key => key.startsWith(PREFIX) && key !== CACHE);
  return Promise.all(previous.slice(0, -1).map(key => caches.delete(key)));
})));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE) || event.request.headers.has('authorization')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(BASE + 'index.html', { ignoreVary: true })).then(response => response || fetch(event.request)));
  } else if ((FILES.includes(url.pathname) || url.pathname.startsWith(BASE + 'assets/')) && !url.search) {
    // Static shell responses may carry Vary: Origin (including Vite preview).
    // Same-origin module requests send Origin; precache requests do not.
    event.respondWith(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX)).map(key => caches.open(key).then(cache => cache.match(event.request, { ignoreVary: true }))))).then(responses => responses.find(Boolean) || fetch(event.request)));
  }
});