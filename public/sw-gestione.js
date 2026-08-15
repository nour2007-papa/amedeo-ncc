// Service worker per la PWA "Gestione Amedeo".
// Si occupa SOLO del caricamento della pagina stessa (per un fallback
// offline di base). Tutti gli altri file — CSS, JS, immagini — non
// vengono toccati: li carica il browser nel modo normale. Intercettarli
// tutti (come faceva la versione precedente) rischiava di far fallire un
// file per un problema di rete transitorio invece di lasciare che il
// browser ritentasse da solo.
const CACHE_NAME = 'gestione-amedeo-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Solo la navigazione verso la pagina della PWA: fallback offline se la
  // rete non risponde. Tutte le altre richieste (JS, CSS, immagini, API)
  // passano dritte al browser, senza intercettazione.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('/'))
        )
    );
  }
});
