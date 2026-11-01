import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const catalogPath = path.join(publicRoot, 'assets', 'asset-catalog.json');
const animationManifestPath = path.join(publicRoot, 'assets', 'animations', 'manifest.json');
const outputPath = path.join(publicRoot, 'assets', 'asset-manifest.json');

const expectedWorldModels = [
  'acacia', 'eucalyptus', 'mangoTree', 'figTree', 'mudHouse', 'timberFence',
  'bodaBoda', 'rustedPickup', 'waterTank', 'bridge', 'bananaPlant',
  'maizePatch', 'sugarcanePatch', 'crates', 'tyres', 'firePit', 'stoneWall'
];
const expectedWeaponModels = ['pulseRifle', 'novaCannon', 'arcLance', 'gravityCore'];
const optionalAudio = [
  'assets/world/audio/wind.ogg',
  'assets/world/audio/birds.ogg',
  'assets/world/audio/insects.ogg',
  'assets/world/audio/footsteps_soil.ogg',
  'assets/world/audio/footsteps_grass.ogg'
];
const required = new Map();

function addRequired(assetPath, role) {
  if (typeof assetPath !== 'string' || !assetPath.trim()) {
    throw new Error('An asset path must be a non-empty string.');
  }
  const clean = assetPath.trim().replace(/\\/g, '/');
  if (
    clean.startsWith('/') ||
    /^(https?:|data:|blob:)/i.test(clean) ||
    clean.split('/').includes('..') ||
    clean.includes('?') ||
    clean.includes('#')
  ) {
    throw new Error('Unsafe or non-relative runtime asset path: ' + assetPath);
  }
  const absolute = path.resolve(publicRoot, clean);
  const relative = path.relative(publicRoot, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Runtime asset escapes public/: ' + assetPath);
  }
  const existing = required.get(clean) || [];
  if (!existing.includes(role)) existing.push(role);
  required.set(clean, existing);
}

async function readJson(file, label) {
  const source = await readFile(file, 'utf8');
  try {
    return JSON.parse(source.replace(/^\\uFEFF/, ''));
  } catch (error) {
    throw new Error(label + ' is invalid JSON: ' + error.message);
  }
}

async function verifyRequiredFiles() {
  for (const assetPath of required.keys()) {
    const absolute = path.join(publicRoot, assetPath);
    const info = await stat(absolute).catch(() => null);
    if (!info || !info.isFile() || info.size < 1) {
      throw new Error('Required runtime asset is missing or empty: ' + assetPath);
    }
    if (info.size < 512) {
      const prefix = await readFile(absolute, 'utf8').catch(() => '');
      if (prefix.startsWith('version https://git-lfs.github.com/spec/v1')) {
        throw new Error('Required runtime asset is still a Git LFS pointer: ' + assetPath);
      }
    }
  }
}

const [catalog, animationManifest] = await Promise.all([
  readJson(catalogPath, 'Asset catalog'),
  readJson(animationManifestPath, 'Animation manifest')
]);

if (!animationManifest.clips || typeof animationManifest.clips !== 'object') {
  throw new Error('Animation manifest must contain a clips object.');
}

addRequired('assets/asset-catalog.json', 'asset-catalog');
addRequired('assets/animations/manifest.json', 'animation-manifest');
addRequired('reference/world/video_frame_02s.webp', 'world-reference');
addRequired('reference/world/video_frame_16s.webp', 'world-reference');
addRequired('reference/world/video_frame_26s.webp', 'world-reference');
addRequired('decoders/draco/draco_decoder.js', 'draco-decoder');
addRequired('decoders/draco/draco_decoder.wasm', 'draco-decoder');
addRequired('decoders/draco/draco_wasm_wrapper.js', 'draco-decoder');
addRequired('decoders/basis/basis_transcoder.js', 'basis-transcoder');
addRequired('decoders/basis/basis_transcoder.wasm', 'basis-transcoder');

const playerModel = catalog.character && catalog.character.playerModel;
if (typeof playerModel === 'string' && playerModel.trim()) {
  addRequired(playerModel, 'player-model');
}

for (const [key, raw] of Object.entries(animationManifest.clips)) {
  const definition = typeof raw === 'string' ? { file: raw } : raw;
  const file = definition && definition.file;
  if (typeof file !== 'string' || !file.trim()) {
    throw new Error('Animation clip ' + key + ' has no file path.');
  }
  const clean = file.trim().replace(/\\/g, '/').replace(/^\\/+/, '');
  const resolved = clean.startsWith('assets/')
    ? clean
    : path.posix.join('assets/animations', clean);
  addRequired(resolved, 'animation:' + key);
}

for (const category of ['worldModels', 'weaponModels']) {
  const definitions = catalog[category] && typeof catalog[category] === 'object'
    ? catalog[category]
    : {};
  for (const [key, raw] of Object.entries(definitions)) {
    const definition = typeof raw === 'string' ? { file: raw } : raw;
    if (!definition || typeof definition.file !== 'string') {
      throw new Error(category + '.' + key + ' has no file path.');
    }
    addRequired(definition.file, category + ':' + key);
  }
}

await verifyRequiredFiles();

const worldModels = catalog.worldModels || {};
const weaponModels = catalog.weaponModels || {};
const missingAudio = [];
for (const assetPath of optionalAudio) {
  const info = await stat(path.join(publicRoot, assetPath)).catch(() => null);
  if (!info || !info.isFile() || info.size < 1) missingAudio.push(assetPath);
}

const assetManifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  pathPolicy: 'All asset paths are relative to public/ and contain no leading slash.',
  requiredAssets: [...required.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, roles]) => ({ file, roles })),
  optionalMissing: {
    worldModels: expectedWorldModels.filter((key) => !worldModels[key]),
    weaponModels: expectedWeaponModels.filter((key) => !weaponModels[key]),
    audio: missingAudio
  }
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(assetManifest, null, 2) + '\\n', 'utf8');

console.log('[Project Zero Hour] Runtime asset manifest generated.');
console.log('  Required local files: ' + assetManifest.requiredAssets.length);
console.log('  Optional world models not mapped: ' + assetManifest.optionalMissing.worldModels.length);
console.log('  Optional weapon models not mapped: ' + assetManifest.optionalMissing.weaponModels.length);
console.log('  Optional audio files not present: ' + assetManifest.optionalMissing.audio.length);
