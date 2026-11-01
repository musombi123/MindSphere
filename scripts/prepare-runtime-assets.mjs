import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
  crouchIdle: 'Idle Crouching.fbx',
  crouchAimIdle: 'Idle Crouching Aiming.fbx',
  crouchWalk: 'Crouch Walking.fbx',
  crouchStop: 'Crouch Stop Walking.fbx',
  proneShoot: 'Prone Firing Rifle.fbx',
  proneReload: 'Prone Reloading.fbx',
  block: 'Rifle Block.fbx',
  jumpWall: 'Jump From Wall.fbx',
  deathFromRight: 'Death From Right.fbx',
  deathBack: 'Standing Death Backward 01.fbx',
  hitToBack: 'Rifle Kneel Hit To Back.fbx',
  dodge: 'Esquiva 5.fbx',
  melee: 'Fist Fight A.fbx',
  meleeStab: 'Double Dagger Stab.fbx',
  turn: 'Rifle Turn.fbx',
  startWalk: 'Start Walking.fbx',
  runJump: 'Running Jump.fbx',
  deathWalk: 'Walking To Dying.fbx',
  jumpHigh: 'Big Jump.fbx',
};

// This directory is generated from Assets/ on every dev/build run. Remove stale staged copies only here.
await rm(outputDir, { recursive: true, force: true });
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

// If the compatible Trellis humanoid pack has been extracted by prepare-character.ps1,
// prefer its own locomotion clips for the core states. These were inspected against the
// pack's 65-bone Mixamo hierarchy and have a closer node-name match to that player rig.
const characterPackDir = path.join(root, 'public', 'assets', 'characters', 'imported', 'zero-soldier');
const compatibleCharacterClips = {
  idle: 'idle.fbx',
  walk: 'walking.fbx',
  run: 'running.fbx',
  jump: 'jump.fbx',
  strafeLeft: 'left strafe.fbx',
  strafeRight: 'right strafe.fbx',
  turn: 'left turn.fbx',
};
const characterOverrides = [];
for (const [key, filename] of Object.entries(compatibleCharacterClips)) {
  const candidate = path.join(characterPackDir, filename);
  try {
    const file = await stat(candidate);
    if (!file.isFile() || file.size < 1024) continue;
    existing.clips[key] = {
      file: 'assets/characters/imported/zero-soldier/' + filename,
      format: 'fbx',
      source: 'Female Basic Locomotion Pack · shared Trellis humanoid rig',
    };
    characterOverrides.push({ key, filename, size: file.size });
  } catch {
    // The character pack is optional until the player candidate has been imported.
  }
}

console.log(`[Project Zero Hour] Staged ${copied.length}/${Object.keys(clipSources).length} FBX animation entries.`);
for (const item of copied) {
  console.log(`  ✓ ${item.key.padEnd(12)} ${item.filename} (${(item.size / 1024 / 1024).toFixed(2)} MB)`);
}
for (const item of missing) {
  console.warn(`  ! ${item.key.padEnd(12)} ${item.filename}: ${item.reason}`);
}
console.log(`[Project Zero Hour] Animation manifest: ${path.relative(root, manifestPath)}`);
console.log(`[Project Zero Hour] Compatible player-pack animation overrides: ${characterOverrides.length}`);
for (const item of characterOverrides) {
  console.log(`  ↳ ${item.key.padEnd(12)} ${item.filename} (${(item.size / 1024 / 1024).toFixed(2)} MB)`);
}
if (missing.length) {
  console.error('[Project Zero Hour] Required source animations are missing. Restore the named files in Assets/ before building.');
  process.exitCode = 1;
}
