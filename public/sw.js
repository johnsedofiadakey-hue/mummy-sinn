// Bump the version whenever the caching strategy changes; old caches are deleted on activate.
const CACHE = "mummys-inn-v2";
const SHELL = ["/", "/menu", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener("activate", (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
));

const store = (request, response) => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); } return response; };

self.addEventListener("fetch", (event) => {
  const { request } = event; const url = new URL(request.url);
  // Never touch writes, other origins (Paystack, Firebase, images CDN) or API routes.
  if (request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // Pages and RSC payloads: network-first so menus, prices, slots and order status are fresh when online.
  if (request.mode === "navigate" || request.headers.get("RSC") || url.searchParams.has("_rsc")) {
    event.respondWith(fetch(request).then((response) => store(request, response)).catch(() =>
      caches.match(request).then((hit) => hit || (request.mode === "navigate" ? caches.match("/") : Response.error()))));
    return;
  }

  // Hashed build assets are immutable: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((response) => store(request, response))));
    return;
  }

  // Everything else (optimised images, icons): stale-while-revalidate.
  event.respondWith(caches.match(request).then((hit) => {
    const network = fetch(request).then((response) => store(request, response)).catch(() => hit || Response.error());
    return hit || network;
  }));
});
