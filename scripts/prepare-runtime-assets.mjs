import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'Assets');
const outputDir = path.join(root, 'public', 'assets', 'animations', 'fbx');
const manifestPath = path.join(root, 'public', 'assets', 'animations', 'manifest.json');

const clipSources = {
  idle: 'Rifle Idle.fbx',
  walk: 'Walking.fbx',
  run: 'Rifle Run.fbx',
  sprint: 'Rifle Run (3).fbx',
  backpedal: 'Run Backwards.fbx',
  aimIdle: 'Rifle Idle.fbx',
  shoot: 'Firing Rifle.fbx',
  reload: 'Reload.fbx',
  jump: 'Jump.fbx',
  fall: 'Jumping Up.fbx',
  land: 'Hard Landing.fbx',
  hit: 'Walking Hit Reaction.fbx',
  death: 'Death.fbx',
  interact: 'Rifle Put Away.fbx',
};

await mkdir(outputDir, { recursive: true });

let existing = { schemaVersion: 1, description: '', clips: {} };
try {
  existing = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!existing || typeof existing !== 'object') existing = { schemaVersion: 1, clips: {} };
} catch {
  // A missing manifest is normal on a first checkout.
}
if (!existing.clips || typeof existing.clips !== 'object') existing.clips = {};

const copied = [];
const missing = [];
for (const [key, filename] of Object.entries(clipSources)) {
  const source = path.join(sourceDir, filename);
  const target = path.join(outputDir, filename);
  try {
    const file = await stat(source);
    if (!file.isFile() || file.size < 1024) throw new Error('source is not a complete animation file');
    await copyFile(source, target);
    existing.clips[key] = {
      file: `fbx/${filename}`,
      format: 'fbx',
    };
    copied.push({ key, filename, size: file.size });
  } catch (error) {
    missing.push({ key, filename, reason: error.message });
  }
}

existing.schemaVersion = 1;
existing.description = 'Runtime FBX clips staged from repository-owned Assets/*.fbx. Clips must use the same humanoid bone naming as the selected player rig; the runtime does not retarget unrelated skeletons.';
await writeFile(manifestPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');

console.log(`[Project Zero Hour] Staged ${copied.length}/${Object.keys(clipSources).length} FBX animation entries.`);
for (const item of copied) {
  console.log(`  ✓ ${item.key.padEnd(12)} ${item.filename} (${(item.size / 1024 / 1024).toFixed(2)} MB)`);
}
for (const item of missing) {
  console.warn(`  ! ${item.key.padEnd(12)} ${item.filename}: ${item.reason}`);
}
console.log(`[Project Zero Hour] Animation manifest: ${path.relative(root, manifestPath)}`);
if (missing.length) {
  console.warn('[Project Zero Hour] Some clips remain unavailable. Check that Git LFS/source assets are pulled and the animation filenames match Assets/.');
}
