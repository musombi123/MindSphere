import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const CACHE_PREFIX = 'project-zero-hour-runtime-';
const scope = 'https://example.test/MindSphere/';
const buildId = 'phase1-test-build';
const manifest = {
  schemaVersion: 1,
  buildId,
  totalFiles: 2,
  files: ['index.html', 'assets/game.js']
};

class MemoryCache {
  constructor() {
    this.entries = new Map();
  }

  async put(key, response) {
    const url = new URL(key instanceof Request ? key.url : String(key), scope).href;
    this.entries.set(url, response.clone());
  }

  async match(key) {
    const url = new URL(key instanceof Request ? key.url : String(key), scope).href;
    const response = this.entries.get(url);
    return response ? response.clone() : undefined;
  }
}

class MemoryCacheStorage {
  constructor() {
    this.caches = new Map();
  }

  async open(name) {
    if (!this.caches.has(name)) this.caches.set(name, new MemoryCache());
    return this.caches.get(name);
  }

  async keys() {
    return [...this.caches.keys()];
  }

  async delete(name) {
    return this.caches.delete(name);
  }

  async match(request, options) {
    for (const cache of this.caches.values()) {
      const response = await cache.match(request, options);
      if (response) return response;
    }
    return undefined;
  }
}

const cacheStorage = new MemoryCacheStorage();
const oldCache = await cacheStorage.open(CACHE_PREFIX + 'old-build');
await oldCache.put(new URL('index.html', scope).href, new Response('OLD BUILD'));

let offline = false;
const messages = [];

function createWorker() {
  const listeners = new Map();
  const self = {
    location: new URL(scope + 'sw.js'),
    registration: { scope },
    clients: {
      matchAll: async () => [{ postMessage: (message) => messages.push(message) }],
      claim: async () => {}
    },
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    skipWaiting: async () => {}
  };

  const fetcher = async (input) => {
    if (offline) throw new Error('simulated offline mode');
    const url = new URL(input instanceof Request ? input.url : String(input), scope);
    if (url.href === new URL('precache-manifest.json', scope).href) {
      return new Response(JSON.stringify(manifest), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url.href === new URL('index.html', scope).href) {
      return new Response('<main>Project Zero Hour offline shell</main>');
    }
    if (url.href === new URL('assets/game.js', scope).href) {
      return new Response('window.gameReady = true;');
    }
    return new Response('not found', { status: 404 });
  };

  vm.runInNewContext(source, {
    self,
    caches: cacheStorage,
    fetch: fetcher,
    URL,
    Response,
    Request,
    Promise,
    console
  }, { filename: 'public/sw.js' });

  return listeners;
}

async function dispatchWithWaitUntil(listener, event = {}) {
  const pending = [];
  event.waitUntil = (promise) => pending.push(Promise.resolve(promise));
  listener(event);
  await Promise.all(pending);
}

const installWorker = createWorker();
await dispatchWithWaitUntil(installWorker.get('install'));

const expectedBuildCache = CACHE_PREFIX + buildId;
assert.ok((await cacheStorage.keys()).includes(expectedBuildCache), 'install should create the build cache');
assert.ok((await cacheStorage.keys()).includes(CACHE_PREFIX + 'meta'), 'install should persist its active-build pointer');

// A browser may terminate the installing worker before activate; use a fresh JS global.
const restartedWorker = createWorker();
await dispatchWithWaitUntil(restartedWorker.get('activate'));
const cacheNamesAfterActivation = await cacheStorage.keys();
assert.ok(cacheNamesAfterActivation.includes(expectedBuildCache), 'activation must preserve the cache recorded by the persisted build pointer');
assert.ok(cacheNamesAfterActivation.includes(CACHE_PREFIX + 'meta'), 'activation must preserve the metadata pointer cache');
assert.ok(!cacheNamesAfterActivation.includes(CACHE_PREFIX + 'old-build'), 'activation must remove stale build caches');

offline = true;
let navigationResponse;
restartedWorker.get('fetch')({
  request: new Request(new URL('story/deep-link', scope), { mode: 'navigate' }),
  respondWith(promise) {
    navigationResponse = Promise.resolve(promise);
  }
});
assert.ok(navigationResponse, 'fetch handler should respond to navigation requests');
const offlineResponse = await navigationResponse;
assert.equal(offlineResponse.status, 200);
assert.match(await offlineResponse.text(), /Project Zero Hour offline shell/);

console.log('[Project Zero Hour] Service-worker regression passed: restart-safe cache retention and offline navigation fallback.');
