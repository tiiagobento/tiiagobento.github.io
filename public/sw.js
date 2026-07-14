const CACHE_VERSION = "nova-forma-crm-v2";
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  "/offline.html",
  "/icons/nova-forma-icon.svg",
  "/icons/nova-forma-icon-192.png",
  "/icons/nova-forma-icon-512.png",
  "/manifest.webmanifest",
];

const NETWORK_ONLY_PATTERNS = [
  "/api/ai/",
  "/auth/",
  "supabase.co",
  "puter.com",
  "js.puter.com",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" })))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("nova-forma-crm-") && !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function shouldUseNetworkOnly(request) {
  const url = new URL(request.url);
  if (request.method !== "GET") return true;
  return NETWORK_ONLY_PATTERNS.some((pattern) => request.url.includes(pattern) || url.pathname.startsWith(pattern));
}

function isPrivateAppRoute(pathname) {
  return ["/dashboard", "/leads", "/pipeline", "/tasks", "/templates", "/settings", "/partner", "/import-export"].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || (await caches.match("/offline.html"));
}

async function navigateWithOfflineFallback(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  try {
    const response = await fetch(request);
    const url = new URL(request.url);
    if (response.ok && url.origin === self.location.origin && isPrivateAppRoute(url.pathname)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || (await caches.match("/offline.html"));
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_PRIVATE_CACHE") {
    event.waitUntil(caches.delete(RUNTIME_CACHE));
    return;
  }

  if (event.data?.type === "WARM_PRIVATE_ROUTES") {
    const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
    event.waitUntil(
      Promise.allSettled(
        urls.map(async (url) => {
          const request = new Request(url, { credentials: "same-origin" });
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, response.clone());
          }
        }),
      ),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (shouldUseNetworkOnly(request)) {
    return;
  }

  if (url.origin === self.location.origin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(navigateWithOfflineFallback(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
