// Service worker : rend l'app utilisable hors ligne et installable.
//
// - Fichiers de l'app (HTML, CSS, JS) : réseau d'abord, cache en secours.
//   Une mise à jour publiée est donc vue dès le chargement suivant, sans vider le cache à la main.
// - Données (data/*.json) : cache d'abord, rafraîchi en arrière-plan.
// - Images (sprites de PokéAPI sur GitHub) : cache d'abord, gardées une fois vues.
// - PokéAPI (secours si un fichier local manque) : jamais mis en cache.
//
// Changer CACHE_VERSION supprime les anciens caches à la prochaine visite.

const CACHE_VERSION = 'v1';
const APP_CACHE = `app-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;

const APP_FILES = [
    './',
    'index.html',
    'style.css',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'vendor/chart.umd.js',
    'js/dom.js', 'js/state.js', 'js/utils.js', 'js/generation.js', 'js/theme.js', 'js/tabs.js',
    'js/game-loader.js', 'js/locations.js', 'js/pokedex.js', 'js/team.js', 'js/generator.js',
    'js/calculator.js', 'js/team-analysis.js', 'js/evolutions.js', 'js/stats.js',
    'js/specificities.js', 'js/main.js',
    'data/types.json', 'data/names.json', 'data/past.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(APP_CACHE)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    const keep = new Set([APP_CACHE, DATA_CACHE, IMAGE_CACHE]);
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => !keep.has(k)).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

async function networkFirst(request) {
    const cache = await caches.open(APP_CACHE);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (e) {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        throw e;
    }
}

async function cacheFirstThenRefresh(request) {
    const cache = await caches.open(DATA_CACHE);
    const cached = await cache.match(request) || await caches.match(request);
    const refresh = fetch(request)
        .then(response => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => null);
    return cached || (await refresh) || Response.error();
}

async function cacheFirst(request) {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    // Les images d'un autre site arrivent "opaques" (status 0) : on les garde quand même
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
    return response;
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (url.origin === self.location.origin) {
        event.respondWith(url.pathname.includes('/data/') ? cacheFirstThenRefresh(request) : networkFirst(request));
    } else if (url.hostname === 'raw.githubusercontent.com') {
        event.respondWith(cacheFirst(request));
    }
    // Le reste (PokéAPI…) passe par le réseau normalement
});
