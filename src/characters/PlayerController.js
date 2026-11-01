import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { recordModelLoaded, registerMissingAsset, resolveMissingAsset, registerOptionalAsset, resolveOptionalAsset, updateAssetTask } from '../world/AssetDiagnostics.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinnedScene } from 'three/addons/utils/SkeletonUtils.js';

const CHARACTER_URL = 'assets/characters/player.glb';
const ANIMATION_MANIFEST_URL = 'assets/animations/manifest.json';
const TARGET_HEIGHT_METRES = 1.88;
const BASE_URL = import.meta.env.BASE_URL || './';

function publicAssetUrl(path) {
  const cleanPath = String(path || '').replace(/^\/+/, '');
  return new URL(cleanPath, new URL(BASE_URL, window.location.href)).href;
}

const REQUIRED_CLIPS = [
  'idle', 'walk', 'run', 'sprint', 'strafeLeft', 'strafeRight', 'backpedal',
  'crouchIdle', 'crouchAimIdle', 'crouchWalk', 'crouchStop',
  'proneShoot', 'proneReload', 'block', 'jump', 'jumpWall', 'jumpHigh', 'runJump',
  'fall', 'land', 'aimIdle', 'shoot', 'reload', 'hit', 'hitToBack',
  'death', 'deathFromRight', 'deathBack', 'deathWalk', 'interact', 'turn',
  'dodge', 'melee', 'meleeStab',
  'shockwave', 'aegis', 'overdrive', 'chainLightning', 'secondWind'
];

const CLIP_RULES = [
  ['deathFromRight', /deathfromright|rightdeath/],
  ['deathBack', /deathbackward|standingdeathback|deathback/],
  ['deathWalk', /walkingtodying|walkingtodeath|deathtowalk/],
  ['hitToBack', /kneelhit|hittoback|riflekneelhit/],
  ['crouchAimIdle', /idlecrouchingaiming|crouchaim|aimcrouch/],
  ['crouchStop', /crouchstop|stopwalkingcrouch/],
  ['crouchWalk', /crouchwalk|crouchedwalk/],
  ['crouchIdle', /idlecrouching|crouchidle/],
  ['proneShoot', /pronefiring|proneshoot/],
  ['proneReload', /pronereload/],
  ['jumpWall', /jumpfromwall|walljump/],
  ['jumpHigh', /bigjump|highjump/],
  ['runJump', /runningjump|runjump/],
  ['meleeStab', /doubledagger|daggerstab/],
  ['melee', /fistfight|melee/],
  ['dodge', /esquiva|dodge|evade/],
  ['startWalk', /startwalking|startwalk/],
  ['turn', /rifleturn|turn/],
  ['block', /rifleblock|block/],
  ['chainLightning', /chainlightning|lightningchain|chaincast/],
  ['secondWind', /secondwind|healing|recover|vitality/],
  ['shockwave', /shockwave|groundslam|areaburst|aoe/],
  ['strafeLeft', /strafeleft|leftstrafe|walkleft|leftwalk/],
  ['strafeRight', /straferight|rightstrafe|walkright|rightwalk/],
  ['backpedal', /backpedal|walkback|backwardwalk|backwards/],
  ['aimIdle', /aimidle|aimingidle|rifleaim|aimpose/],
  ['overdrive', /overdrive|sprintcast|dashcast/],
  ['interact', /interact|pickup|useobject/],
  ['reload', /reload|reloading|magazine/],
  ['shoot', /shoot|fireweapon|firing|riflefire/],
  ['death', /death|dying|die/],
  ['hit', /hitreaction|takehit|hurt|damage/],
  ['jump', /jump|takeoff/],
  ['fall', /fall|falling|freefall/],
  ['land', /land|landing/],
  ['sprint', /sprint|fastrun|runfast/],
  ['run', /running|run|jog/],
  ['walk', /walking|walk/],
  ['idle', /idle|rest|standing|standstill|breath/],
  ['aegis', /aegis|shield|defend|block/]
];

function normaliseName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveClipKey(name) {
  const normalised = normaliseName(name);
  const exact = REQUIRED_CLIPS.find((key) => normaliseName(key) === normalised);
  if (exact) return exact;
  const match = CLIP_RULES.find((entry) => entry[1].test(normalised));
  return match ? match[0] : null;
}

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

/**
 * Player visuals and animation layer. The existing game remains authoritative
 * for movement, combat, damage, abilities, mission state and input bindings.
 * This controller owns the visual rig, clip state, weapon socket and camera.
 */
export class PlayerController {
  constructor({ renderer, onProgress = () => {}, onStatus = () => {} } = {}) {
    this.renderer = renderer;
    this.onProgress = onProgress;
    this.onStatus = onStatus;
    this.root = null;
    this.avatar = null;
    this.avatarMixer = null;
    this.animationClips = [];
    this.loaded = false;
    this.dead = false;
    this.actions = new Map();
    this.actionWeights = new Map();
    this.oneShotAction = null;
    this.oneShotKey = '';
    this.weaponSocket = null;
    this.weaponDefinitions = new Map();
    this.weaponVisuals = new Map();
    this.activeWeaponVisual = 'pulseRifle';
    this.fallbackGesture = null;
    this.fallbackTime = 0;
    this.motion = { moveX: 0, moveZ: 0, speed: 0, maxSpeed: 9.2, sprinting: false, aiming: false, crouching: false };
    this.cameraRaycaster = new THREE.Raycaster();
    this.cameraPosition = new THREE.Vector3();
    this.cameraSafeDistance = 0;
    this.cameraCheckTimer = 0;
    this.lastCameraAimMode = null;
    this.cameraTime = 0;
    this.fallback = this.createFallbackHumanoid();
  }

  attachRoot(root) {
    this.root = root;
    this.root.userData.legs = [];
    this.root.userData.isHero = true;
    this.root.add(this.fallback.group);
    this.weaponSocket = this.fallback.weaponSocket;
    this.root.userData.weaponSocket = this.weaponSocket;
    return root;
  }

