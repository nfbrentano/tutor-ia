/**
 * TUTORIA - Service Worker Offline-First para PWA Instalável (RF07, CA11)
 * Estratégias:
 * - Network First: páginas HTML (.html / navigate) e base de conhecimento (/conhecimento/*.json).
 * - Cache First: assets versionados e recursos estáticos (/assets/, .vrm, animações, ícones, CSS, JS).
 */

const CACHE_NAME = 'tutoria-pwa-v1';

const RECURSOS_INICIAIS = [
  './',
  './index.html',
  './tutor.html',
  './configuracoes.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './conhecimento/cache.json',
  './conhecimento/indice.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        RECURSOS_INICIAIS.map((url) =>
          fetch(url).then((resp) => {
            if (resp && resp.ok) {
              return cache.put(url, resp);
            }
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

async function estrategiaNetworkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const respostaRede = await fetch(request);
    if (respostaRede && respostaRede.ok) {
      cache.put(request, respostaRede.clone());
    }
    return respostaRede;
  } catch {
    const emCache = await cache.match(request, { ignoreSearch: true });
    if (emCache) return emCache;
    if (request.mode === 'navigate') {
      const fallbackHome = await cache.match('./index.html');
      if (fallbackHome) return fallbackHome;
    }
    return Response.error();
  }
}

async function estrategiaCacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const emCache = await cache.match(request, { ignoreSearch: true });
  if (emCache) return emCache;

  try {
    const respostaRede = await fetch(request);
    if (respostaRede && respostaRede.ok) {
      cache.put(request, respostaRede.clone());
    }
    return respostaRede;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const ehHtmlOuConhecimento =
    req.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html') ||
    url.pathname.includes('/conhecimento/');

  if (ehHtmlOuConhecimento) {
    event.respondWith(estrategiaNetworkFirst(req));
    return;
  }

  event.respondWith(estrategiaCacheFirst(req));
});
