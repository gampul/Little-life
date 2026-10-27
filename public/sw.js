/* Little Life 서비스 워커 — 루틴 푸시 알림 받기 전용 (캐시는 하지 않음) */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Little Life', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Little Life';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/little-life-logo.png',
      badge: '/little-life-logo.png',
      tag: data.tag || 'little-life',
      renotify: true,
      data: { url: data.url || '/daily' },
    })
  );
});

// 알림을 누르면 열려 있는 앱 창으로 가거나 새로 연다
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/daily', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
