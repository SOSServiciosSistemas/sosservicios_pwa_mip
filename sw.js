const CACHE_NAME = 'sos-servicios-v1';

// Archivos estáticos principales que queremos que funcionen sin conexión (Offline)
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './config.js',
  './img/logo-SOS-Plagas.webp',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css'
];

// Evento Install: se ejecuta la primera vez que el Service Worker se instala
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Archivos en caché guardados');
        return cache.addAll(urlsToCache);
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
        // Si hay internet y la petición es exitosa, actualizamos la caché de forma dinámica
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, response.clone());
          return response;
        });
      })
      .catch(() => {
        // Si falla la red (sin internet), buscamos el archivo en la caché
        return caches.match(event.request);
      })
  );
});
