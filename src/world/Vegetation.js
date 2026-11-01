import * as THREE from 'three';
import { roadCenterX } from './Terrain.js';
import { recordWorldNote } from './AssetDiagnostics.js';

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export class Vegetation {
  constructor({ scene, quality = 'medium', textures, terrain, camera, assetLibrary = null }) {
    this.scene = scene;
    this.quality = quality;
    this.textures = textures;
    this.terrain = terrain;
    this.camera = camera;
    this.assetLibrary = assetLibrary;
    this.meshes = [];
    this.realVegetation = [];
    this.build();
    this.assetLibrary?.ready.then(() => this.addCatalogVegetation()).catch((error) =>
      console.warn('[Project Zero Hour] Real vegetation loading failed:', error)
    );
  }

  build() {
    const random = seeded(2097);
    const treeCount = this.quality === 'high' ? 42 : this.quality === 'medium' ? 28 : 15;
    const shrubCount = this.quality === 'high' ? 120 : this.quality === 'medium' ? 72 : 36;
    const trunkGeometry = new THREE.CylinderGeometry(0.13, 0.30, 1, 8, 1);
    const crownGeometry = new THREE.SphereGeometry(1, 12, 9);
    const clusterGeometry = new THREE.SphereGeometry(1, 10, 8);
    const shrubGeometry = new THREE.IcosahedronGeometry(1, 1);

    const barkMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.bark?.albedo || null,
      roughness: 1
    });
    const leafMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.leaf?.albedo || null,
      roughness: 0.96
    });
    const leafShadeMaterial = new THREE.MeshStandardMaterial({
      color: 0x617044,
      roughness: 1
    });
    const shrubMaterial = new THREE.MeshStandardMaterial({
      color: 0x536e3e,
      roughness: 1
    });

    const trunks = new THREE.InstancedMesh(trunkGeometry, barkMaterial, treeCount);
    const crowns = new THREE.InstancedMesh(crownGeometry, leafMaterial, treeCount);
    const clusters = new THREE.InstancedMesh(clusterGeometry, leafShadeMaterial, treeCount * 2);
    const shrubs = new THREE.InstancedMesh(shrubGeometry, shrubMaterial, shrubCount);
    trunks.name = 'BUNGOMA_3D_TREE_TRUNKS';
    crowns.name = 'BUNGOMA_3D_TREE_CANOPIES';
    clusters.name = 'BUNGOMA_3D_CANOPY_CLUSTERS';
    shrubs.name = 'BUNGOMA_3D_UNDERSTORY_SHRUBS';

    const dummy = new THREE.Object3D();
    const trees = [];
    let placed = 0;
    for (let attempt = 0; attempt < treeCount * 8 && placed < treeCount; attempt++) {
      const side = random() < 0.5 ? -1 : 1;
      const x = side * (12 + random() * 43);
      const z = -122 + random() * 140;
      if (Math.abs(x - roadCenterX(z)) < 11) continue;

      const ground = this.terrain.getHeightAt(x, z);
      const kind = placed % 4;
      const height = kind === 1 ? 7.0 + random() * 2.0 : 4.7 + random() * 2.1;
      const radius = kind === 1 ? 1.35 + random() * 0.6 : 2.0 + random() * 1.0;
      const canopyHeight = kind === 1 ? 1.25 + random() * 0.45 : 0.48 + random() * 0.34;

      dummy.position.set(x, ground + height * 0.48, z);
      dummy.rotation.set(0, random() * Math.PI * 2, 0);
      dummy.scale.set(0.88 + random() * 0.25, height, 0.88 + random() * 0.25);
      dummy.updateMatrix();
      trunks.setMatrixAt(placed, dummy.matrix);

      dummy.position.set(x, ground + height * 0.83, z);
      dummy.rotation.set(0, random() * Math.PI * 2, 0);
      dummy.scale.set(radius, canopyHeight, radius * 0.82);
      dummy.updateMatrix();
      crowns.setMatrixAt(placed, dummy.matrix);

      for (let part = 0; part < 2; part++) {
        const direction = part === 0 ? -1 : 1;
        const index = placed * 2 + part;
        dummy.position.set(
          x + direction * radius * 0.48,
          ground + height * 0.83 + canopyHeight * (kind === 1 ? 0.03 : 0.12),
          z + (random() - 0.5) * radius * 0.35
        );
        dummy.rotation.set(random() * 0.12, random() * Math.PI * 2, random() * 0.12);
        dummy.scale.set(radius * 0.58, canopyHeight * 0.76, radius * 0.57);
        dummy.updateMatrix();
        clusters.setMatrixAt(index, dummy.matrix);
      }

      trees.push({ x, z, ground, height, radius });
      placed++;
    }
    trunks.count = crowns.count = placed;
    clusters.count = placed * 2;
    for (const mesh of [trunks, crowns, clusters]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }

    let shrubPlaced = 0;
    for (let i = 0; i < shrubCount * 4 && shrubPlaced < shrubCount; i++) {
      const side = random() < 0.5 ? -1 : 1;
      const x = side * (7.5 + random() * 27);
      const z = -126 + random() * 145;
      if (Math.abs(x - roadCenterX(z)) < 6.3) continue;
      const y = this.terrain.getHeightAt(x, z);
      const size = 0.35 + random() * 0.82;
      dummy.position.set(x, y + size * 0.55, z);
      dummy.rotation.set(random() * 0.12, random() * Math.PI * 2, random() * 0.12);
      dummy.scale.set(size * 1.2, size * 0.86, size);
      dummy.updateMatrix();
      shrubs.setMatrixAt(shrubPlaced++, dummy.matrix);
    }
    shrubs.count = shrubPlaced;
    shrubs.instanceMatrix.needsUpdate = true;
    shrubs.castShadow = true;
    shrubs.receiveShadow = true;
    this.scene.add(shrubs);
    this.meshes.push(shrubs);

    this.treePositions = trees.map((tree) => ({
      position: new THREE.Vector3(tree.x, tree.ground, tree.z)
    }));
    this.addCatalogVegetation();
    recordWorldNote('Roadside trees, layered canopies and understory use actual 3D instanced geometry with photo-derived bark/leaf materials, not vertical image cutouts.');
  }

  addCatalogVegetation() {
    if (!this.assetLibrary) return;
    for (const item of this.realVegetation) this.assetLibrary.releaseInstance(item.instance);
    this.realVegetation = [];
    const treeKeys = ['acacia', 'eucalyptus', 'mangoTree', 'figTree'].filter((key) => this.assetLibrary.has(key));
    const cropKeys = ['bananaPlant', 'maizePatch', 'sugarcanePatch'].filter((key) => this.assetLibrary.has(key));
    const treeCount = this.quality === 'high' ? 20 : this.quality === 'medium' ? 14 : 8;
    const cropCount = this.quality === 'high' ? 15 : this.quality === 'medium' ? 9 : 4;
    const random = seeded(2097);
    const add = (key, x, z, height, rotation = 0) => {
      const y = this.terrain.getHeightAt(x, z);
      const instance = this.assetLibrary.createInstance(key, {
        position: [x, y, z], targetHeight: height, rotationY: rotation
      });
      if (instance) this.realVegetation.push({ instance, position: new THREE.Vector3(x, y, z) });
    };
    for (let i = 0; i < treeCount && treeKeys.length; i++) {
      const key = treeKeys[i % treeKeys.length];
      const side = random() < 0.5 ? -1 : 1;
      const x = side * (12 + random() * 39);
      const z = -119 + random() * 132;
      if (Math.abs(x - roadCenterX(z)) < 9) continue;
      const height = key === 'acacia' ? 6.2 + random() * 1.4 : key === 'eucalyptus' ? 8 + random() * 2 : 5.4 + random() * 1.2;
      add(key, x, z, height, random() * Math.PI * 2);
    }
    for (let i = 0; i < cropCount && cropKeys.length; i++) {
      const key = cropKeys[i % cropKeys.length];
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (19 + random() * 21);
      const z = -111 + random() * 118;
      if (Math.abs(x - roadCenterX(z)) < 12) continue;
      add(key, x, z, key === 'maizePatch' ? 2.25 : key === 'sugarcanePatch' ? 2.7 : 2.1, random() * Math.PI * 2);
    }
    console.info('[Project Zero Hour] Real near-field vegetation instances:', this.realVegetation.length);
  }

  update(_dt, _elapsed) {
    if (!this.camera) return;
    for (const item of this.realVegetation) {
      const distance = this.camera.position.distanceTo(item.position);
      item.instance.visible = distance < 118;
    }
  }

  setQuality(quality) {
    if (quality === this.quality) return;
    for (const item of this.realVegetation) this.assetLibrary?.releaseInstance(item.instance);
    this.realVegetation = [];
    this.dispose();
    this.quality = quality;
    this.build();
  }

  dispose() {
    for (const item of this.realVegetation) this.assetLibrary?.releaseInstance(item.instance);
    this.realVegetation = [];
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry?.dispose?.();
      mesh.material?.dispose?.();
    }
    this.meshes = [];
  }
}
