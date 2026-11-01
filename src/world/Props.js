import * as THREE from 'three';
import { roadCenterX } from './Terrain.js';
import { recordWorldNote } from './AssetDiagnostics.js';

export class Props {
  constructor({ scene, terrain, textures, quality = 'medium', camera, assetLibrary = null }) {
    this.scene = scene;
    this.terrain = terrain;
    this.textures = textures;
    this.quality = quality;
    this.camera = camera;
    this.assetLibrary = assetLibrary;
    this.meshes = [];
    this.realInstances = [];
    this.proxyGroups = [];
    this.materials = this.createMaterials();
    this.build();
    this.assetLibrary?.ready.then(() => this.addCatalogWorldModels()).catch((error) =>
      console.warn('[Project Zero Hour] World prop loading failed:', error)
    );
  }

  createMaterials() {
    return {
      mud: new THREE.MeshStandardMaterial({ color: 0x8b7354, map: this.textures.mud?.albedo, roughness: 0.98 }),
      mudDark: new THREE.MeshStandardMaterial({ color: 0x594b39, roughness: 1 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x59636a, roughness: 0.78, metalness: 0.28 }),
      roofRib: new THREE.MeshStandardMaterial({ color: 0x343f45, roughness: 0.72, metalness: 0.35 }),
      wood: new THREE.MeshStandardMaterial({ color: 0xffffff, map: this.textures.wood?.albedo, roughness: 0.94 }),
      timberDark: new THREE.MeshStandardMaterial({ color: 0x463727, map: this.textures.bark?.albedo, roughness: 1 }),
      door: new THREE.MeshStandardMaterial({ color: 0x403326, roughness: 0.95 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x263f45, roughness: 0.28, metalness: 0.08 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x58666b, roughness: 0.58, metalness: 0.55 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x151819, roughness: 0.96 }),
      vehicle: new THREE.MeshStandardMaterial({ color: 0x4a5945, roughness: 0.78, metalness: 0.16 }),
      tank: new THREE.MeshStandardMaterial({ color: 0x4d6c69, roughness: 0.82, metalness: 0.1 }),
      stone: new THREE.MeshStandardMaterial({ color: 0x625c4e, map: this.textures.rock?.albedo, roughness: 1 })
    };
  }

  addMesh(geometry, material, parent, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }

