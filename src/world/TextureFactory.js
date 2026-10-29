import * as THREE from 'three';

const PALETTES = {
  laterite:[[117,54,31],[150,71,41],[178,98,58],[98,45,30]],
  grass:[[39,64,35],[51,79,40],[73,91,48],[30,53,31]],
  dryGrass:[[94,82,47],[118,103,59],[139,116,68],[74,70,43]],
  rock:[[66,70,65],[91,90,81],[113,106,92],[51,55,53]],
  mud:[[63,48,36],[83,61,44],[103,75,52],[48,40,31]],
  bark:[[57,39,25],[83,56,33],[101,73,43],[45,32,24]],
  wood:[[84,57,33],[117,79,46],[138,95,57],[62,43,29]],
  metal:[[47,57,59],[75,83,81],[100,101,91],[33,43,47]],
  leaf:[[26,68,37],[43,94,45],[62,113,52],[21,51,31]],
  maize:[[67,91,39],[100,119,48],[144,145,63],[40,71,33]],
  road:[[116,51,29],[145,65,37],[170,86,48],[93,42,27]]
};

function fract(value) { return value - Math.floor(value); }
function hash2(x, y, seed) {
  return fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123);
}
function seeded(seed) {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

function buildAlbedo(kind, size) {
  const palette = PALETTES[kind] || PALETTES.grass;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const image = context.createImageData(size, size);
  const height = new Float32Array(size * size);
  const random = seeded(kind.length * 8191 + size * 17);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const coarse = hash2(Math.floor(x / 13), Math.floor(y / 13), kind.length);
      const fine = random() * 0.7 + hash2(x, y, kind.length) * 0.3;
      const streak = kind === 'road' || kind === 'laterite'
        ? Math.sin(x * 0.47 + Math.sin(y * 0.12) * 2.7) * 0.5 + 0.5
        : coarse;
      const base = palette[Math.min(palette.length - 1, Math.floor(coarse * palette.length))];
      const noise = (fine - 0.5) * 34 + (streak - 0.5) * (kind === 'road' ? 12 : 6);
      const pits = hash2(Math.floor(x / 4), Math.floor(y / 4), 33 + kind.length) > 0.89 ? -15 : 0;
      for (let c = 0; c < 3; c++) image.data[i * 4 + c] = THREE.MathUtils.clamp(base[c] + noise + pits, 0, 255);
      image.data[i * 4 + 3] = 255;
      height[i] = coarse * 0.55 + fine * 0.45 + (streak - 0.5) * 0.16;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return { texture, height, size };
}

function buildHeightTexture(kind, data, size, normal = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const left = data[y * size + ((x - 1 + size) % size)];
      const right = data[y * size + ((x + 1) % size)];
      const up = data[((y - 1 + size) % size) * size + x];
      const down = data[((y + 1) % size) * size + x];
      if (normal) {
        const nx = (left - right) * 3.2, ny = (up - down) * 3.2;
        const length = Math.sqrt(nx * nx + ny * ny + 1);
        image.data[i * 4] = 128 + nx / length * 127;
        image.data[i * 4 + 1] = 128 + ny / length * 127;
        image.data[i * 4 + 2] = 128 + 1 / length * 127;
      } else {
        const roughness = kind === 'metal' ? 0.42 : 0.76 + hash2(x, y, kind.length) * 0.22;
        const value = Math.round(roughness * 255);
        image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = value;
      }
      image.data[i * 4 + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function createProceduralPbrTextures(size = 256) {
  const result = {};
  for (const kind of Object.keys(PALETTES)) {
    const base = buildAlbedo(kind, size);
    result[kind] = {
      albedo: base.texture,
      normal: buildHeightTexture(kind, base.height, size, true),
      roughness: buildHeightTexture(kind, base.height, size, false)
    };
  }
  return result;
}

function assetUrl(path) {
  const base = import.meta.env.BASE_URL || './';
  return new URL(String(path).replace(/^\\/+/, ''), new URL(base, window.location.href)).href;
}
async function exists(url) {
  try { const response = await fetch(url, { method: 'HEAD', cache: 'no-store' }); return response.ok; }
  catch { return false; }
}

/**
 * Optional local CC0 maps. Missing assets are ignored without generating a 404.
 * Expected: public/assets/world/textures/<surface>_{color,normal,roughness}.jpg
 */
export async function loadOptionalPbrMaps(surface, fallback, onReady = () => {}) {
  const files = {
    albedo: assetUrl('assets/world/textures/' + surface + '_color.jpg'),
    normal: assetUrl('assets/world/textures/' + surface + '_normal.jpg'),
    roughness: assetUrl('assets/world/textures/' + surface + '_roughness.jpg')
  };
  if (!(await exists(files.albedo))) return fallback;
  const loader = new THREE.TextureLoader();
  const loadMap = async (url, colorMap = false) => {
    if (!(await exists(url))) return null;
    return new Promise((resolve) => loader.load(url, (texture) => {
      texture.colorSpace = colorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
      resolve(texture);
    }, undefined, () => resolve(null)));
  };
  const [albedo, normal, roughness] = await Promise.all([
    loadMap(files.albedo, true), loadMap(files.normal), loadMap(files.roughness)
  ]);
  const loaded = {
    albedo: albedo || fallback.albedo,
    normal: normal || fallback.normal,
    roughness: roughness || fallback.roughness
  };
  if (albedo || normal || roughness) onReady(loaded);
  return loaded;
}
