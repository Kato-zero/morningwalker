// Service Worker for Morning Walk Tracker PWA
const CACHE_NAME = 'walk-tracker-v1.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install event
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip Leaflet tiles - always fetch fresh
    if (event.request.url.includes('tile.openstreetmap.org')) {
        event.respondWith(
            fetch(event.request)
                .then(response => response)
                .catch(() => {
                    // Return offline tile placeholder
                    return new Response(
                        '<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg"><rect width="256" height="256" fill="#f0f0f0"/><text x="128" y="128" font-family="Arial" font-size="14" text-anchor="middle" fill="#666">Offline Map</text></svg>',
                        { headers: { 'Content-Type': 'image/svg+xml' } }
                    );
                })
        );
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version if found
                if (response) {
                    return response;
                }
                
                // Otherwise fetch from network
                return fetch(event.request).then(
                    response => {
                        // Check if valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone response for caching
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    }
                ).catch(() => {
                    // For HTML pages, return offline page
                    if (event.request.headers.get('accept').includes('text/html')) {
                        return caches.match('/index.html');
                    }
                    
                    // For CSS/JS, return cached version if exists
                    return caches.match(event.request);
                });
            })
    );
});

// Background sync for walk data (future enhancement)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-walks') {
        event.waitUntil(syncWalks());
    }
});

// Periodic background updates
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-cache') {
        event.waitUntil(updateCache());
    }
});

// Message handling from main app
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'CACHE_WALK_DATA') {
        caches.open(CACHE_NAME).then(cache => {
            cache.put('walk-data', new Response(JSON.stringify(event.data.payload)));
        });
    }
});

// Helper functions
async function syncWalks() {
    // Future: Sync walk data with server
    console.log('Syncing walks...');
}

async function updateCache() {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    for (const request of requests) {
        // Don't update Leaflet tiles
        if (!request.url.includes('tile.openstreetmap.org')) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.put(request, response);
                }
            } catch (error) {
                console.log('Failed to update:', request.url, error);
            }
        }
    }
}
