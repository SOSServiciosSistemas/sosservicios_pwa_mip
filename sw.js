const CACHE_NAME = 'sos-servicios-v9';

// Archivos estáticos principales que queremos que funcionen sin conexión (Offline)
const urlsToCache = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './config.js',
  './img/logo-SOS-Plagas.webp',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css'
];

// Evento Install: se ejecuta la primera vez que el Service Worker se instala
self.addEventListener('install', event => {
  // Forzar a que el nuevo Service Worker se active inmediatamente
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Archivos en caché guardados');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento Activate: se ejecuta cuando el Service Worker toma el control
self.addEventListener('activate', event => {
  // Reclamar el control de los clientes de inmediato
  event.waitUntil(self.clients.claim());

  // Limpiar cachés antiguas que no coincidan con el CACHE_NAME actual
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Borrando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Evento Fetch: Estrategia de Red Primero (Network First), con respaldo en caché
self.addEventListener('fetch', event => {
  // Ignorar peticiones que no son GET (como POST del login o datos de API)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Validar que la respuesta sea válida antes de guardarla en la caché
        // (que no sea un error y que sea una petición propia, no opaca)
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clonar la respuesta porque se va a usar dos veces (una para el navegador y otra para la caché)
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Si falla la red (sin internet), buscamos el archivo en la caché
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si es una petición de página HTML y no está en caché, mostramos offline.html
          if (event.request.mode === 'navigate') {
            return caches.match('./offline.html');
          }
        });
      })
  );
});
