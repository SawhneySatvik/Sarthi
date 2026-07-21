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
 */
const VERSION = "sarthi-sw-v1";
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
