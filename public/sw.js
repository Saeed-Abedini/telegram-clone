const STATIC_CACHE = "telegram-static-v4";
const DYNAMIC_CACHE = "telegram-dynamic-v4";
const MAX_DYNAMIC_CACHE_SIZE = 50;

const ASSETS = [self.origin + "/"];

// Limiting dynamic cache size
const limitCacheSize = async (cacheName, maxSize) => {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxSize) {
    await cache.delete(keys[0]);
    limitCacheSize(cacheName, maxSize);
  }
};

// Installing a service worker and caching primary resources
self.addEventListener("install", (event) => {
  console.log("Installing Service Worker...");
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      for (const asset of ASSETS) {
        try {
          await cache.add(asset);
        } catch (error) {
          console.warn("⚠ Failed to cache:", asset, error);
        }
      }
    })()
  );
  self.skipWaiting();
});

// Delete old caches upon activation
self.addEventListener("activate", (event) => {
  console.log("Service Worker Activated, clearing old caches...");
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

// Automatically cache static Next.js files on request
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (
    url.pathname.includes("node_modules") ||
    url.hostname.includes("firestore.googleapis.com")
  ) {
    return;
  }

  // If the request is for a font, image, or animation file, prioritize the cache.
  if (url.pathname.match(/\.(woff2?|ttf|png|jpg|jpeg|gif|svg|json)$/)) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;

        try {
          const response = await fetch(event.request);
          cache.put(event.request, response.clone());
          limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
          return response;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          console.warn("⚠ Failed to fetch:", event.request.url);
          return new Response("", { status: 404 });
        }
      })
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;

        try {
          const response = await fetch(event.request);
          cache.put(event.request, response.clone());
          return response;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          console.warn("⚠ Failed to fetch:", event.request.url);
          return new Response("", { status: 404 });
        }
      })
    );
    return;
  }

  if (url.pathname === "/") {
    event.respondWith(
      caches.match(self.origin + "/").then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
    return;
  }

  // Caching strategy for other requests
  event.respondWith(
    event.request.headers.get("accept")?.includes("text/html")
      ? networkFirst(event.request)
      : cacheFirst(event.request)
  );
});

// Caching strategy
const cacheFirst = async (request) => {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  return (
    cachedResponse || fetch(request).catch(() => cache.match(self.origin + "/"))
  );
};

const networkFirst = async (request) => {
  try {
    const response = await fetch(request);
    if (request.method === "GET") {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
      limitCacheSize(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
    }
    return response;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    console.warn("⚠ Network request failed, serving from cache:", request.url);
    const cache = await caches.open(STATIC_CACHE);
    return cache.match(request) || cache.match(self.origin + "/");
  }
};

// Service Worker Update Management
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
