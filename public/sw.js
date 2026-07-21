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
 *
 * STALE-WHILE-REVALIDATE READ CACHE (T10/PL-3): opt-in via the registration URL query
 * `/sw.js?offlineQueue=1`. When ON, GET navigations to already-visited routes are served
 * from cache INSTANTLY, then revalidated in the background (offline reads work; the cache
 * is kept fresh — not cache-first-forever). Writes stay fresh: `router.refresh()` uses an
 * RSC fetch (mode !== "navigate"), so it bypasses this branch entirely and always hits the
 * network. With the flag off (no query), navigations are network-first exactly as T3 shipped.
 */
const VERSION = "sarthi-sw-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = "/offline";
const SWR_ENABLED = self.location.search.indexOf("offlineQueue=1") !== -1;
const REPLAY_TAG = "sarthi-capture-replay";

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

  // Navigations. Flag ON (T10): stale-while-revalidate — cached page instantly, revalidated
  // in the background; offline page as the final fallback. Flag OFF (T3): network-first.
  if (request.mode === "navigate") {
    if (SWR_ENABLED) {
      event.respondWith(staleWhileRevalidate(request));
    } else {
      event.respondWith(
        fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
      );
    }
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
 * Stale-while-revalidate for a page navigation (T10, flag-gated). Serve the cached page
 * immediately when present, ALWAYS kick a background revalidation that refreshes the cache
 * for next time, and fall back to the network (then the offline page) on a cache miss. Only
 * successful, non-redirected responses are cached, so an auth redirect is never pinned.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(PAGES_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok && res.type === "basic" && !res.redirected) {
        cache.put(request, res.clone());
      }
      return res;
    })
    .catch(() => null);
  if (cached) {
    return cached; // instant; `network` continues in the background to revalidate.
  }
  const fresh = await network;
  return fresh || (await caches.match(OFFLINE_URL)) || Response.error();
}

/*
 * Background Sync (T10, progressive enhancement). When the browser regains connectivity it
 * fires this even if the page was closed; we message every open client so the in-page
 * OfflineQueueReplay drains the IndexedDB queue (which holds the BYOK/runtime headers the
 * replay needs). Where Background Sync is unavailable, the page's `online` event is the
 * primary trigger, so no mutation is lost.
 */
self.addEventListener("sync", (event) => {
  if (event.tag !== REPLAY_TAG) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) client.postMessage({ type: "sarthi-replay-queue" });
    }),
  );
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
