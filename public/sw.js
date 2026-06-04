const CACHE_NAME = "doces-da-tati-v4";
const APP_SHELL = [
  "/",
  "/meus-pedidos",
  "/manifest.webmanifest",
  "/logo-doces-da-tati-round.png?v=20260507-2"
];

self.addEventListener("install", event => {
  event.waitUntil(
    self.skipWaiting()
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});

self.addEventListener("fetch", event => {
  return;
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
