import { registerOptionalAsset, updateAssetTask } from '../world/AssetDiagnostics.js';

function isNativeOrLocalPreview() {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return protocol === 'capacitor:' ||
    protocol === 'file:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]';
}

export function registerOfflineCache() {
  if (!import.meta.env.PROD || !window.isSecureContext || !('serviceWorker' in navigator) || isNativeOrLocalPreview()) {
    return Promise.resolve(null);
  }

  const baseUrl = new URL(import.meta.env.BASE_URL || './', window.location.href);
  const workerUrl = new URL('sw.js', baseUrl);
  const scope = baseUrl.pathname.endsWith('/') ? baseUrl.pathname : baseUrl.pathname + '/';

  const onMessage = (event) => {
    const data = event.data || {};
    if (data.type === 'PZH_PRECACHE_PROGRESS') {
      updateAssetTask('offline-cache', {
        label: 'OFFLINE CACHE',
        loaded: data.loaded,
        total: data.total,
        done: false
      });
    } else if (data.type === 'PZH_PRECACHE_COMPLETE') {
      updateAssetTask('offline-cache', {
        label: 'OFFLINE READY',
        loaded: data.total,
        total: data.total,
        done: true
      });
    } else if (data.type === 'PZH_PRECACHE_ERROR') {
      updateAssetTask('offline-cache', {
        label: 'OFFLINE CACHE FAILED',
        loaded: 0,
        total: 1,
        done: true
      });
      registerOptionalAsset('offline-cache', 'The browser could not finish its optional offline cache: ' + String(data.message || 'unknown error'));
    }
  };

  navigator.serviceWorker.addEventListener('message', onMessage);
  updateAssetTask('offline-cache', {
    label: 'PREPARING OFFLINE CACHE',
    loaded: 0,
    total: 1,
    done: false
  });

  return navigator.serviceWorker.register(workerUrl.href, { scope })
    .then((registration) => {
      if (registration.active) {
        registration.active.postMessage({ type: 'PZH_CHECK_PRECACHE' });
      }
      return registration;
    })
    .catch((error) => {
      updateAssetTask('offline-cache', {
        label: 'OFFLINE CACHE UNAVAILABLE',
        loaded: 1,
        total: 1,
        done: true
      });
      registerOptionalAsset('offline-cache', 'Offline web caching could not be registered: ' + (error.message || String(error)));
      return null;
    });
}
