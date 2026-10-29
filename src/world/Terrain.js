import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh';
import { loadOptionalPbrMaps } from './TextureFactory.js';

const WORLD_WIDTH = 148;
const WORLD_NEAR_Z = 29;
const WORLD_FAR_Z = -132;

export function roadCenterX(z) {
  return Math.sin((z + 5) * 0.055) * 1.75 + Math.sin(z * 0.15) * 0.55;
}
export function heightAtWorld(x, z) {
  const laneDistance = Math.abs(x - roadCenterX(z));
  const laneFlatten = THREE.MathUtils.smoothstep(laneDistance, 3.6, 8.4);
  const hills =
    Math.sin((x + 17) * 0.034) * Math.cos((z + 18) * 0.028) * 1.8 +
    Math.sin(x * 0.071 + z * 0.043) * 0.63 +
    Math.cos(x * 0.024 - z * 0.061) * 0.55 +
    Math.sin((x - z) * 0.092) * 0.19;
  const farmlandRoll = Math.sin(x * 0.018 + z * 0.028) * 1.15 + Math.cos(x * 0.043 + z * 0.013) * 0.62;
  return (hills + farmlandRoll) * laneFlatten * 0.74;
}

export class Terrain {
  constructor({ scene, quality = 'medium', textures }) {
    this.scene = scene;
    this.quality = quality;
    this.textures = textures;
    this.width = WORLD_WIDTH;
    this.nearZ = WORLD_NEAR_Z;
    this.farZ = WORLD_FAR_Z;
    this.mesh = null;
    this.heightRaycaster = new THREE.Raycaster();
    this.down = new THREE.Vector3(0, -1, 0);
    this.build();
    for (const name of ['laterite', 'grass', 'dryGrass', 'rock', 'mud']) this.installOptionalTexture(name);
  }