  addBox(parent, size, material, position, rotation = [0, 0, 0]) {
    return this.addMesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material, parent, position, rotation);
  }

  addHouse(x, z, yaw = 0, variant = 0) {
    const y = this.terrain.getHeightAt(x, z);
    const group = new THREE.Group();
    group.name = 'BUNGOMA_RURAL_MUD_HOMESTEAD';
    group.position.set(x, y, z);
    group.rotation.y = yaw;
    this.scene.add(group);
    this.proxyGroups.push({ key: 'mudHouse', group });

    const width = variant ? 5.4 : 6.2;
    const depth = variant ? 4.5 : 5.1;
    const wallHeight = variant ? 2.55 : 2.8;
    this.addBox(group, [width, wallHeight, depth], this.materials.mud, [0, wallHeight * 0.5 + 0.12, 0]);
    this.addBox(group, [width + 0.25, 0.18, depth + 0.25], this.materials.mudDark, [0, 0.15, 0]);

    const gable = new THREE.Shape();
    gable.moveTo(-width * 0.5, 0);
    gable.lineTo(width * 0.5, 0);
    gable.lineTo(0, 1.45);
    gable.lineTo(-width * 0.5, 0);
    const gableGeometry = new THREE.ShapeGeometry(gable);
    this.addMesh(gableGeometry, this.materials.mud, group, [0, wallHeight + 0.12, depth * 0.5 + 0.005]);
    const rearGable = this.addMesh(gableGeometry.clone(), this.materials.mud, group, [0, wallHeight + 0.12, -depth * 0.5 - 0.005]);
    rearGable.rotation.y = Math.PI;

    const roofY = wallHeight + 0.9;
    const roofWidth = width * 0.57;
    this.addBox(group, [roofWidth, 0.14, depth + 0.65], this.materials.roof, [-width * 0.25, roofY - 0.15, 0], [0, 0, 0.43]);
    this.addBox(group, [roofWidth, 0.14, depth + 0.65], this.materials.roof, [width * 0.25, roofY - 0.15, 0], [0, 0, -0.43]);


    const frontZ = depth * 0.5 + 0.075;
    this.addBox(group, [0.95, 1.95, 0.10], this.materials.door, [0, 1.12, frontZ]);
    this.addBox(group, [0.12, 0.12, 0.06], this.materials.metal, [0.32, 1.15, frontZ + 0.06]);
    for (const side of [-1, 1]) {
      this.addBox(group, [0.82, 0.72, 0.10], this.materials.glass, [side * width * 0.31, 1.78, frontZ]);
      this.addBox(group, [0.96, 0.09, 0.13], this.materials.mudDark, [side * width * 0.31, 2.2, frontZ]);
    }
    return group;
  }

  buildFence() {
    const group = new THREE.Group();
    group.name = 'PROCEDURAL_TIMBER_FENCE_PROXY';
    this.scene.add(group);
    this.proxyGroups.push({ key: 'timberFence', group });

    const sections = this.quality === 'high' ? 19 : this.quality === 'medium' ? 15 : 10;
    const startZ = 18;
    const endZ = -121;
    const step = (startZ - endZ) / sections;
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.17, 1.55, 0.17), this.materials.timberDark, (sections + 1) * 2);
    const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.16, 1), this.materials.wood, sections * 4);
    const braces = new THREE.InstancedMesh(new THREE.BoxGeometry(0.10, 0.10, 1), this.materials.timberDark, Math.ceil(sections / 2) * 2);
    posts.name = 'FENCE_POST_INSTANCES';
    rails.name = 'FENCE_RAIL_INSTANCES';
    braces.name = 'FENCE_BRACE_INSTANCES';

    const dummy = new THREE.Object3D();
    let postIndex = 0, railIndex = 0, braceIndex = 0;
    for (const side of [-1, 1]) {
      const points = [];
      for (let i = 0; i <= sections; i++) {
        const z = startZ - i * step;
        const x = roadCenterX(z) + side * 9.4;
        const y = this.terrain.getHeightAt(x, z);
        points.push({ x, z, y });
        dummy.position.set(x, y + 0.78, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        posts.setMatrixAt(postIndex++, dummy.matrix);
      }
      for (let i = 0; i < sections; i++) {
        const a = points[i], b = points[i + 1];
        const midX = (a.x + b.x) * 0.5;
        const midZ = (a.z + b.z) * 0.5;
        const midY = (a.y + b.y) * 0.5;
        const length = Math.hypot(b.x - a.x, b.z - a.z) + 0.12;
        const yaw = Math.atan2(b.x - a.x, b.z - a.z);
        for (const height of [0.55, 1.18]) {
          dummy.position.set(midX, midY + height, midZ);
          dummy.rotation.set(0, yaw, 0);
          dummy.scale.set(1, 1, length);
          dummy.updateMatrix();
          rails.setMatrixAt(railIndex++, dummy.matrix);
        }
        if (i % 2 === 0) {
          dummy.position.set(midX, midY + 0.88, midZ);
          dummy.rotation.set(0, yaw, side > 0 ? 0.13 : -0.13);
          dummy.scale.set(1, 1, length * 0.78);
          dummy.updateMatrix();
          braces.setMatrixAt(braceIndex++, dummy.matrix);
        }
      }
    }
    posts.count = postIndex;
    rails.count = railIndex;
    braces.count = braceIndex;
    for (const mesh of [posts, rails, braces]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      this.meshes.push(mesh);
    }
  }

  addWaterTank(x, z) {
    const group = new THREE.Group();
    group.name = 'RURAL_POLY_WATER_TANK';
    const y = this.terrain.getHeightAt(x, z);
    group.position.set(x, y, z);
    this.scene.add(group);
    this.proxyGroups.push({ key: 'waterTank', group });
    this.addMesh(new THREE.CylinderGeometry(1.0, 1.12, 2.25, 18, 1), this.materials.tank, group, [0, 1.35, 0]);
    this.addMesh(new THREE.SphereGeometry(1.0, 18, 9, 0, Math.PI * 2, 0, Math.PI * 0.5), this.materials.tank, group, [0, 2.48, 0]);
    for (let i = 0; i < 4; i++) {
      const angle = i / 4 * Math.PI * 2;
      this.addMesh(new THREE.CylinderGeometry(0.065, 0.09, 1.0, 8), this.materials.metal, group,
        [Math.cos(angle) * 0.82, 0.55, Math.sin(angle) * 0.82]);
    }
  }

  addPickup(x, z) {
    const group = new THREE.Group();
    group.name = 'RURAL_UTILITY_PICKUP';
    group.position.set(x, this.terrain.getHeightAt(x, z), z);
    this.scene.add(group);
    this.proxyGroups.push({ key: 'rustedPickup', group });
    this.addBox(group, [2.05, 0.62, 4.05], this.materials.vehicle, [0, 0.95, 0]);
    this.addBox(group, [1.92, 1.15, 1.72], this.materials.vehicle, [0, 1.78, 0.58]);
    this.addBox(group, [1.76, 0.72, 0.08], this.materials.glass, [0, 1.91, 1.46]);
    this.addBox(group, [1.78, 0.66, 0.08], this.materials.glass, [0, 1.89, -0.32]);
    this.addBox(group, [1.92, 0.18, 1.7], this.materials.vehicle, [0, 2.4, 0.58]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      this.addMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.27, 14), this.materials.rubber, group,
        [sx * 1.02, 0.52, sz * 1.32], [0, 0, Math.PI * 0.5]);
      this.addMesh(new THREE.CylinderGeometry(0.20, 0.20, 0.29, 12), this.materials.metal, group,
        [sx * 1.02, 0.52, sz * 1.32], [0, 0, Math.PI * 0.5]);
    }
    this.addBox(group, [0.14, 0.22, 0.12], this.materials.metal, [-0.76, 0.95, 2.08]);
    this.addBox(group, [0.14, 0.22, 0.12], this.materials.metal, [0.76, 0.95, 2.08]);
  }

  addBoda(x, z) {
    const group = new THREE.Group();
    group.name = 'BODA_BODA_MOTORCYCLE';
    group.position.set(x, this.terrain.getHeightAt(x, z), z);
    this.scene.add(group);
    this.proxyGroups.push({ key: 'bodaBoda', group });
    for (const wz of [-0.88, 0.88]) {
      this.addMesh(new THREE.TorusGeometry(0.39, 0.075, 8, 18), this.materials.rubber, group,
        [0, 0.43, wz], [0, Math.PI * 0.5, 0]);
      this.addMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 10), this.materials.metal, group,
        [0, 0.43, wz], [0, 0, Math.PI * 0.5]);
    }
    this.addBox(group, [0.12, 0.10, 1.35], this.materials.metal, [0, 0.76, 0]);
    this.addBox(group, [0.44, 0.18, 0.62], this.materials.vehicle, [0, 0.95, 0.02]);
    this.addBox(group, [0.36, 0.13, 0.55], this.materials.door, [0, 1.13, -0.18]);
    this.addBox(group, [0.84, 0.075, 0.08], this.materials.metal, [0, 1.25, 0.67]);
    this.addMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.65, 8), this.materials.metal, group,
      [0, 1.15, 0.64], [Math.PI * 0.5, 0, 0]);
  }

  build() {
    this.buildFence();

    // Three-dimensional rural homesteads are used instead of billboard photographs.
    const houses = [
      { z: 7, side: -1, variant: 0 },
      { z: -43, side: 1, variant: 1 },
      { z: -94, side: -1, variant: 0 }
    ];
    for (const site of houses) {
      const x = roadCenterX(site.z) + site.side * (19 + (Math.abs(site.z) % 4));
      const yaw = site.side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      this.addHouse(x, site.z, yaw, site.variant);
    }

    this.addBoda(roadCenterX(-7) - 15, -7);
    this.addPickup(roadCenterX(-71) + 20, -71);
    this.addWaterTank(roadCenterX(-35) - 21, -35);

    const crate = new THREE.Group();
    crate.position.set(roadCenterX(-18) + 12, this.terrain.getHeightAt(roadCenterX(-18) + 12, -18), -18);
    this.scene.add(crate);
    this.proxyGroups.push({ key: 'crates', group: crate });
    this.addBox(crate, [0.92, 0.78, 0.82], this.materials.wood, [0, 0.39, 0]);
    this.addBox(crate, [0.96, 0.08, 0.08], this.materials.timberDark, [0, 0.39, 0.43]);
    this.addBox(crate, [0.08, 0.82, 0.08], this.materials.timberDark, [-0.42, 0.39, 0]);

    recordWorldNote('Roadside fencing, homesteads, a boda boda, pickup and water tank use three-dimensional meshes rather than flat photo panels.');
    recordWorldNote('Near-field structures are authored procedural proxies; replace them with scanned or licensed photoreal models as those become available.');
  }

  addCatalogWorldModels() {
    if (!this.assetLibrary) return;
    for (const instance of this.realInstances) this.assetLibrary.releaseInstance(instance);
    this.realInstances = [];
    const place = (key, x, z, { height = 1.5, rotation = 0, scale = 1 } = {}) => {
      if (!this.assetLibrary.has(key)) return null;
      const y = this.terrain.getHeightAt(x, z);
      const instance = this.assetLibrary.createInstance(key, { position: [x, y, z], targetHeight: height, rotationY: rotation, scale });
      if (instance) this.realInstances.push(instance);
      return instance;
    };

    // Authored GLBs supersede only their matching procedural proxy.
    for (const proxy of this.proxyGroups) {
      if (this.assetLibrary.has(proxy.key)) proxy.group.visible = false;
    }

    if (this.assetLibrary.has('mudHouse')) {
      for (const site of [{ z: 7, side: -1 }, { z: -43, side: 1 }, { z: -94, side: -1 }]) {
        const x = roadCenterX(site.z) + site.side * (19 + (Math.abs(site.z) % 4));
        place('mudHouse', x, site.z, { height: 3.9, rotation: site.side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5 });
      }
    }
    if (this.assetLibrary.has('timberFence')) {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 15; i++) {
          const z = 18 - i * 9.25;
          place('timberFence', roadCenterX(z) + side * 9.4, z, { height: 1.55, rotation: Math.PI / 2 });
        }
      }
    }
    place('bodaBoda', roadCenterX(-7) - 15, -7, { height: 1.35, rotation: Math.PI * 0.45 });
    place('rustedPickup', roadCenterX(-71) + 20, -71, { height: 1.95, rotation: -Math.PI * 0.5 });
    place('waterTank', roadCenterX(-35) - 21, -35, { height: 2.8 });
    place('crates', roadCenterX(-18) + 12, -18, { height: 0.78 });
    place('stoneWall', roadCenterX(-91) + 17, -91, { height: 1.65, rotation: Math.PI / 2 });
  }

  update() {}

  setQuality(quality) {
    if (quality === this.quality) return;
    for (const instance of this.realInstances) this.assetLibrary?.releaseInstance(instance);
    this.realInstances = [];
    this.dispose();
    this.quality = quality;
    this.materials = this.createMaterials();
    this.build();
    this.addCatalogWorldModels();
  }

  dispose() {
    for (const instance of this.realInstances) this.assetLibrary?.releaseInstance(instance);
    this.realInstances = [];
    for (const mesh of this.meshes) {
      mesh.parent?.remove(mesh);
      mesh.geometry?.dispose?.();
    }
    this.meshes = [];
    for (const proxy of this.proxyGroups) this.scene.remove(proxy.group);
    this.proxyGroups = [];
    for (const material of Object.values(this.materials || {})) material.dispose();
  }
}