  reportProgress(percent, message) {
    const safePercent = clamp01(Number(percent) / 100) * 100;
    updateAssetTask('player-model', { label: message || 'PLAYER MODEL', loaded: safePercent, total: 100, done: safePercent >= 100 });
    this.onProgress({
      percent: clamp01(Number(percent) / 100) * 100,
      message: message || 'INITIALISING AEGIS CHARACTER'
    });
  }

  async resolveCharacterUrl(requested = '') {
    if (requested) {
      return /^https?:\/\//i.test(requested) ? requested : publicAssetUrl(requested);
    }
    try {
      const response = await fetch(publicAssetUrl('assets/asset-catalog.json'), { cache: 'no-store' });
      if (response.ok) {
        const catalog = await response.json();
        const candidate = catalog?.character?.playerModel;
        this.weaponDefinitions = new Map(
          Object.entries(catalog?.weaponModels || {}).filter(([key, value]) =>
            ['pulseRifle', 'novaCannon', 'arcLance', 'gravityCore'].includes(key) &&
            value && typeof (typeof value === 'string' ? value : value.file) === 'string'
          ).map(([key, value]) => [key, typeof value === 'string' ? { file: value } : value])
        );
        if (typeof candidate === 'string' && candidate.trim()) {
          return publicAssetUrl(candidate.trim());
        }
      }
    } catch (error) {
      console.info('[Project Zero Hour] Optional asset catalog not available; checking the default player path.');
    }
    return publicAssetUrl(CHARACTER_URL);
  }

  async load(url = '') {
    if (!this.root) throw new Error('PlayerController.attachRoot(root) must be called before load().');
    const modelUrl = await this.resolveCharacterUrl(url);
    this.reportProgress(2, 'SEARCHING FOR RIGGED PLAYER MODEL');

    const manager = new THREE.LoadingManager();
    manager.onProgress = (itemUrl, loaded, total) => {
      this.reportProgress(5 + (total ? (loaded / total) * 85 : 0), 'LOADING MODEL DATA ' + loaded + ' / ' + total);
    };
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath(publicAssetUrl('decoders/draco/'));
    dracoLoader.preload();

    const ktx2Loader = new KTX2Loader(manager);
    ktx2Loader.setTranscoderPath(publicAssetUrl('decoders/basis/'));
    if (this.renderer) ktx2Loader.detectSupport(this.renderer);

    const loader = new GLTFLoader(manager);
    loader.setDRACOLoader(dracoLoader);
    loader.setKTX2Loader(ktx2Loader);
    loader.setMeshoptDecoder(MeshoptDecoder);

    try {
      this.reportProgress(5, 'DECODING HUMANOID MESH');
      const progress = (event) => {
        if (event && event.total > 0) {
          this.reportProgress(5 + (event.loaded / event.total) * 80, 'DOWNLOADING PLAYER MODEL');
        }
      };

      let modelScene = null;
      let clips = [];
      if (/\.fbx(?:[?#]|$)/i.test(modelUrl)) {
        const fbxLoader = new FBXLoader(manager);
        modelScene = await fbxLoader.loadAsync(modelUrl, progress);
        clips = [...(modelScene.animations || [])];
      } else {
        const gltf = await loader.loadAsync(modelUrl, progress);
        modelScene = gltf.scene;
        clips = [...(gltf.animations || [])];
      }

      if (!modelScene) throw new Error('The character file loaded without a scene root.');
      this.avatar = cloneSkinnedScene(modelScene);
      this.avatar.name = 'ZERO_HUMANOID_RIG';
      this.applyFallbackCharacterPalette(this.avatar, 'hero');
      this.normaliseAvatar(this.avatar);
      this.root.add(this.avatar);
      this.avatar.traverse((object) => {
        if (object.isMesh || object.isSkinnedMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          object.frustumCulled = true;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (material && (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial)) {
              material.needsUpdate = true;
            }
          });
        }
      });

      this.loaded = true;
      this.fallback.group.visible = false;
      this.createWeaponSocket();
      await this.loadWeaponVisuals(loader);
      this.animationClips = clips.slice();
      const externalClips = await this.loadExternalAnimationClips(loader);
      this.animationClips.push(...externalClips);
      this.animationClips = this.createAnimationActions(this.animationClips);
      recordModelLoaded(modelUrl);
      resolveMissingAsset(CHARACTER_URL);
      resolveMissingAsset('/' + CHARACTER_URL);

      this.reportProgress(100, 'AEGIS RIG READY');
      this.onStatus({
        type: 'ready',
        message: 'RIGGED PLAYER MODEL READY · ' + this.actions.size + ' CLIPS'
      });
      return true;
    } catch (error) {
      registerMissingAsset(modelUrl, 'Player rig did not load: ' + (error && error.message ? error.message : String(error)));
      this.activateFallback();
      await this.loadWeaponVisuals(loader);
      this.reportProgress(100, 'MODEL UNAVAILABLE · TEMPORARY PROXY ACTIVE');
      this.onStatus({
        type: 'fallback',
        message: 'Temporary character active. Extract a compatible rigged model into public/assets/characters/.'
      });
      console.warn(
        '[Project Zero Hour] Rigged player model is not available at ' + modelUrl +
        '. The development proxy remains active. Extract a compatible rigged model and ensure its animation clips use the same bone names.',
        error && error.message ? error.message : error
      );
      return false;
    } finally {
      dracoLoader.dispose();
      ktx2Loader.dispose();
    }
  }

