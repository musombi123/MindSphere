import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
  'jump', 'fall', 'land', 'aimIdle', 'shoot', 'reload', 'hit', 'death',
  'interact', 'shockwave', 'aegis', 'overdrive', 'chainLightning', 'secondWind'
];

const CLIP_RULES = [
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
    this.loaded = false;
    this.dead = false;
    this.actions = new Map();
    this.actionWeights = new Map();
    this.oneShotAction = null;
    this.oneShotKey = '';
    this.weaponSocket = null;
    this.fallbackGesture = null;
    this.fallbackTime = 0;
    this.motion = { moveX: 0, moveZ: 0, speed: 0, maxSpeed: 9.2, sprinting: false, aiming: false };
    this.cameraRaycaster = new THREE.Raycaster();
    this.cameraPosition = new THREE.Vector3();
    this.cameraSafeDistance = 0;
    this.cameraCheckTimer = 0;
    this.lastCameraAimMode = null;
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
    this.onProgress({
      percent: clamp01(Number(percent) / 100) * 100,
      message: message || 'INITIALISING AEGIS CHARACTER'
    });
  }

  async assetExists(url) {
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async load(url = CHARACTER_URL) {
    if (!this.root) throw new Error('PlayerController.attachRoot(root) must be called before load().');
    const modelUrl = /^https?:\/\//i.test(url) ? url : publicAssetUrl(url);
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
      if (!(await this.assetExists(modelUrl))) {
        throw new Error('Required asset is missing: ' + modelUrl);
      }

      this.reportProgress(5, 'DECODING HUMANOID MESH');
      const gltf = await loader.loadAsync(modelUrl, (event) => {
        if (event && event.total > 0) {
          this.reportProgress(5 + (event.loaded / event.total) * 80, 'DOWNLOADING PLAYER MODEL');
        }
      });

      this.avatar = cloneSkinnedScene(gltf.scene);
      this.avatar.name = 'ZERO_HUMANOID_RIG';
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
      const clips = [...(gltf.animations || [])];
      clips.push(...await this.loadExternalAnimationClips(loader));
      this.createAnimationActions(clips);

      this.reportProgress(100, 'AEGIS RIG READY');
      this.onStatus({ type: 'ready', message: 'RIGGED PLAYER MODEL READY' });
      return true;
    } catch (error) {
      this.activateFallback();
      this.reportProgress(100, 'MODEL UNAVAILABLE · TEMPORARY PROXY ACTIVE');
      this.onStatus({
        type: 'fallback',
        message: 'Temporary character active. Add public/assets/characters/player.glb.'
      });
      console.warn(
        '[Project Zero Hour] Rigged player model is not available at ' + modelUrl +
        '. The game is using a temporary non-box humanoid proxy. Add a rigged GLB to enable the real character and its AnimationMixer clips.',
        error && error.message ? error.message : error
      );
      return false;
    } finally {
      dracoLoader.dispose();
      ktx2Loader.dispose();
    }
  }

  normaliseAvatar(avatar) {
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

      const results = await Promise.all(entries.map(async ([key, value]) => {
        const definition = typeof value === 'string' ? { file: value } : value;
        if (!definition || !definition.file) return null;
        const file = /^https?:\/\//i.test(definition.file)
          ? definition.file
          : publicAssetUrl(definition.file.startsWith('/')
            ? definition.file.slice(1)
            : 'assets/animations/' + definition.file);
        try {
          const clipGltf = await loader.loadAsync(file);
          const expected = definition.clipName ? normaliseName(definition.clipName) : normaliseName(key);
          const sourceClip = (clipGltf.animations || []).find((clip) => normaliseName(clip.name) === expected)
            || (clipGltf.animations || [])[0];
          if (!sourceClip) {
            console.warn('[Project Zero Hour] Animation file has no animation clip:', file);
            return null;
          }
          const clip = sourceClip.clone();
          clip.name = key;
          return clip;
        } catch (error) {
          console.warn('[Project Zero Hour] Optional animation clip could not be loaded:', file, error.message);
          return null;
        }
      }));
      return results.filter(Boolean);
    } catch (error) {
      // The manifest is optional for artists who pack clips directly into player.glb.
      return [];
    }
  }

  createAnimationActions(clips) {
    this.actions.clear();
    this.actionWeights.clear();
    if (!this.avatar) return;

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

    (clips || []).forEach((clip) => {
      const key = resolveClipKey(clip.name);
      if (!key || this.actions.has(key)) return;
      this.actions.set(key, this.avatarMixer.clipAction(clip));
    });

    const missing = REQUIRED_CLIPS.filter((key) => !this.actions.has(key));
    if (missing.length) {
      console.warn(
        '[Project Zero Hour] player.glb loaded, but these animation states have no matching clips: ' +
        missing.join(', ') + '. Embed named clips in player.glb or register compatible GLB clips in public/assets/animations/manifest.json.'
      );
    }
    this.onStatus({ type: 'animations', message: this.actions.size + ' animation states mapped' });
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

  setLocomotion({ moveX = 0, moveZ = 0, speed = 0, maxSpeed = 9.2, sprinting = false, aiming = false } = {}) {
    this.motion.moveX = moveX;
    this.motion.moveZ = moveZ;
    this.motion.speed = Math.max(0, speed);
    this.motion.maxSpeed = Math.max(1, maxSpeed);
    this.motion.sprinting = Boolean(sprinting);
    this.motion.aiming = Boolean(aiming);
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

    if (motion.aiming && intensity < 0.05 && this.actions.has('aimIdle')) {
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

    const total = Array.from(desired.values()).reduce((sum, value) => sum + value, 0);
    const blend = clamp01(dt * 8);
    const allActions = new Set(this.actions.values());
    allActions.forEach((action) => {
      const targetWeight = total > 0 ? (desired.get(action) || 0) / total : 0;
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
    const pivot = playerPosition.clone();
    pivot.y += aiming ? 1.42 : 1.28;
    const offset = aiming
      ? new THREE.Vector3(1.15, 2.55, 5.75)
      : new THREE.Vector3(0.65, 5.2, 9.4);
    const desired = playerPosition.clone().add(offset);
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