  build() {
    const segmentsX = this.quality === 'high' ? 220 : this.quality === 'medium' ? 168 : 112;
    const segmentsZ = this.quality === 'high' ? 250 : this.quality === 'medium' ? 190 : 128;
    const positions = [], uvs = [], indices = [];
    for (let zi = 0; zi <= segmentsZ; zi++) {
      const v = zi / segmentsZ;
      const z = this.nearZ + (this.farZ - this.nearZ) * v;
      for (let xi = 0; xi <= segmentsX; xi++) {
        const u = xi / segmentsX;
        const x = -this.width / 2 + this.width * u;
        positions.push(x, heightAtWorld(x, z), z);
        uvs.push(x / 5.5, z / 5.5);
        if (xi < segmentsX && zi < segmentsZ) {
          const a = zi * (segmentsX + 1) + xi, b = a + segmentsX + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundsTree = computeBoundsTree;
    geometry.computeBoundsTree({ maxLeafTris: 12 });

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.95, metalness: 0,
      normalMap: this.textures.grass.normal,
      normalScale: new THREE.Vector2(0.4, 0.4),
      roughnessMap: this.textures.grass.roughness
    });
    this.patchSplatShader(material);
    material.userData.splatUniforms = null;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'BUNGOMA_HEIGHTFIELD_BVH';
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = true;
    this.mesh.raycast = acceleratedRaycast;
    this.scene.add(this.mesh);
  }

  patchSplatShader(material) {
    const maps = this.textures;
    material.onBeforeCompile = (shader) => {
      const uniforms = {
        uGrassMap: { value: maps.grass.albedo },
        uLateriteMap: { value: maps.laterite.albedo },
        uDryGrassMap: { value: maps.dryGrass.albedo },
        uRockMap: { value: maps.rock.albedo },
        uMudMap: { value: maps.mud.albedo }
      };
      Object.assign(shader.uniforms, uniforms);
      material.userData.splatUniforms = shader.uniforms;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\\nvarying vec3 vTerrainWorldPos;\\nvarying float vTerrainSlope;'
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\\nvTerrainSlope = 1.0 - abs(normal.y);'
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\\nvTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\\nvarying vec3 vTerrainWorldPos;\\nvarying float vTerrainSlope;\\nuniform sampler2D uGrassMap;\\nuniform sampler2D uLateriteMap;\\nuniform sampler2D uDryGrassMap;\\nuniform sampler2D uRockMap;\\nuniform sampler2D uMudMap;\\nfloat terrainHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }\\nfloat terrainNoise(vec2 p) { vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f); float a=terrainHash(i); float b=terrainHash(i+vec2(1.0,0.0)); float c=terrainHash(i+vec2(0.0,1.0)); float d=terrainHash(i+vec2(1.0,1.0)); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }'
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\\nvec2 terrainUv=vTerrainWorldPos.xz*0.095;\\nfloat terrainGrain=terrainNoise(vTerrainWorldPos.xz*0.19);\\nfloat terrainSlope=clamp(vTerrainSlope,0.0,1.0);\\nfloat terrainRockWeight=smoothstep(0.20,0.53,terrainSlope)*(0.42+0.48*terrainGrain);\\nfloat terrainLowland=1.0-smoothstep(-0.15,0.85,vTerrainWorldPos.y);\\nfloat terrainMudWeight=terrainLowland*smoothstep(0.38,0.78,terrainGrain)*0.22;\\nfloat terrainSoilWeight=smoothstep(0.23,0.69,terrainGrain+0.16)*(1.0-terrainRockWeight)*0.53;\\nfloat terrainDryWeight=smoothstep(0.48,0.80,terrainGrain)*(1.0-terrainRockWeight)*0.27;\\nfloat terrainGrassWeight=max(0.04,1.0-terrainRockWeight-terrainMudWeight-terrainSoilWeight-terrainDryWeight);\\nfloat terrainTotal=max(0.001,terrainGrassWeight+terrainSoilWeight+terrainDryWeight+terrainRockWeight+terrainMudWeight);\\nvec3 terrainColor=texture2D(uGrassMap,terrainUv*0.82).rgb*terrainGrassWeight+texture2D(uLateriteMap,terrainUv*1.31).rgb*terrainSoilWeight+texture2D(uDryGrassMap,terrainUv*0.72).rgb*terrainDryWeight+texture2D(uRockMap,terrainUv*1.46).rgb*terrainRockWeight+texture2D(uMudMap,terrainUv*1.15).rgb*terrainMudWeight;\\ndiffuseColor.rgb=terrainColor/terrainTotal;\\nroughnessFactor=clamp(roughnessFactor+terrainRockWeight*0.08+terrainMudWeight*0.05,0.54,1.0);'
      );
    };
    material.customProgramCacheKey = () => 'bungoma-terrain-splat-v3';
    material.needsUpdate = true;
  }

  async installOptionalTexture(name) {
    const fallback = this.textures[name];
    await loadOptionalPbrMaps(name, fallback, (loaded) => {
      this.textures[name] = loaded;
      const mapNames = { grass: 'uGrassMap', laterite: 'uLateriteMap', dryGrass: 'uDryGrassMap', rock: 'uRockMap', mud: 'uMudMap' };
      const uniformName = mapNames[name];
      const uniforms = this.mesh?.material?.userData?.splatUniforms;
      if (uniforms?.[uniformName]) uniforms[uniformName].value = loaded.albedo;
      if (name === 'grass' && this.mesh?.material) {
        this.mesh.material.normalMap = loaded.normal;
        this.mesh.material.roughnessMap = loaded.roughness;
      }
      this.mesh?.material && (this.mesh.material.needsUpdate = true);
    }).catch(() => {});
  }

  getHeightAt(x, z) {
    if (!this.mesh || x < -this.width / 2 || x > this.width / 2 || z < this.farZ || z > this.nearZ) {
      return heightAtWorld(x, z);
    }
    this.heightRaycaster.ray.origin.set(x, 45, z);
    this.heightRaycaster.ray.direction.copy(this.down);
    const hit = this.heightRaycaster.intersectObject(this.mesh, false)[0];
    return hit ? hit.point.y : heightAtWorld(x, z);
  }

  setQuality(quality) {
    if (quality === this.quality) return;
    this.quality = quality;
    this.scene.remove(this.mesh);
    this.mesh.geometry.disposeBoundsTree?.();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.build();
  }

  dispose() {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.mesh.geometry.disposeBoundsTree?.();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