  applyFallbackCharacterPalette(root, role = 'hero') {
    const palettes = {
      hero: { base: 0x596b58, armor: 0x24343a, skin: 0x806047, dark: 0x1b2324 },
      gangster: { base: 0x654b45, armor: 0x342b2b, skin: 0x795b47, dark: 0x201e1d },
      thief: { base: 0x82764d, armor: 0x3f4635, skin: 0x795b47, dark: 0x26291e },
      boss: { base: 0x743e42, armor: 0x36282d, skin: 0x795b47, dark: 0x201b20 },
      echo: { base: 0x74639b, armor: 0x332c4e, skin: 0x665a8a, dark: 0x211d35 }
    };
    const palette = palettes[role] || palettes.hero;
    root.traverse((object) => {
      if (!object.isMesh && !object.isSkinnedMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const recoloured = materials.map((material) => {
        if (!material || material.map || !material.color) return material;
        const clone = material.clone();
        const name = normaliseName((object.name || '') + ' ' + (material.name || ''));
        const color = /skin|face|head|hand/.test(name)
          ? palette.skin
          : /boot|shoe|sole|belt|glove/.test(name)
            ? palette.dark
            : /helmet|visor|armou?r|chest|plate|vest/.test(name)
              ? palette.armor
              : palette.base;
        clone.color.setHex(color);
        if ('roughness' in clone) clone.roughness = Math.max(0.68, clone.roughness || 0.8);
        if ('metalness' in clone) clone.metalness = Math.min(0.28, clone.metalness || 0.08);
        clone.needsUpdate = true;
        return clone;
      });
      object.material = Array.isArray(object.material) ? recoloured : recoloured[0];
    });
  }

  normaliseAvatar(avatar) {
    let skinnedMeshes = 0;
    let boneCount = 0;
    avatar.traverse((object) => {
      if (object.isSkinnedMesh) skinnedMeshes++;
      if (object.isBone) boneCount++;
    });
    if (skinnedMeshes < 1 || boneCount < 8) {
      throw new Error(
        'Player model is not a usable skinned humanoid (skinned meshes: ' +
        skinnedMeshes + ', bones: ' + boneCount + '). Import a rigged GLB/FBX, not a static OBJ/mesh.'
      );
    }

    avatar.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(avatar);
    const size = bounds.getSize(new THREE.Vector3());
    if (!(size.y > 0.01)) throw new Error('The player GLB has no usable vertical bounds.');
    avatar.scale.multiplyScalar(TARGET_HEIGHT_METRES / size.y);
    avatar.updateMatrixWorld(true);
    const scaledBounds = new THREE.Box3().setFromObject(avatar);
    avatar.position.x -= (scaledBounds.min.x + scaledBounds.max.x) * 0.5;
    avatar.position.y -= scaledBounds.min.y;
    avatar.position.z -= (scaledBounds.min.z + scaledBounds.max.z) * 0.5;
    avatar.updateMatrixWorld(true);
  }

  async loadExternalAnimationClips(loader) {
    try {
      const response = await fetch(publicAssetUrl(ANIMATION_MANIFEST_URL), { cache: 'no-store' });
      if (!response.ok) return [];
      const manifest = await response.json();
      const entries = Object.entries(manifest.clips || {});
      if (!entries.length) return [];

      // Group keys that share one FBX/GLB file so it is downloaded and decoded once.
      const groups = new Map();
      for (const [key, value] of entries) {
        const definition = typeof value === 'string' ? { file: value } : value;
        if (!definition || !definition.file) continue;
        let rawPath = definition.file;
        while (rawPath.startsWith('/')) rawPath = rawPath.slice(1);
        const relativePath = rawPath.startsWith('assets/') ? rawPath : 'assets/animations/' + rawPath;
        const isRemote = definition.file.toLowerCase().startsWith('https://') || definition.file.toLowerCase().startsWith('http://');
        const file = isRemote ? definition.file : publicAssetUrl(relativePath);
        const isFbx = definition.format === 'fbx' || /\.fbx(?:[?#]|$)/i.test(file);
        if (!groups.has(file)) groups.set(file, { file, isFbx, entries: [] });
        groups.get(file).entries.push({ key, definition });
      }

      const sourceGroups = [...groups.values()];
      const clips = [];
      const disposeScene = (scene) => {
        if (!scene) return;
        const geometries = new Set();
        const materials = new Set();
        const textures = new Set();
        scene.traverse((object) => {
          if (object.geometry) geometries.add(object.geometry);
          const materialList = Array.isArray(object.material)
            ? object.material
            : object.material
              ? [object.material]
              : [];
          for (const material of materialList) {
            materials.add(material);
            for (const value of Object.values(material)) {
              if (value?.isTexture) textures.add(value);
            }
          }
        });
        for (const texture of textures) texture.dispose();
        for (const material of materials) material.dispose();
        for (const geometry of geometries) geometry.dispose();
      };

      const concurrency = this.renderer && this.renderer.capabilities
        ? (this.renderer.capabilities.isWebGL2 ? 3 : 2)
        : 2;

      for (let offset = 0; offset < sourceGroups.length; offset += concurrency) {
        const batch = sourceGroups.slice(offset, offset + concurrency);
        await Promise.all(batch.map(async (group) => {
          let loadedAsset = null;
          try {
            loadedAsset = group.isFbx
              ? await new FBXLoader().loadAsync(group.file)
              : await loader.loadAsync(group.file);
            const sourceClips = loadedAsset.animations || [];
            for (const { key, definition } of group.entries) {
              const expected = definition.clipName
                ? normaliseName(definition.clipName)
                : normaliseName(key);
              const sourceClip = sourceClips.find((clip) => normaliseName(clip.name) === expected)
                || sourceClips[0];
              if (!sourceClip) {
                console.warn('[Project Zero Hour] Animation file has no animation clip:', group.file, key);
                continue;
              }
              const clip = sourceClip.clone();
              clip.name = key;
              clips.push(clip);
            }
          } catch (error) {
            console.warn('[Project Zero Hour] Optional animation source failed:', group.file, error.message);
          } finally {
            // The cloned AnimationClip owns its tracks; the decoded source scene is no longer needed.
            disposeScene(loadedAsset?.scene);
            loadedAsset = null;
          }
        }));
      }

      return clips;
    } catch (error) {
      // The manifest is optional for artists who pack clips directly into player.glb.
      console.warn('[Project Zero Hour] Animation manifest could not be read:', error.message);
      return [];
    }
  }

  createAnimationActions(clips) {
    this.actions.clear();
    this.actionWeights.clear();
    if (!this.avatar) return [];

    // Build one normalised node-name index for fast per-clip skeleton validation.
    const avatarNodeNames = new Set();
    this.avatar.traverse((object) => {
      if (object.name) avatarNodeNames.add(normaliseName(object.name));
    });

    this.avatarMixer = new THREE.AnimationMixer(this.avatar);
    this.avatarMixer.addEventListener('finished', (event) => {
      if (event.action === this.oneShotAction) {
        if (this.oneShotKey !== 'death') {
          event.action.setLoop(THREE.LoopRepeat, Infinity);
          event.action.clampWhenFinished = false;
        }
        this.oneShotAction = null;
        this.oneShotKey = '';
      }
    });

    const acceptedClips = [];
    const rejectedClips = [];
    const seenKeys = new Set();
    (clips || []).forEach((clip) => {
      const key = resolveClipKey(clip.name);
      if (!key || seenKeys.has(key)) return;

      const targets = new Set();
      for (const track of clip.tracks || []) {
        try {
          const parsed = THREE.PropertyBinding.parseTrackName(track.name);
          if (parsed.nodeName) targets.add(parsed.nodeName);
        } catch {
          const fallback = String(track.name || '').split('.')[0].split('/').pop();
          if (fallback) targets.add(fallback);
        }
      }
      const matched = [...targets].filter((name) => avatarNodeNames.has(normaliseName(name)));
      const coverage = targets.size ? matched.length / targets.size : 0;
      if (coverage < 0.65) {
        rejectedClips.push({ key, coverage, targets: targets.size, matched: matched.length });
        console.warn(
          '[Project Zero Hour] Rejected incompatible animation clip "' + key +
          '": ' + matched.length + ' / ' + targets.size +
          ' track targets match the active player rig. Minimum required coverage is 65%.'
        );
        return;
      }

      let mappedClip = clip;
      if (key === 'aimIdle' || key === 'crouchAimIdle') {
        const upperBodyTracks = clip.tracks.filter((track) => {
          const target = normaliseName(String(track.name).split('.')[0].split('/').pop());
          return /spine|chest|neck|head|clavicle|shoulder|arm|forearm|hand|finger/.test(target);
        });
        if (upperBodyTracks.length) {
          mappedClip = new THREE.AnimationClip(clip.name + '_UPPER_BODY', clip.duration, upperBodyTracks, clip.blendMode);
        } else {
          console.warn('[Project Zero Hour] Aim clip has no recognisable upper-body tracks; using the supplied clip as-is:', clip.name);
        }
      }

      this.actions.set(key, this.avatarMixer.clipAction(mappedClip));
      acceptedClips.push(clip);
      seenKeys.add(key);
    });

    const missing = REQUIRED_CLIPS.filter((key) => !this.actions.has(key));
    if (missing.length) {
      console.warn(
        '[Project Zero Hour] These animation states have no compatible clip on the active rig: ' +
        missing.join(', ') + '. Add a matching FBX/GLB clip or use the same humanoid skeleton.'
      );
    }
    this.onStatus({
      type: 'animations',
      message: acceptedClips.length + ' compatible animation states mapped',
      rejected: rejectedClips.length
    });
    if (rejectedClips.length) {
      console.warn('[Project Zero Hour] Rejected ' + rejectedClips.length + ' incompatible animation clips:', rejectedClips);
    }
    return acceptedClips;
  }

  createWeaponSocket() {
    if (!this.avatar) return;
    const bones = [];
    this.avatar.traverse((object) => { if (object.isBone) bones.push(object); });
    const normalisedNames = bones.map((bone) => ({ bone, name: normaliseName(bone.name) }));
    const hand = (
      normalisedNames.find((item) => item.name.endsWith('righthand')) ||
      normalisedNames.find((item) => item.name.includes('righthand')) ||
      normalisedNames.find((item) => item.name === 'handr') ||
      normalisedNames.find((item) => item.name.includes('handr')) || {}
    ).bone;

    if (hand) {
      this.weaponSocket = new THREE.Group();
      this.weaponSocket.name = 'PLAYER_WEAPON_SOCKET';
      this.weaponSocket.position.set(0, 0, 0.06);
      hand.add(this.weaponSocket);
    } else {
      this.weaponSocket = new THREE.Group();
      this.weaponSocket.name = 'PLAYER_WEAPON_SOCKET_APPROXIMATE';
      this.weaponSocket.position.set(0.38, 1.12, -0.2);
      this.avatar.add(this.weaponSocket);
      console.warn('[Project Zero Hour] No right-hand bone was found in player.glb. Weapon socket is approximate until the rig uses a recognised Mixamo-style hand bone.');
    }
    if (this.root) this.root.userData.weaponSocket = this.weaponSocket;
  }

 

  createProceduralWeapon(key) {
    const root = new THREE.Group();
    root.name = 'PROCEDURAL_WEAPON_' + String(key).toUpperCase();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x26343a, metalness: 0.58, roughness: 0.42 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x11191d, metalness: 0.34, roughness: 0.72 });
    const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x63747b, metalness: 0.78, roughness: 0.3 });
    const energyColors = {
      pulseRifle: 0x55e5ed,
      novaCannon: 0xffad55,
      arcLance: 0x75aaff,
      gravityCore: 0xc18aff
    };
    const glowColor = energyColors[key] || 0x55e5ed;
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: 1.15,
      metalness: 0.36,
      roughness: 0.28
    });
    const addBox = (size, material, position, rotation = [0, 0, 0]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
      mesh.position.set(position[0], position[1], position[2]);
      mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    };
    const addCylinderZ = (radiusTop, radiusBottom, length, material, position) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 12), material);
      mesh.rotation.x = Math.PI * 0.5;
      mesh.position.set(position[0], position[1], position[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
      return mesh;
    };

    const isHeavy = key === 'novaCannon' || key === 'gravityCore';
    const bodyLength = key === 'arcLance' ? 0.92 : isHeavy ? 0.78 : 0.72;
    addBox([0.14, 0.17, bodyLength], bodyMaterial, [0, 0, -0.27]);
    addBox([0.15, 0.09, 0.22], darkMaterial, [0, -0.02, 0.16]);
    addBox([0.085, 0.22, 0.13], darkMaterial, [0, -0.16, -0.12], [0.18, 0, 0]);
    addBox([0.18, 0.05, 0.26], metalMaterial, [0, 0.105, -0.23]);
    addBox([0.18, 0.07, 0.13], darkMaterial, [0, 0.09, 0.12]);
    addBox([0.07, 0.055, 0.34], glowMaterial, [0, 0.012, -0.29]);

    if (key === 'novaCannon') {
      addBox([0.22, 0.20, 0.24], bodyMaterial, [0, 0, -0.69]);
      addCylinderZ(0.13, 0.13, 0.16, metalMaterial, [0, 0, -0.83]);
      addCylinderZ(0.105, 0.105, 0.08, glowMaterial, [0, 0, -0.94]);
    } else if (key === 'arcLance') {
      addCylinderZ(0.055, 0.085, 0.5, metalMaterial, [0, 0.02, -0.70]);
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.018, 8, 16), glowMaterial);
        ring.position.set(0, 0.02, -0.48 - i * 0.16);
        ring.rotation.x = Math.PI * 0.5;
        root.add(ring);
      }
    } else if (key === 'gravityCore') {
      addBox([0.23, 0.23, 0.24], bodyMaterial, [0, 0, -0.69]);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), glowMaterial);
      core.position.set(0, 0.03, -0.48);
      root.add(core);
      addCylinderZ(0.16, 0.16, 0.12, metalMaterial, [0, 0, -0.86]);
    } else {
      addCylinderZ(0.055, 0.075, 0.36, metalMaterial, [0, 0.01, -0.70]);
      addCylinderZ(0.09, 0.09, 0.07, glowMaterial, [0, 0.01, -0.90]);
      addBox([0.20, 0.06, 0.18], darkMaterial, [0, 0.16, -0.20]);
    }

    root.scale.setScalar(isHeavy ? 1.08 : 1);
    root.userData.proceduralFallback = true;
    return root;
  }

  async loadWeaponVisuals(loader) {
    this.weaponVisuals.clear();
    const keys = ['pulseRifle', 'novaCannon', 'arcLance', 'gravityCore'];
    if (!this.weaponSocket) return;

    for (const key of keys) {
      const definition = this.weaponDefinitions.get(key);
      if (!definition || !definition.file) {
        registerOptionalAsset(
          '/assets/weapons/' + key + '.glb',
          'No licensed weapon GLB is mapped yet; a built-in 3D prototype weapon is active.'
        );
        const fallback = this.createProceduralWeapon(key);
        fallback.visible = false;
        this.weaponSocket.add(fallback);
        this.weaponVisuals.set(key, fallback);
        continue;
      }

      const file = /^https?:\/\//i.test(definition.file)
        ? definition.file
        : publicAssetUrl(definition.file);
      try {
        const gltf = await loader.loadAsync(file);
        if (!gltf.scene) throw new Error('Weapon GLB did not contain a scene.');
        const model = cloneSkinnedScene(gltf.scene);
        model.name = 'PLAYER_WEAPON_' + key.toUpperCase();
        model.traverse((object) => {
          if (!object.isMesh && !object.isSkinnedMesh) return;
          object.castShadow = true;
          object.receiveShadow = true;
          object.frustumCulled = true;
        });

        const config = definition.transform || {};
        const boundsBefore = new THREE.Box3().setFromObject(model);
        const size = boundsBefore.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        if (!(maxDimension > 0.001)) throw new Error('Weapon GLB has invalid bounds.');
        const targetLength = Number(config.targetLength) > 0 ? Number(config.targetLength) : 0.85;
        const uniformScale = (Number(config.scale) > 0 ? Number(config.scale) : 1) * (targetLength / maxDimension);
        model.scale.multiplyScalar(uniformScale);
        const position = Array.isArray(config.position) ? config.position : [0, 0, 0];
        const rotation = Array.isArray(config.rotation) ? config.rotation : [0, 0, 0];
        model.position.set(Number(position[0]) || 0, Number(position[1]) || 0, Number(position[2]) || 0);
        model.rotation.set(Number(rotation[0]) || 0, Number(rotation[1]) || 0, Number(rotation[2]) || 0);

        const wrapper = new THREE.Group();
        wrapper.name = 'PLAYER_WEAPON_VISUAL_' + key.toUpperCase();
        wrapper.add(model);
        wrapper.visible = false;
        this.weaponSocket.add(wrapper);
        this.weaponVisuals.set(key, wrapper);
        recordModelLoaded(file);
        resolveMissingAsset('/assets/weapons/' + key + '.glb');
        resolveOptionalAsset('/assets/weapons/' + key + '.glb');
        console.info('[Project Zero Hour] Weapon visual loaded:', key, file);
      } catch (error) {
        registerMissingAsset(file, 'Mapped weapon visual failed to load: ' + (error.message || String(error)));
        console.warn('[Project Zero Hour] Weapon visual unavailable:', key, error);
        const fallback = this.createProceduralWeapon(key);
        fallback.visible = false;
        this.weaponSocket.add(fallback);
        this.weaponVisuals.set(key, fallback);
      }
    }
    this.setWeaponVisual(this.activeWeaponVisual);
  }

  setWeaponVisual(key) {
    this.activeWeaponVisual = String(key || 'pulseRifle');
    for (const [weaponKey, visual] of this.weaponVisuals) {
      visual.visible = weaponKey === this.activeWeaponVisual;
    }
  }


  createCloneAnimator(role = 'gangster') {
    if (!this.loaded || !this.avatar || !this.animationClips.length) return null;

    const root = cloneSkinnedScene(this.avatar);
    root.name = 'RIGGED_' + String(role).toUpperCase() + '_ACTOR';
    const tintByRole = {
      gangster: 0x9a6760,
      thief: 0x90956b,
      boss: 0xb94b56,
      echo: 0x8d79d0
    };
    const tint = new THREE.Color(tintByRole[role] || tintByRole.gangster);
    root.traverse((object) => {
      if (!object.isMesh && !object.isSkinnedMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = true;
      const original = Array.isArray(object.material) ? object.material : [object.material];
      const recoloured = original.map((material) => {
        if (!material) return material;
        const clone = material.clone();
        if (clone.color) clone.color.lerp(tint, role === 'echo' ? 0.44 : 0.52);
        if (role === 'echo' && clone.emissive) {
          clone.emissive.lerp(new THREE.Color(0x553d9c), 0.16);
          clone.emissiveIntensity = Math.max(clone.emissiveIntensity || 0, 0.18);
        }
        return clone;
      });
      object.material = Array.isArray(object.material) ? recoloured : recoloured[0];
    });

    const mixer = new THREE.AnimationMixer(root);
    const actions = new Map();
    for (const clip of this.animationClips) {
      const key = resolveClipKey(clip.name);
      if (key && !actions.has(key)) actions.set(key, mixer.clipAction(clip));
    }

    let locomotionAction = null;
    let oneShotAction = null;
    mixer.addEventListener('finished', (event) => {
      if (event.action === oneShotAction) oneShotAction = null;
    });

    const findAction = (keys) => {
      for (const key of keys) {
        const action = actions.get(key);
        if (action) return action;
      }
      return null;
    };

    const fadeLocomotion = (keys) => {
      if (oneShotAction) return;
      const next = findAction(keys);
      if (!next || next === locomotionAction && next.isRunning()) return;
      const previous = locomotionAction;
      next.reset();
      next.enabled = true;
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
      next.fadeIn(0.18).play();
      if (previous && previous !== next) previous.fadeOut(0.18);
      locomotionAction = next;
    };

    const play = (key, fade = 0.08) => {
      const canonical = resolveClipKey(key) || key;
      const action = actions.get(canonical);
      if (!action) return false;
      for (const other of new Set(actions.values())) {
        if (other !== action && other.isRunning()) other.fadeOut(fade);
      }
      locomotionAction = null;
      oneShotAction = action;
      action.reset();
      action.enabled = true;
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(1);
      action.fadeIn(fade).play();
      return true;
    };

    const update = (dt, speed = 0) => {
      mixer.update(dt);
      if (oneShotAction) return;
      const safeSpeed = Math.max(0, Number(speed) || 0);
      if (safeSpeed < 0.15) {
        fadeLocomotion(['idle', 'walk', 'run']);
      } else if (safeSpeed > 6.8) {
        fadeLocomotion(['run', 'walk', 'idle']);
      } else {
        fadeLocomotion(['walk', 'run', 'idle']);
      }
    };

    update(0, 0);
    const durationFor = (key, fallback = 1) => actions.get(resolveClipKey(key) || key)?.getClip()?.duration || fallback;
    return { root, mixer, actions, play, update, durationFor };
  }

  createFallbackHumanoid() {
    const group = new THREE.Group();
    group.name = 'TEMPORARY_AEGIS_HUMANOID_PROXY';
    const suit = new THREE.MeshStandardMaterial({ color: 0x152b3e, roughness: 0.64, metalness: 0.18 });
    const armour = new THREE.MeshStandardMaterial({ color: 0x243f51, roughness: 0.42, metalness: 0.34 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x815b45, roughness: 0.88, metalness: 0 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x151a1c, roughness: 0.96, metalness: 0 });
    const boots = new THREE.MeshStandardMaterial({ color: 0x10191e, roughness: 0.86, metalness: 0.12 });
    const cyan = new THREE.MeshStandardMaterial({
      color: 0x56efff, emissive: 0x087c92, emissiveIntensity: 1.15,
      roughness: 0.3, metalness: 0.35
    });
    const makeMesh = (geometry, material, parent, position, scale) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position[0], position[1], position[2]);
      if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    const torso = makeMesh(new THREE.CapsuleGeometry(0.29, 0.62, 5, 10), suit, group, [0, 1.22, 0]);
    makeMesh(new THREE.SphereGeometry(0.27, 12, 10), armour, group, [0, 1.25, -0.235], [0.88, 0.88, 0.32]);
    makeMesh(new THREE.SphereGeometry(0.09, 10, 8), cyan, group, [0, 1.36, -0.335], [1, 1.15, 0.45]);
    makeMesh(new THREE.CapsuleGeometry(0.075, 0.16, 3, 8), skin, group, [0, 1.72, 0]);
    makeMesh(new THREE.SphereGeometry(0.22, 14, 12), skin, group, [0, 1.94, 0]);
    makeMesh(new THREE.SphereGeometry(0.222, 12, 8), hair, group, [0, 2.055, 0.025], [1, 0.47, 1.03]);
    makeMesh(new THREE.SphereGeometry(0.034, 8, 6), hair, group, [-0.075, 1.95, -0.197], [1, 1, 0.45]);
    makeMesh(new THREE.SphereGeometry(0.034, 8, 6), hair, group, [0.075, 1.95, -0.197], [1, 1, 0.45]);
    makeMesh(new THREE.CapsuleGeometry(0.09, 0.42, 3, 8), armour, group, [0, 0.71, 0.14], [1, 1, 0.74]);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.17, 0.77, 0);
    group.add(leftLeg);
    makeMesh(new THREE.CapsuleGeometry(0.105, 0.58, 4, 8), suit, leftLeg, [0, -0.31, 0]);
    makeMesh(new THREE.SphereGeometry(0.15, 10, 8), boots, leftLeg, [0, -0.64, -0.08], [0.9, 0.48, 1.35]);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.17, 0.77, 0);
    group.add(rightLeg);
    makeMesh(new THREE.CapsuleGeometry(0.105, 0.58, 4, 8), suit, rightLeg, [0, -0.31, 0]);
    makeMesh(new THREE.SphereGeometry(0.15, 10, 8), boots, rightLeg, [0, -0.64, -0.08], [0.9, 0.48, 1.35]);

    const leftArm = new THREE.Group();
    leftArm.position.set(-0.39, 1.5, 0);
    group.add(leftArm);
    makeMesh(new THREE.CapsuleGeometry(0.105, 0.54, 4, 8), armour, leftArm, [0, -0.25, 0]);
    makeMesh(new THREE.SphereGeometry(0.105, 10, 8), suit, leftArm, [0, -0.54, 0]);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.39, 1.5, 0);
    group.add(rightArm);
    makeMesh(new THREE.CapsuleGeometry(0.105, 0.54, 4, 8), armour, rightArm, [0, -0.25, 0]);
    makeMesh(new THREE.SphereGeometry(0.105, 10, 8), suit, rightArm, [0, -0.54, 0]);

    const weaponSocket = new THREE.Group();
    weaponSocket.name = 'PLAYER_WEAPON_SOCKET';
    weaponSocket.position.set(0, -0.56, -0.05);
    rightArm.add(weaponSocket);

    return { group, torso, leftArm, rightArm, leftLeg, rightLeg, weaponSocket };
  }

  activateFallback() {
    if (!this.root) return;
    this.fallback.group.visible = true;
    this.loaded = false;
    this.weaponSocket = this.fallback.weaponSocket;
    this.root.userData.weaponSocket = this.weaponSocket;
  }

  setLocomotion({ moveX = 0, moveZ = 0, speed = 0, maxSpeed = 9.2, sprinting = false, aiming = false, crouching = false } = {}) {
    this.motion.moveX = moveX;
    this.motion.moveZ = moveZ;
    this.motion.speed = Math.max(0, speed);
    this.motion.maxSpeed = Math.max(1, maxSpeed);
    this.motion.sprinting = Boolean(sprinting);
    this.motion.aiming = Boolean(aiming);
    this.motion.crouching = Boolean(crouching);
  }

  trigger(key) {
    const aliases = { chain: 'chainLightning', secondwind: 'secondWind', fire: 'shoot', shield: 'aegis' };
    const canonical = aliases[key] || key;
    if (canonical === 'death') this.dead = true;

    if (!this.loaded || !this.avatarMixer) {
      this.fallbackGesture = { key: canonical, remaining: canonical === 'death' ? 8 : canonical === 'reload' ? 1.25 : 0.55 };
      return;
    }

    const action = this.actions.get(canonical);
    if (!action) {
      if (!this.missingTriggeredClips) this.missingTriggeredClips = new Set();
      if (!this.missingTriggeredClips.has(canonical)) {
        console.warn('[Project Zero Hour] No "' + canonical + '" animation clip is mapped. Add a compatible clip to player.glb or the animation manifest.');
        this.missingTriggeredClips.add(canonical);
      }
      return;
    }
    if (canonical === 'shoot' && action === this.oneShotAction && action.isRunning()) return;

    for (const other of new Set(this.actions.values())) {
      if (other !== action && other.isRunning()) other.fadeOut(0.12);
    }
    this.oneShotAction = action;
    this.oneShotKey = canonical;
    action.reset();
    action.enabled = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.fadeIn(0.12).play();
  }

  update(dt) {
    if (this.avatarMixer) this.avatarMixer.update(dt);
    if (!this.loaded) this.updateFallback(dt);
    if (this.loaded && !this.dead && !this.oneShotAction) this.applyLocomotionBlend(dt);
  }

  applyLocomotionBlend(dt) {
    const motion = this.motion;
    const intensity = clamp01(motion.speed / motion.maxSpeed);
    const desired = new Map();
    const add = (key, weight, fallbackKey) => {
      if (weight <= 0) return;
      let action = this.actions.get(key);
      if (!action && fallbackKey) action = this.actions.get(fallbackKey);
      if (action) desired.set(action, (desired.get(action) || 0) + weight);
    };

    if (motion.crouching) {
      if (intensity < 0.05) add('crouchIdle', 1, 'idle');
      else add('crouchWalk', 1, 'walk');
      if (motion.aiming) add('crouchAimIdle', 0.1);
    } else if (motion.aiming && intensity < 0.05 && this.actions.has('aimIdle')) {
      add('aimIdle', 0.9);
      add('idle', 0.1);
    } else if (motion.aiming && intensity >= 0.05) {
      const directionKey = motion.moveZ > 0.25
        ? 'backpedal'
        : motion.moveX < -0.2
          ? 'strafeLeft'
          : motion.moveX > 0.2
            ? 'strafeRight'
            : '';
      if (directionKey && this.actions.has(directionKey)) {
        add(directionKey, intensity);
        add('aimIdle', 0.15 * intensity);
      } else {
        const runBlend = clamp01((motion.speed - 3.2) / 3.8);
        add('walk', intensity * (1 - runBlend), 'run');
        add('run', intensity * runBlend, 'walk');
        add('aimIdle', 0.12 * intensity);
      }
    } else {
      const runBlend = clamp01((motion.speed - 3.2) / 3.8);
      const sprintBlend = clamp01((motion.speed - 7.0) / 2.0);
      add('idle', 1 - intensity, 'walk');
      add('walk', intensity * (1 - runBlend), 'run');
      add('run', intensity * runBlend * (1 - sprintBlend), 'walk');
      add('sprint', intensity * sprintBlend, 'run');
    }

    const aimingAction = motion.crouching
      ? (this.actions.get('crouchAimIdle') || this.actions.get('aimIdle'))
      : this.actions.get('aimIdle');
    const locomotionTotal = Array.from(desired.entries())
      .filter(([action]) => action !== aimingAction)
      .reduce((sum, [, value]) => sum + value, 0);
    const blend = clamp01(dt * 8);
    const allActions = new Set(this.actions.values());
    allActions.forEach((action) => {
      const targetWeight = action === aimingAction
        ? (motion.aiming ? 1 : 0)
        : (locomotionTotal > 0 ? (desired.get(action) || 0) / locomotionTotal : 0);
      const currentWeight = this.actionWeights.get(action) || 0;
      const nextWeight = THREE.MathUtils.lerp(currentWeight, targetWeight, blend);
      if ((targetWeight > 0 || nextWeight > 0.001) && !action.isRunning()) {
        action.enabled = true;
        action.play();
      }
      action.setEffectiveWeight(nextWeight);
      this.actionWeights.set(action, nextWeight);
      if (targetWeight === 0 && nextWeight < 0.001) {
        action.stop();
        this.actionWeights.set(action, 0);
      }
    });
  }

  updateFallback(dt) {
    this.fallbackTime += dt;
    const moveAmount = clamp01(this.motion.speed / this.motion.maxSpeed);
    const frequency = this.motion.sprinting ? 14 : 9.5;
    const stride = Math.sin(this.fallbackTime * frequency) * 0.48 * moveAmount;
    const gesture = this.fallbackGesture;
    const gestureWeight = gesture ? clamp01(gesture.remaining / 0.3) : 0;
    this.fallback.group.position.y = this.motion.crouching ? -0.18 : 0;
    if (gesture) {
      gesture.remaining = Math.max(0, gesture.remaining - dt);
      if (gesture.remaining === 0 && gesture.key !== 'death') this.fallbackGesture = null;
    }

    this.fallback.leftLeg.rotation.x = stride;
    this.fallback.rightLeg.rotation.x = -stride;
    this.fallback.leftArm.rotation.x = -stride * 0.55;
    this.fallback.rightArm.rotation.x = stride * 0.55;
    this.fallback.torso.position.y = 1.22 + Math.abs(Math.sin(this.fallbackTime * frequency)) * 0.025 * moveAmount;
    this.fallback.torso.rotation.x = 0;
    if (gesture && gestureWeight > 0) {
      const key = gesture.key;
      if (key === 'shoot') this.fallback.rightArm.rotation.x -= 0.65 * gestureWeight;
      if (key === 'reload') {
        this.fallback.rightArm.rotation.x -= 0.45 * gestureWeight;
        this.fallback.leftArm.rotation.x -= 0.3 * gestureWeight;
      }
      if (key === 'shockwave' || key === 'chainLightning') {
        this.fallback.leftArm.rotation.x -= 0.8 * gestureWeight;
        this.fallback.rightArm.rotation.x -= 0.8 * gestureWeight;
        this.fallback.torso.rotation.x = 0.13 * gestureWeight;
      }
      if (key === 'aegis') this.fallback.leftArm.rotation.x -= 0.9 * gestureWeight;
      if (key === 'overdrive') this.fallback.torso.rotation.x = 0.18 * gestureWeight;
      if (key === 'secondWind') {
        this.fallback.leftArm.rotation.x -= 0.45 * gestureWeight;
        this.fallback.rightArm.rotation.x -= 0.45 * gestureWeight;
      }
      if (key === 'interact') {
        this.fallback.leftArm.rotation.x -= 0.5 * gestureWeight;
        this.fallback.rightArm.rotation.x -= 0.5 * gestureWeight;
      }
      if (key === 'death') {
        this.fallback.leftArm.rotation.z = -0.9 * gestureWeight;
        this.fallback.rightArm.rotation.z = 0.9 * gestureWeight;
        this.fallback.torso.rotation.x = 0.3 * gestureWeight;
      } else {
        this.fallback.leftArm.rotation.z = 0;
        this.fallback.rightArm.rotation.z = 0;
      }
    } else {
      this.fallback.leftArm.rotation.z = 0;
      this.fallback.rightArm.rotation.z = 0;
    }
  }

  updateCamera(camera, dt, playerPosition, scene, aiming = false) {
    if (!camera || !playerPosition) return;
    this.cameraTime += dt;
    const pivot = playerPosition.clone();
    pivot.y += aiming ? 1.42 : 1.28;
    const offset = aiming
      ? new THREE.Vector3(1.15, 2.55, 5.75)
      : new THREE.Vector3(0.65, 5.2, 9.4);
    const desired = playerPosition.clone().add(offset);
    const sway = clamp01(this.motion.speed / this.motion.maxSpeed) * (aiming ? 0.32 : 1);
    desired.x += Math.sin(this.cameraTime * 2.4) * 0.022 * sway;
    desired.y += Math.sin(this.cameraTime * 4.8) * 0.012 * sway;
    const direction = desired.clone().sub(pivot);
    const desiredDistance = direction.length();
    direction.normalize();

    this.cameraCheckTimer -= dt;
    if (this.lastCameraAimMode !== aiming) this.cameraCheckTimer = 0;
    if (this.cameraCheckTimer <= 0 && scene) {
      this.cameraRaycaster.set(pivot, direction);
      this.cameraRaycaster.near = 0.15;
      this.cameraRaycaster.far = desiredDistance;
      const candidates = scene.children.filter((object) =>
        object !== this.root && object.visible && !object.userData.noCameraCollision
      );
      const hits = this.cameraRaycaster.intersectObjects(candidates, true);
      const obstruction = hits.find((hit) => hit.distance > 0.2);
      this.cameraSafeDistance = obstruction
        ? Math.max(1.25, obstruction.distance - 0.36)
        : desiredDistance;
      this.cameraCheckTimer = 0.085;
      this.lastCameraAimMode = aiming;
    }

    const safeDistance = this.cameraSafeDistance > 0
      ? Math.min(desiredDistance, this.cameraSafeDistance)
      : desiredDistance;
    desired.copy(pivot).addScaledVector(direction, safeDistance);
    if (this.cameraPosition.lengthSq() === 0) this.cameraPosition.copy(camera.position);
    this.cameraPosition.lerp(desired, 1 - Math.exp(-dt * (aiming ? 12 : 6)));
    camera.position.copy(this.cameraPosition);
    camera.lookAt(
      playerPosition.x + (aiming ? 0.72 : 0),
      playerPosition.y + 1.16,
      playerPosition.z + (aiming ? -5.2 : -4.25)
    );
  }
}
