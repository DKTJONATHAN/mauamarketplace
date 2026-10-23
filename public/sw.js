const CACHE = 'maua-market-shell-v6';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './favicon.svg',
  './favicon-96x96.png',
  './apple-touch-icon.png',
  './web-app-manifest-192x192.png',
  './web-app-manifest-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Push payloads are sent by the trusted server, never directly by another user.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : 'You have a new message.' };
  }

  const title = typeof payload.title === 'string' ? payload.title : 'New message · Maua Marketplace';
  const body = typeof payload.body === 'string' ? payload.body : 'You have a new message.';
  const conversationId = typeof payload.conversationId === 'string' ? payload.conversationId : '';
  const url = conversationId ? `/messages/${encodeURIComponent(conversationId)}` : '/messages';

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/web-app-manifest-192x192.png',
    badge: '/favicon-96x96.png',
    tag: conversationId ? `maua-message-${conversationId}` : 'maua-message',
    renotify: true,
    data: { url },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data && event.notification.data.url ? event.notification.data.url : '/messages',
    self.location.origin
  ).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(targetUrl);
        return client.focus();
      }
    }
    return self.clients.openWindow(targetUrl);
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Navigation is network-first so new deployments always provide the current
  // HTML and therefore the current Vite chunk manifest.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Never cache JavaScript, CSS, fonts, or other Vite build assets. This avoids
  // a stale service worker returning an old chunk after a new deployment.
  if (url.pathname.startsWith('/assets/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
