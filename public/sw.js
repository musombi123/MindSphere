const CACHE_PREFIX = 'project-zero-hour-runtime-';
const META_CACHE_NAME = CACHE_PREFIX + 'meta';
const ACTIVE_BUILD_KEY = 'active-build.json';
let activeCacheName = null;

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) client.postMessage(message);
}

async function installRuntimeCache() {
  const scopeUrl = self.registration.scope;
  const manifestUrl = new URL('precache-manifest.json', scopeUrl);
  const response = await fetch(manifestUrl.href, { cache: 'no-store' });
  if (!response.ok) throw new Error('Precache manifest returned HTTP ' + response.status);

  const manifest = await response.json();
  if (!manifest || !manifest.buildId || !Array.isArray(manifest.files) || !manifest.files.includes('index.html')) {
    throw new Error('Precache manifest is invalid or does not include index.html.');
  }

  const cacheName = CACHE_PREFIX + manifest.buildId;
  const cache = await caches.open(cacheName);
  const files = manifest.files;
  let loaded = 0;
  const concurrency = 4;

  for (let offset = 0; offset < files.length; offset += concurrency) {
    const batch = files.slice(offset, offset + concurrency);
    await Promise.all(batch.map(async (file) => {
      const url = new URL(file, scopeUrl);
      if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(scopeUrl).pathname)) {
        throw new Error('Unsafe precache path rejected: ' + file);
      }
      const asset = await fetch(url.href, { cache: 'reload' });
      if (!asset.ok) throw new Error('Precache request failed (' + asset.status + '): ' + file);
      await cache.put(url.href, asset);
      loaded++;
    }));
    await notifyClients({
      type: 'PZH_PRECACHE_PROGRESS',
      loaded,
      total: files.length,
      buildId: manifest.buildId
    });
  }

  await cache.put(manifestUrl.href, new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/json' }
  }));
  const metaCache = await caches.open(META_CACHE_NAME);
  await metaCache.put(new URL(ACTIVE_BUILD_KEY, scopeUrl).href, new Response(JSON.stringify({ buildId: manifest.buildId }), {
    headers: { 'Content-Type': 'application/json' }
  }));
  await notifyClients({
    type: 'PZH_PRECACHE_COMPLETE',
    loaded: files.length,
    total: files.length,
    buildId: manifest.buildId
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      await installRuntimeCache();
      await self.skipWaiting();
    } catch (error) {
      await notifyClients({ type: 'PZH_PRECACHE_ERROR', message: error.message || String(error) });
      throw error;
    }
  })());
});

async function findInstalledBuildCache() {
  const pointerUrl = new URL(ACTIVE_BUILD_KEY, self.registration.scope).href;
  const metaCache = await caches.open(META_CACHE_NAME);
  const pointer = await metaCache.match(pointerUrl);
  if (!pointer) return null;
  try {
    const state = await pointer.json();
    const cacheName = state && state.buildId ? CACHE_PREFIX + state.buildId : null;
    if (!cacheName) return null;
    const names = await caches.keys();
    return names.includes(cacheName) ? cacheName : null;
  } catch {
    return null;
  }
}

async function getActiveBuildCacheName() {
  if (activeCacheName) return activeCacheName;
  activeCacheName = await findInstalledBuildCache();
  return activeCacheName;
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const currentCacheName = await findInstalledBuildCache();
    activeCacheName = currentCacheName;
    if (currentCacheName) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => {
        if (name.startsWith(CACHE_PREFIX) && name !== currentCacheName && name !== META_CACHE_NAME) return caches.delete(name);
        return Promise.resolve(false);
      }));
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PZH_CHECK_PRECACHE') {
    event.waitUntil((async () => {
      const cachedName = await getActiveBuildCacheName();
      if (cachedName) {
        const cache = await caches.open(cachedName);
        const manifestUrl = new URL('precache-manifest.json', self.registration.scope).href;
        const response = await cache.match(manifestUrl);
        const manifest = response ? await response.json() : null;
        const total = Number(manifest && manifest.totalFiles) || 1;
        await event.source?.postMessage({
          type: 'PZH_PRECACHE_COMPLETE',
          loaded: total,
          total,
          buildId: cachedName.slice(CACHE_PREFIX.length)
        });
      }
    })());
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const current = await getActiveBuildCacheName();
        if (current) {
          const cache = await caches.open(current);
          await cache.put(request, response.clone());
        }
      }
      return response;
    } catch (error) {
      if (request.mode === 'navigate') {
        const fallback = await caches.match(new URL('index.html', self.registration.scope).href);
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
