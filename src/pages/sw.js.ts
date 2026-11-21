export const prerender = true;

const worker = (version: string) => `
const VERSION = ${JSON.stringify(version)};
const ASSETS = "assets-v1";
const PAGES = "pages-" + VERSION;
const IMMUTABLE = /^\\/(_astro|media|wallpaper)\\//;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== ASSETS && k !== PAGES).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "cache" && Array.isArray(event.data.urls)) {
    event.waitUntil(Promise.all(event.data.urls.map(url => {
      const name = IMMUTABLE.test(url) ? ASSETS : PAGES;
      return caches.open(name).then(cache => cache.match(url).then(hit => hit || cache.add(url))).catch(() => {});
    })));
  }
});

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request)) || (await cache.match("/")) || Response.error();
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;
  if (IMMUTABLE.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSETS));
  } else if (url.pathname.startsWith("/fonts/")) {
    event.respondWith(cacheFirst(request, PAGES));
  } else if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(networkFirst(request));
  }
});
`;

export function GET() {
  return new Response(worker(__BUILD_ID__), {
    headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache" },
  });
}
