self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'SafeRoute Alert', body: 'Check your safety status' };
  const options = {
    body: data.body || 'A safety alert has been triggered',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'saferoute-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || '/' },
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  event.waitUntil(self.registration.showNotification(data.title || 'SafeRoute Alert', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'view' || !event.action) {
    const url = event.notification.data?.url || '/';
    event.waitUntil(clients.openWindow(url));
  }
});
