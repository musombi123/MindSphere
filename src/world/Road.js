import * as THREE from 'three';
import { roadCenterX } from './Terrain.js';

export class Road {
  constructor({ scene, terrain, textures, quality = 'medium' }) {
    this.scene = scene;
    this.terrain = terrain;
    this.textures = textures;
    this.quality = quality;
    this.width = 9.2;
    const points = [];
    for (let z = 27; z >= -128; z -= 7) points.push(new THREE.Vector3(roadCenterX(z), terrain.getHeightAt(roadCenterX(z), z) + 0.06, z));
    points.push(new THREE.Vector3(roadCenterX(-132), terrain.getHeightAt(roadCenterX(-132), -132) + 0.06, -132));
    this.curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.24);
    this.meshes = [];
    this.buildSurface();
    this.buildRuts();
    this.buildEdges();
    this.buildPuddles();
    this.buildRoadsideStone();
  }

  sample(t) {
    const point = this.curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1));
    point.y = this.terrain.getHeightAt(point.x, point.z) + 0.07;
    return point;
  }
  frameAt(t) {
    const center = this.sample(t);
    const tangent = this.curve.getTangentAt(THREE.MathUtils.clamp(t, 0, 1)).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    return { center, tangent, side };
  }
  buildRibbonGeometry(width, sideOffset = 0, sections = 220, acrossSteps = 6, yOffset = 0.035) {
    const positions = [], uvs = [], indices = [];
    for (let zi = 0; zi <= sections; zi++) {
      const t = zi / sections;
      const { center, side } = this.frameAt(t);
      for (let xi = 0; xi <= acrossSteps; xi++) {
        const across = xi / acrossSteps - 0.5;
        const x = center.x + side.x * (sideOffset + across * width);
        const z = center.z + side.z * (sideOffset + across * width);
        positions.push(x, this.terrain.getHeightAt(x, z) + yOffset, z);
        uvs.push(t * this.curve.getLength() / 3.8, xi / acrossSteps);
        if (zi < sections && xi < acrossSteps) {
          const a = zi * (acrossSteps + 1) + xi, b = a + acrossSteps + 1;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
  addMesh(geometry, material, name) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);
    return mesh;
  }
  buildSurface() {
    const material = new THREE.MeshStandardMaterial({
      map: this.textures.road.albedo,
      normalMap: this.textures.road.normal,
      normalScale: new THREE.Vector2(0.9, 0.8),
      roughnessMap: this.textures.road.roughness,
      roughness: 0.96,
      metalness: 0.01
    });
    this.addMesh(this.buildRibbonGeometry(this.width, 0, this.quality === 'high' ? 300 : 220, 12, 0.04), material, 'WINDING_LATERITE_ROAD');
  }
  buildRuts() {
    const rut = new THREE.MeshStandardMaterial({
      color: 0x542e25, map: this.textures.mud.albedo,
      normalMap: this.textures.mud.normal, roughnessMap: this.textures.mud.roughness,
      roughness: 1, transparent: true, opacity: 0.48,
      polygonOffset: true, polygonOffsetFactor: -1
    });
    this.addMesh(this.buildRibbonGeometry(0.17, -1.15, 210, 2, 0.065), rut, 'ROAD_TYRE_RUT_LEFT');
    this.addMesh(this.buildRibbonGeometry(0.17, 1.15, 210, 2, 0.065), rut.clone(), 'ROAD_TYRE_RUT_RIGHT');
    const erosion = new THREE.MeshStandardMaterial({ color: 0x75503a, map: this.textures.laterite.albedo, roughness: 1 });
    this.addMesh(this.buildRibbonGeometry(0.65, -this.width * 0.5 - 0.28, 210, 3, 0.045), erosion, 'ERODED_ROAD_EDGE_LEFT');
    this.addMesh(this.buildRibbonGeometry(0.65, this.width * 0.5 + 0.28, 210, 3, 0.045), erosion.clone(), 'ERODED_ROAD_EDGE_RIGHT');
  }
  buildEdges() {
    const vergeMat = new THREE.MeshStandardMaterial({
      color: 0x465b33, map: this.textures.grass.albedo,
      normalMap: this.textures.grass.normal, roughness: 1,
      transparent: true, opacity: 0.92
    });
    this.addMesh(this.buildRibbonGeometry(1.4, -this.width * 0.5 - 1.05, 180, 3, 0.012), vergeMat, 'ROAD_GRASS_VERGE_LEFT');
    this.addMesh(this.buildRibbonGeometry(1.4, this.width * 0.5 + 1.05, 180, 3, 0.012), vergeMat.clone(), 'ROAD_GRASS_VERGE_RIGHT');
  }
  buildPuddles() {
    const puddleMat = new THREE.MeshPhysicalMaterial({
      color: 0x394d4f, roughness: 0.16, metalness: 0.12,
      clearcoat: 0.8, clearcoatRoughness: 0.12, transparent: true,
      opacity: 0.62, depthWrite: false
    });
    const count = this.quality === 'high' ? 14 : this.quality === 'medium' ? 9 : 4;
    for (let i = 0; i < count; i++) {
      const t = 0.13 + (i / count) * 0.78;
      const { center, tangent, side } = this.frameAt(t);
      const offset = (i % 2 ? 1 : -1) * (0.5 + (i % 3) * 0.6);
      const x = center.x + side.x * offset, z = center.z + side.z * offset;
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 24), puddleMat.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.atan2(tangent.x, -tangent.z);
      mesh.position.set(x, this.terrain.getHeightAt(x, z) + 0.095, z);
      mesh.scale.set(0.35 + (i % 3) * 0.18, 0.55 + (i % 4) * 0.22, 1);
      mesh.receiveShadow = true;
      mesh.name = 'ROAD_PUDDLE_' + i;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }
  buildRoadsideStone() {
    const geometry = new THREE.DodecahedronGeometry(0.13, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x736c5b, map: this.textures.rock.albedo, normalMap: this.textures.rock.normal, roughness: 0.95 });
    const count = this.quality === 'high' ? 190 : this.quality === 'medium' ? 120 : 55;
    const stones = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    let placed = 0;
    for (let i = 0; i < count; i++) {
      const t = (i + Math.random() * 0.75) / count;
      const { center, side } = this.frameAt(t);
      const sign = Math.random() > 0.5 ? 1 : -1;
      const offset = sign * (this.width * 0.5 + 0.25 + Math.random() * 1.5);
      const x = center.x + side.x * offset, z = center.z + side.z * offset;
      dummy.position.set(x, this.terrain.getHeightAt(x, z) + 0.045, z);
      dummy.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.4);
      const scale = 0.45 + Math.random() * 1.65;
      dummy.scale.set(scale, scale * (0.5 + Math.random() * 0.4), scale * (0.75 + Math.random() * 0.6));
      dummy.updateMatrix();
      stones.setMatrixAt(placed++, dummy.matrix);
    }
    stones.count = placed;
    stones.instanceMatrix.needsUpdate = true;
    stones.receiveShadow = true;
    stones.name = 'ROAD_EDGE_SCATTERED_STONES';
    this.scene.add(stones);
    this.meshes.push(stones);
  }
  createPhaseOverlay(material) {
    return this.addMesh(this.buildRibbonGeometry(this.width * 0.67, 0, 180, 8, 0.105), material, 'PHASE_DUPLICATE_ROAD_OVERLAY');
  }
  getPointAt(t) { return this.sample(t); }
  getCenterXAtZ(z) { return roadCenterX(z); }
  update(_dt, _elapsed) {}
  setQuality(quality) {
    if (quality === this.quality) return;
    this.dispose();
    this.quality = quality;
    this.buildSurface(); this.buildRuts(); this.buildEdges(); this.buildPuddles(); this.buildRoadsideStone();
  }
  dispose() {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry?.dispose?.();
      if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
      else mesh.material?.dispose?.();
    }
    this.meshes.length = 0;
  }
}
