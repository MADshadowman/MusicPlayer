"use strict";

const VERSION = "v13";
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

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "skip-waiting") self.skipWaiting();
  if (event.data && event.data.type === "client-claim-update") self.skipWaiting();
});

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

function parseRange(header) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;
  if (rawStart === "") return { suffix: Number(rawEnd) };
  return { start: Number(rawStart), end: rawEnd === "" ? null : Number(rawEnd) };
}

function resolveRange(range, total) {
  if (!range) return null;
  let start;
  let end;
  if (range.suffix !== undefined) {
    start = Math.max(0, total - range.suffix);
    end = total - 1;
  } else {
    start = range.start;
    end = range.end === null ? total - 1 : Math.min(range.end, total - 1);
  }
  if (start > end) return null;
  return { start, end };
}

function partialResponse(buffer, start, end, total, contentType) {
  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": contentType,
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
    },
  });
}

async function handleAudioRequest(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const range = parseRange(request.headers.get("Range"));
  const cached = await cache.match(request.url, { ignoreVary: true });
  if (cached && cached.ok && cached.status === 200) {
    try {
      const buffer = await cached.clone().arrayBuffer();
      const resolved = resolveRange(range, buffer.byteLength);
      if (!resolved) return cached;
      return partialResponse(buffer, resolved.start, resolved.end, buffer.byteLength, cached.headers.get("Content-Type") || "application/octet-stream");
    } catch {
      return fetch(request);
    }
  }
  let fresh = null;
  try {
    fresh = await fetch(request.url);
  } catch {
    fresh = null;
  }
  if (fresh && fresh.ok && fresh.status === 200) {
    try {
      const buffer = await fresh.clone().arrayBuffer();
      const resolved = resolveRange(range, buffer.byteLength);
      if (new URL(request.url).origin === self.location.origin) {
        // trim before adding keeps the cache bounded
        await trimCache(AUDIO_CACHE, MAX_AUDIO_ENTRIES - 1);
        await cache.put(request.url, fresh.clone());
      }
      if (!resolved) return fresh;
      return partialResponse(buffer, resolved.start, resolved.end, buffer.byteLength, fresh.headers.get("Content-Type") || "application/octet-stream");
    } catch {
      return fetch(request);
    }
  }
  try {
    return await fetch(request);
  } catch {
    return new Response("", { status: 504, statusText: "Offline" });
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
    event.respondWith(handleAudioRequest(request));
    return;
  }

  // CDN assets (fonts, butterchurn): stale-while-revalidate so they survive offline
  if (isCdnAsset(url) && url.origin !== self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // app shell (navigations/HTML): stale-while-revalidate so the cached shell
  // paints instantly offline; the network refresh runs in the background so
  // updates land on the next load. May briefly run a stale shell after an
  // update, which is accepted because app.js is version-busted via ?v=.
  if (request.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html")) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }
  // remaining same-origin assets (js/css/manifest/icons): network-first so
  // code updates land immediately
  event.respondWith(networkFirst(request, SHELL_CACHE));
});
