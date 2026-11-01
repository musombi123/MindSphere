import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinnedScene } from 'three/addons/utils/SkeletonUtils.js';
import { recordModelLoaded, registerMissingAsset, resolveMissingAsset, registerOptionalAsset, resolveOptionalAsset, updateAssetTask } from './AssetDiagnostics.js';

const CATALOG_URL = 'assets/asset-catalog.json';
const BASE_URL = import.meta.env.BASE_URL || './';

function publicUrl(path) {
  const clean = String(path || '').replace(/^\/+/, '');
  return new URL(clean, new URL(BASE_URL, window.location.href)).href;
}

const EXPECTED_WORLD_MODELS = {
  acacia: 'Acacia tree',
  eucalyptus: 'Eucalyptus tree',
  mangoTree: 'Mango tree',
  figTree: 'Fig tree',
  mudHouse: 'Rural homestead',
  timberFence: 'Timber fence segment',
  bodaBoda: 'Motorcycle',
  rustedPickup: 'Pickup vehicle',
  waterTank: 'Water tank',
  bridge: 'Rural bridge',
  bananaPlant: 'Banana plant',
  maizePatch: 'Maize crop patch',
  sugarcanePatch: 'Sugarcane crop patch',
  crates: 'Supply crates',
  tyres: 'Tyre stack',
  firePit: 'Homestead fire pit',
  stoneWall: 'Masonry boundary wall'
};

function getFile(definition) {
  if (typeof definition === 'string') return definition;
  if (definition && typeof definition.file === 'string') return definition.file;
  return '';
}

function modelMaterialSetup(root) {
  root.traverse((object) => {
    if (!object.isMesh && !object.isSkinnedMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = true;
    if (object.material) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial) {
          material.needsUpdate = true;
        }
      }
    }
  });
}

export class WorldAssetLibrary {
  constructor({ renderer = null, scene = null } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.definitions = new Map();
    this.templates = new Map();
    this.bounds = new Map();
    this.instances = new Set();
    this.errors = new Map();
    this.loading = new Map();
    this.manager = new THREE.LoadingManager();
    this.manager.onProgress = (_url, loaded, total) => updateAssetTask('world-models', {
      label: 'WORLD MODELS', loaded, total, done: total > 0 && loaded >= total
    });
    this.draco = new DRACOLoader(this.manager);
    this.draco.setDecoderPath(publicUrl('decoders/draco/'));
    this.ktx2 = new KTX2Loader(this.manager);
    this.ktx2.setTranscoderPath(publicUrl('decoders/basis/'));
    if (renderer) this.ktx2.detectSupport(renderer);
    this.loader = new GLTFLoader(this.manager);
    this.loader.setDRACOLoader(this.draco);
    this.loader.setKTX2Loader(this.ktx2);
    this.loader.setMeshoptDecoder(MeshoptDecoder);
    this.ready = this.loadCatalog();
  }

