import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputRoot = path.join(root, 'tmp-model-candidates');
const outputPath = path.join(root, 'artifacts', 'model-inspection.json');
const rows = [];

async function listFiles(dir) {
  const out = [];
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(full));
    else out.push(full);
  }
  return out;
}

function parseGlbJson(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'glTF') throw new Error('Not a GLB binary.');
  const version = buffer.readUInt32LE(4);
  if (version !== 2) throw new Error('Unsupported GLB version: ' + version);
  const total = buffer.readUInt32LE(8);
  let offset = 12;
  while (offset + 8 <= Math.min(total, buffer.length)) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + chunkLength;
    if (end > buffer.length) throw new Error('GLB chunk exceeds file length.');
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(buffer.toString('utf8', start, end).replace(/\0+$/g, '').trim());
    }
    offset = end;
  }
  throw new Error('GLB JSON chunk not found.');
}

function inspectGltfDocument(json) {
  const nodes = json.nodes || [];
  const skins = json.skins || [];
  const meshes = json.meshes || [];
  const meshNodes = nodes.filter(n => Number.isInteger(n.mesh));
  const skinnedNodes = nodes.filter(n => Number.isInteger(n.skin));
  const joints = new Set();
  for (const skin of skins) for (const joint of skin.joints || []) joints.add(joint);
  const animationNames = (json.animations || []).map(a => a.name || '(unnamed)');
  const nodeNames = nodes.map(n => n.name).filter(Boolean);
  const meshNames = meshes.map(m => m.name).filter(Boolean);
  const primitives = meshes.reduce((sum, mesh) => sum + (mesh.primitives?.length || 0), 0);
  const externalUris = [
    ...(json.buffers || []).map(x => x.uri),
    ...(json.images || []).map(x => x.uri)
  ].filter(uri => uri && !uri.startsWith('data:'));
  const mins = [], maxs = [];
  for (const accessor of json.accessors || []) {
    if (accessor.type === 'VEC3' && Array.isArray(accessor.min) && Array.isArray(accessor.max)) {
      mins.push(accessor.min); maxs.push(accessor.max);
    }
  }
  let bounds = null;
  if (mins.length) {
    bounds = {
      min: [0, 1, 2].map(i => Math.min(...mins.map(x => x[i]))),
      max: [0, 1, 2].map(i => Math.max(...maxs.map(x => x[i])))
    };
    bounds.size = bounds.min.map((value, i) => bounds.max[i] - value);
  }
  return {
    version: json.asset?.version || '',
    generator: json.asset?.generator || '',
    sceneCount: json.scenes?.length || 0,
    nodeCount: nodes.length,
    meshCount: meshes.length,
    meshNodeCount: meshNodes.length,
    primitiveCount: primitives,
    skinCount: skins.length,
    skinnedMeshNodeCount: skinnedNodes.length,
    jointCount: joints.size,
    animationCount: animationNames.length,
    animationNames,
    materialCount: json.materials?.length || 0,
    textureCount: json.textures?.length || 0,
    imageCount: json.images?.length || 0,
    externalUris,
    nodeNames: nodeNames.slice(0, 40),
    meshNames: meshNames.slice(0, 40),
    approximateAccessorBounds: bounds
  };
}

function inspectFbx(buffer, filePath) {
  const array = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const basePath = path.dirname(filePath).replace(/\\/g, '/') + '/';
  const rootScene = new FBXLoader().parse(array, basePath);
  const stats = { meshCount: 0, skinnedMeshCount: 0, boneCount: 0, nodes: 0, materials: 0 };
  const names = [];
  let bounds = new THREE.Box3();
  rootScene.updateMatrixWorld(true);
  rootScene.traverse(object => {
    stats.nodes++;
    if (object.isMesh) stats.meshCount++;
    if (object.isSkinnedMesh) stats.skinnedMeshCount++;
    if (object.isBone) stats.boneCount++;
    if (object.material) stats.materials += Array.isArray(object.material) ? object.material.length : 1;
    if (object.name && names.length < 40) names.push(object.name);
  });
  bounds.setFromObject(rootScene);
  const size = bounds.getSize(new THREE.Vector3());
  const dimensions = [size.x, size.y, size.z];
  return {
    ...stats,
    animationCount: rootScene.animations?.length || 0,
    animationNames: (rootScene.animations || []).map(x => x.name),
    nodeNames: names,
    bounds: {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
      size: dimensions
    },
    candidateRiggedHumanoid: stats.skinnedMeshCount > 0 && stats.boneCount >= 8
  };
}

const files = await listFiles(inputRoot);
for (const file of files) {
  const extension = path.extname(file).toLowerCase();
  if (!['.glb', '.gltf', '.fbx', '.obj'].includes(extension)) continue;
  const relative = path.relative(root, file).replace(/\\/g, '/');
  try {
    const info = await stat(file);
    const buffer = await readFile(file);
    let metadata;
    if (extension === '.glb') {
      metadata = { format: 'GLB', ...inspectGltfDocument(parseGlbJson(buffer)) };
    } else if (extension === '.gltf') {
      const json = JSON.parse(buffer.toString('utf8'));
      metadata = { format: 'GLTF', ...inspectGltfDocument(json) };
    } else if (extension === '.fbx') {
      metadata = { format: 'FBX', ...inspectFbx(buffer, file) };
    } else {
      const text = buffer.toString('utf8');
      metadata = {
        format: 'OBJ',
        vertexCount: (text.match(/^v\s+/gm) || []).length,
        faceCount: (text.match(/^f\s+/gm) || []).length,
        note: 'OBJ has no skeleton/animation data; must be converted and rigged for animated player use.'
      };
    }
    rows.push({ path: relative, sizeBytes: info.size, ...metadata });
  } catch (error) {
    rows.push({ path: relative, sizeBytes: (await stat(file)).size, error: error.message });
  }
}

await (await import('node:fs/promises')).mkdir(path.dirname(outputPath), { recursive: true });
await (await import('node:fs/promises')).writeFile(outputPath, JSON.stringify(rows, null, 2));
console.log('[Project Zero Hour] Inspected ' + rows.length + ' extracted model candidates.');
for (const row of rows) {
  const format = row.format || path.extname(row.path).toUpperCase();
  console.log(
    format.padEnd(5) + ' ' +
    String(row.path).padEnd(68) +
    ' mesh=' + String(row.meshCount ?? row.meshNodeCount ?? row.vertexCount ?? '-') +
    ' skin=' + String(row.skinnedMeshCount ?? row.skinnedMeshNodeCount ?? 0) +
    ' bones=' + String(row.boneCount ?? row.jointCount ?? 0) +
    ' anim=' + String(row.animationCount ?? 0)
  );
}
console.log('JSON report: artifacts/model-inspection.json');
