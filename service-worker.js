"use strict";

const VERSION = "v4";
const SHELL_CACHE = `mp-shell-${VERSION}`;
const RUNTIME_CACHE = `mp-runtime-${VERSION}`;
const AUDIO_CACHE = `mp-audio-${VERSION}`;
const MAX_AUDIO_ENTRIES = 60;

const SHELL_PRECACHE = [
  "./",
  "./index.html",
  "./app.js",
  "./metadata-reader.js",
  "./styles.css",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        SHELL_PRECACHE.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "no-cache" }));
          } catch {
            // partial installs still work
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, RUNTIME_CACHE, AUDIO_CACHE]);
      for (const name of await caches.keys()) {
        if (!keep.has(name)) await caches.delete(name);
      }
      await self.clients.claim();
    })()
  );
});

function isAudioRequest(url) {
  return /\.(mp3|m4a|aac|flac|ogg|oga|opus|wav|weba|m4b)$/i.test(url.pathname);
}

function isCdnAsset(url) {
  const hosts = [
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "cdn.jsdelivr.net",
    "unpkg.com",
  ];
  return hosts.includes(url.hostname);
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  for (const key of keys.slice(0, keys.length - max)) {
    await cache.delete(key);
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline and not cached");
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  if (cached) {
    fetchPromise.catch(() => {});
    return cached;
  }
  const response = await fetchPromise;
  if (!response) throw new Error("offline and not cached");
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.includes("tracks.json") && !url.href.startsWith(self.location.origin)) {
    // external manifests: let the app decide
    return;
  }

  // audio files: cache-first so previously played tracks work offline
  if (isAudioRequest(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(AUDIO_CACHE);
        const cached = await cache.match(request, { ignoreVary: true });
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response && response.ok && response.status === 200) {
            // trim before adding keeps the cache bounded
            await trimCache(AUDIO_CACHE, MAX_AUDIO_ENTRIES - 1);
            cache.put(request, response.clone()).catch(() => {});
            return response;
          }
          return response;
        } catch {
          return new Response("", { status: 504, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  // CDN assets (fonts, butterchurn): stale-while-revalidate so they survive offline
  if (isCdnAsset(url) && url.origin !== self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // app shell & local assets: network-first so code updates land immediately;
  // the precache only serves as an offline fallback
  if (request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }
  event.respondWith(networkFirst(request, SHELL_CACHE));
});
