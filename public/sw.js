const CACHE_NAME = "doces-da-tati-v1";
const APP_SHELL = [
  "/",
  "/meus-pedidos",
  "/manifest.webmanifest",
  "/logo-doces-da-tati-round.png?v=20260507-2"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match("/")))
  );
});

self.addEventListener("push", event => {
  event.waitUntil(
    fetch("/api/push-latest", { cache: "no-store" })
      .then(response => response.json())
      .catch(() => ({
        title: "Doces da Tati",
        body: "Tem novidade esperando por voce.",
        url: "/",
      }))
      .then(message => self.registration.showNotification(message.title || "Doces da Tati", {
        body: message.body || "Tem novidade esperando por voce.",
        icon: "/logo-doces-da-tati-round.png?v=20260507-2",
        badge: "/logo-doces-da-tati-round.png?v=20260507-2",
        data: {
          url: message.url || "/",
        },
      }))
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(clientList => {
        const existingClient = clientList.find(client => "focus" in client);
        if (existingClient) {
          existingClient.navigate(url);
          return existingClient.focus();
        }

        return clients.openWindow(url);
      })
  );
});
