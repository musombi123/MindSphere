import { open, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const manifestPath = path.join(publicRoot, 'assets', 'animations', 'manifest.json');
const catalogPath = path.join(publicRoot, 'assets', 'asset-catalog.json');
const failures = [];
const warnings = [];
const stats = { animations: 0, worldModels: 0, weaponModels: 0, playerModel: false };

function fail(message) { failures.push(message); }
function warn(message) { warnings.push(message); }

async function readJson(file, label) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    fail(label + ' is missing or invalid JSON: ' + error.message);
    return null;
  }
}

function localAssetPath(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(label + ' must be a non-empty local public/ path.');
    return null;
  }
  const clean = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (/^(https?:|data:|blob:)/i.test(clean) || clean.split('/').includes('..') || clean.includes('?') || clean.includes('#')) {
    fail(label + ' must be a safe local path without URL schemes, traversal, query or fragment: ' + value);
    return null;
  }
  const absolute = path.resolve(publicRoot, clean);
  const relative = path.relative(publicRoot, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    fail(label + ' resolves outside public/: ' + value);
    return null;
  }
  return absolute;
}

async function verifyFile(file, label, acceptedExtensions = []) {
  if (!file) return false;
  try {
    const fileStat = await stat(file);
    if (!fileStat.isFile() || fileStat.size < 1) {
      fail(label + ' is missing or empty (' + fileStat.size + ' bytes).');
      return false;
    }
    const prefixBuffer = Buffer.alloc(100);
    const prefixHandle = await open(file, 'r');
    try { await prefixHandle.read(prefixBuffer, 0, prefixBuffer.length, 0); }
    finally { await prefixHandle.close(); }
    const prefix = prefixBuffer.toString('utf8');
    if (prefix.startsWith('version https://git-lfs.github.com/spec/v1')) {
      fail(label + ' is still a Git LFS pointer. Run a targeted git lfs pull for this runtime path.');
      return false;
    }
    if (acceptedExtensions.length && !acceptedExtensions.includes(path.extname(file).toLowerCase())) {
      fail(label + ' has an unsupported extension: ' + path.extname(file));
      return false;
    }
    if (path.extname(file).toLowerCase() === '.glb') {
      const header = Buffer.alloc(12);
      const handle = await open(file, 'r');
      try { await handle.read(header, 0, 12, 0); } finally { await handle.close(); }
      if (header.toString('ascii', 0, 4) !== 'glTF' || header.readUInt32LE(4) !== 2) {
        fail(label + ' is not a valid glTF binary (GLB v2) file.');
        return false;
      }
    }
    if (path.extname(file).toLowerCase() === '.gltf') {
      const gltf = await readJson(file, label);
      if (!gltf) return false;
      const dependencies = [
        ...(gltf.buffers || []).map(item => item.uri),
        ...(gltf.images || []).map(item => item.uri)
      ].filter(uri => uri && !uri.startsWith('data:'));
      for (const uri of dependencies) {
        if (/^(https?:|blob:)/i.test(uri) || uri.split('/').includes('..')) {
          fail(label + ' has a non-local or unsafe external dependency: ' + uri);
          continue;
        }
        const dependencyPath = path.resolve(path.dirname(file), decodeURIComponent(uri));
        const relative = path.relative(publicRoot, dependencyPath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
          fail(label + ' dependency resolves outside public/: ' + uri);
          continue;
        }
        await verifyFile(dependencyPath, label + ' dependency ' + uri);
      }
    }
    return true;
  } catch (error) {
    fail(label + ' could not be checked: ' + error.message);
    return false;
  }
}

const [manifest, catalog] = await Promise.all([
  readJson(manifestPath, 'Animation manifest'),
  readJson(catalogPath, 'Asset catalog')
]);

if (manifest) {
  if (!manifest.clips || typeof manifest.clips !== 'object' || Array.isArray(manifest.clips)) {
    fail('Animation manifest must contain a clips object.');
  } else {
    const clipEntries = Object.entries(manifest.clips);
    if (clipEntries.length < 30) fail('Expected at least 30 staged FBX clips; found ' + clipEntries.length + '. Run npm run assets:prepare.');
    for (const [key, value] of clipEntries) {
      const definition = typeof value === 'string' ? { file: value } : value;
      const rawAnimationPath = String(definition?.file || '');
      const animationPath = rawAnimationPath.startsWith('/')
        ? rawAnimationPath
        : path.posix.join('assets/animations', rawAnimationPath);
      const file = localAssetPath(animationPath, 'Animation ' + key);
      if (!file) continue;
      const format = definition?.format === 'fbx' ? ['.fbx'] : ['.glb', '.gltf', '.fbx'];
      if (await verifyFile(file, 'Animation ' + key, format)) stats.animations++;
    }
  }
}

if (catalog) {
  const playerFile = catalog.character?.playerModel;
  if (typeof playerFile === 'string' && playerFile.trim()) {
    const file = localAssetPath(playerFile, 'Player model');
    stats.playerModel = Boolean(file && await verifyFile(file, 'Player model', ['.glb', '.gltf', '.fbx']));
  } else {
    warn('No player rig is mapped yet. The game will keep its development proxy until a verified skinned GLB/FBX is imported.');
  }

  for (const [category, allowedExtensions] of [
    ['worldModels', ['.glb', '.gltf']],
    ['weaponModels', ['.glb', '.gltf']]
  ]) {
    const entries = catalog[category] && typeof catalog[category] === 'object' ? Object.entries(catalog[category]) : [];
    for (const [key, value] of entries) {
      const definition = typeof value === 'string' ? { file: value } : value;
      const file = localAssetPath(definition?.file, category + '.' + key);
      if (file && await verifyFile(file, category + '.' + key, allowedExtensions)) stats[category]++;
    }
    if (!entries.length) warn('No ' + category + ' have been mapped yet; F3 will report these runtime assets as missing.');
  }
}

console.log('[Project Zero Hour] Runtime asset validation summary');
console.log('  Animation clips: ' + stats.animations);
console.log('  Player rig: ' + (stats.playerModel ? 'mapped' : 'not yet mapped'));
console.log('  World GLB/GLTF models: ' + stats.worldModels);
console.log('  Weapon GLB/GLTF models: ' + stats.weaponModels);
for (const message of warnings) console.warn('  ! ' + message);
for (const message of failures) console.error('  ✗ ' + message);
if (failures.length) {
  console.error('[Project Zero Hour] Asset validation failed with ' + failures.length + ' issue(s).');
  process.exitCode = 1;
} else {
  console.log('[Project Zero Hour] Asset validation passed.');
}
