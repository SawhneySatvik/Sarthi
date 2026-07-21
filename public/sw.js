/*
 * public/sw.js — conservative offline app-shell service worker.
 *
 * STABILITY-FIRST (submission guardrail): navigations are NETWORK-FIRST, so an online
 * visitor ALWAYS gets fresh HTML — a bad/stale cache can never trap them on an old
 * deploy. Only when the network fails do we serve the cached offline page. Hashed
 * static assets (/_next/static, /art) are cache-first (they are immutable). Caches are
 * versioned and old ones are purged on activate.
 *
 * This SW is registered ONLY when NEXT_PUBLIC_ENABLE_SW === "1" (see the registration
 * component), which is left UNSET on the production demo — so prod stays SW-free until
 * a deliberate go.
 *
 * PUSH SCAFFOLD (T3): the `push` + `notificationclick` listeners below are wired and
 * production-shaped, but the SERVER SENDER is deliberately deferred — there is no VAPID
 * subscription store and no /api/push endpoint yet (see components/pwa/notifications.ts
 * for the clearly-commented seam). Until that lands, notifications are fired LOCALLY from
 * the page via `registration.showNotification(...)` while a tab is open; the `push` path
 * only comes alive once a backend sender exists.
 */
const VERSION = "sarthi-sw-v2";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first → fresh HTML when online; offline page on failure.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
    );
    return;
  }

  // Immutable hashed static + art: cache-first, then populate.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/art/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
  }
});

/*
 * PUSH (scaffold). Fires when a server pushes a message to a subscribed client. The
 * SERVER SENDER + VAPID subscription store are DEFERRED (see the module header), so in
 * the current build this only runs if a push is delivered by a future backend — it never
 * errors in its absence. Payload is best-effort JSON: { title, body, url, tag }.
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Sarthi";
  const options = {
    body: payload.body || "",
    icon: "/icon-192",
    badge: "/icon-192",
    tag: payload.tag || "sarthi-reminder",
    renotify: false,
    data: { url: payload.url || "/today" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

/*
 * NOTIFICATION CLICK — focus an existing Sarthi tab (navigating it to the target) or open
 * a new one. Works for both server pushes and locally-scheduled notifications.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if (client.url !== target && "navigate" in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    }),
  );
});
