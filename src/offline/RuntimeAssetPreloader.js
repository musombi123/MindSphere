import {
  registerMissingAsset,
  resolveMissingAsset,
  updateAssetTask
} from '../world/AssetDiagnostics.js';

const BASE_URL = import.meta.env.BASE_URL || './';
const MANIFEST_PATH = 'assets/asset-manifest.json';

const CRITICAL_ROLES = new Set([
  'asset-catalog',
  'animation-manifest',
  'player-model',
  'world-reference',
  'draco-decoder',
  'basis-transcoder',
  'animation:idle',
  'animation:walk',
  'animation:run',
  'animation:sprint',
  'animation:jump',
  'animation:shoot',
  'animation:reload',
  'animation:aimIdle',
  'animation:strafeLeft',
  'animation:strafeRight',
  'animation:turn'
]);

function publicAssetUrl(path) {
  const base = new URL(BASE_URL, window.location.href);
  return new URL(String(path).replace(/^\/+/, ''), base).href;
}

export async function preloadRuntimeAssets({ concurrency = 3 } = {}) {
  const manifestUrl = publicAssetUrl(MANIFEST_PATH);
  updateAssetTask('runtime-preload', {
    label: 'READING REQUIRED ASSET MANIFEST',
    loaded: 0,
    total: 1
  });

  let manifest;
  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    manifest = await response.json();
    if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.requiredAssets)) {
      throw new Error('The required asset manifest has an unsupported format.');
    }
    resolveMissingAsset(manifestUrl);
  } catch (error) {
    registerMissingAsset(manifestUrl, 'The required asset manifest could not be preloaded: ' + (error.message || String(error)));
    updateAssetTask('runtime-preload', {
      label: 'ASSET MANIFEST FAILED',
      loaded: 1,
      total: 1,
      done: true
    });
    return { loaded: 0, failed: 1, total: 0 };
  }

  const selected = manifest.requiredAssets.filter((entry) =>
    Array.isArray(entry?.roles) && entry.roles.some((role) => CRITICAL_ROLES.has(role))
  );
  if (!selected.length) {
    registerMissingAsset(manifestUrl, 'The asset manifest contained no critical startup assets.');
    updateAssetTask('runtime-preload', {
      label: 'NO STARTUP ASSETS FOUND',
      loaded: 1,
      total: 1,
      done: true
    });
    return { loaded: 0, failed: 1, total: 0 };
  }

  let cursor = 0;
  let loaded = 0;
  let failed = 0;
  const safeConcurrency = Math.max(1, Math.min(4, Number(concurrency) || 3));

  updateAssetTask('runtime-preload', {
    label: 'PRELOADING CRITICAL GAME ASSETS',
    loaded: 0,
    total: selected.length
  });

  const worker = async () => {
    while (cursor < selected.length) {
      const entry = selected[cursor++];
      const assetPath = String(entry.file || '');
      const assetUrl = publicAssetUrl(assetPath);
      try {
        const response = await fetch(assetUrl);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        await response.arrayBuffer();
        loaded++;
        resolveMissingAsset(assetUrl);
      } catch (error) {
        failed++;
        registerMissingAsset(assetUrl, 'Required startup asset failed during preload: ' + (error.message || String(error)));
      } finally {
        updateAssetTask('runtime-preload', {
          label: failed ? 'PRELOADING · ' + failed + ' REQUIRED FILE(S) FAILED' : 'PRELOADING CRITICAL GAME ASSETS',
          loaded: loaded + failed,
          total: selected.length,
          done: loaded + failed >= selected.length
        });
      }
    }
  };

  await Promise.all(Array.from(
    { length: Math.min(safeConcurrency, selected.length) },
    () => worker()
  ));

  return { loaded, failed, total: selected.length };
}