  async loadCatalog() {
    let catalog;
    try {
      const response = await fetch(publicUrl(CATALOG_URL), { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      catalog = await response.json();
    } catch (error) {
      const catalogUrl = publicUrl(CATALOG_URL);
      registerMissingAsset(catalogUrl, 'The required runtime asset catalog could not be loaded: ' + error.message);
      console.warn('[Project Zero Hour] Required world asset catalog is not readable:', error.message);
      return this;
    }

    resolveMissingAsset(publicUrl(CATALOG_URL));
    const definitions = catalog?.worldModels && typeof catalog.worldModels === 'object'
      ? catalog.worldModels
      : {};
    for (const [key, definition] of Object.entries(definitions)) {
      const file = getFile(definition);
      if (!file) {
        this.errors.set(key, 'Catalog entry has no file path.');
        continue;
      }
      this.definitions.set(key, { ...((typeof definition === 'object' && definition) || {}), file });
    }

    const mapped = [];
    for (const key of Object.keys(EXPECTED_WORLD_MODELS)) {
      if (this.definitions.has(key)) mapped.push(key);
      else registerOptionalAsset(
        'assets/world/models/' + key + '.glb',
        EXPECTED_WORLD_MODELS[key] + ' has no verified 3D model yet; this authored detail is not present in the current scene.'
      );
    }

    // Keep concurrent GPU uploads/decoder work bounded on entry-level Android devices.
    const concurrency = this.renderer?.capabilities?.isWebGL2 ? 3 : 2;
    for (let offset = 0; offset < mapped.length; offset += concurrency) {
      const batch = mapped.slice(offset, offset + concurrency);
      await Promise.allSettled(batch.map((key) => this.loadModel(key)));
    }
    return this;
  }

  async loadModel(key) {
    if (this.templates.has(key)) return this.templates.get(key);
    if (this.loading.has(key)) return this.loading.get(key);
    const definition = this.definitions.get(key);
    if (!definition) return null;

    const url = /^https?:\/\//i.test(definition.file)
      ? definition.file
      : publicUrl(definition.file);
    const task = (async () => {
      try {
        const gltf = await this.loader.loadAsync(url);
        if (!gltf.scene) throw new Error('GLB/GLTF file did not contain a scene.');
        const template = gltf.scene;
        template.name = 'WORLD_ASSET_' + key;
        modelMaterialSetup(template);
        template.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(template);
        const size = bounds.getSize(new THREE.Vector3());
        if (!Number.isFinite(size.y) || size.y < 0.01) throw new Error('Model has unusable bounds.');
        this.templates.set(key, template);
        this.bounds.set(key, { min: bounds.min.clone(), max: bounds.max.clone(), size });
        recordModelLoaded(url);
        resolveMissingAsset('assets/world/models/' + key + '.glb');
        resolveOptionalAsset('assets/world/models/' + key + '.glb');
        console.info('[Project Zero Hour] World model ready:', key, url);
        return template;
      } catch (error) {
        this.errors.set(key, error.message || String(error));
        registerMissingAsset(url, EXPECTED_WORLD_MODELS[key] + ' failed to load: ' + (error.message || String(error)));
        console.warn('[Project Zero Hour] World model failed:', key, error);
        return null;
      }
    })();
    this.loading.set(key, task);
    const result = await task;
    this.loading.delete(key);
    return result;
  }

  has(key) {
    return this.templates.has(key);
  }

  createInstance(key, {
    position = [0, 0, 0],
    rotationY = 0,
    targetHeight = null,
    scale = 1,
    castShadow = true,
    receiveShadow = true,
    parent = this.scene
  } = {}) {
    const template = this.templates.get(key);
    const sourceBounds = this.bounds.get(key);
    if (!template || !sourceBounds) return null;

    const instance = cloneSkinnedScene(template);
    instance.name = 'WORLD_INSTANCE_' + key.toUpperCase();
    const resolvedScale = Number.isFinite(Number(targetHeight)) && Number(targetHeight) > 0
      ? (Number(targetHeight) / sourceBounds.size.y) * Number(scale || 1)
      : Number(scale || 1);
    instance.scale.multiplyScalar(resolvedScale);
    instance.rotation.y = Number(rotationY) || 0;
    const target = new THREE.Vector3(
      Number(position[0]) || 0,
      Number(position[1]) || 0,
      Number(position[2]) || 0
    );
    instance.position.copy(target);

    // Centre the actual rotated/scaled model on the requested X/Z and align its lowest point to terrain Y.
    instance.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(instance);
    const centre = bounds.getCenter(new THREE.Vector3());
    instance.position.x += target.x - centre.x;
    instance.position.y += target.y - bounds.min.y;
    instance.position.z += target.z - centre.z;
    instance.updateMatrixWorld(true);
    modelMaterialSetup(instance);
    instance.traverse((object) => {
      if (object.isMesh || object.isSkinnedMesh) {
        object.castShadow = castShadow;
        object.receiveShadow = receiveShadow;
      }
    });
    if (parent) parent.add(instance);
    this.instances.add(instance);
    return instance;
  }

  releaseInstance(instance) {
    if (!instance) return;
    instance.parent?.remove(instance);
    this.instances.delete(instance);
  }

  dispose() {
    for (const instance of this.instances) instance.parent?.remove(instance);
    this.instances.clear();
    this.draco.dispose();
    this.ktx2.dispose();
    this.templates.clear();
    this.bounds.clear();
  }
}
