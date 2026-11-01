import * as THREE from 'three';
import { recordWorldNote } from './AssetDiagnostics.js';

const SKY_VERTEX = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = `
  varying vec3 vDirection;
  uniform vec3 uSunDirection;
  uniform float uMood;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void main() {
    vec3 dir = normalize(vDirection);
    float elevation = clamp((dir.y + 0.10) / 1.10, 0.0, 1.0);

    vec3 horizon = vec3(0.76, 0.76, 0.66);
    vec3 midSky = vec3(0.34, 0.51, 0.55);
    vec3 zenith = vec3(0.075, 0.16, 0.22);

    vec3 sky = mix(horizon, midSky, smoothstep(0.0, 0.56, elevation));
    sky = mix(sky, zenith, smoothstep(0.50, 1.0, elevation));

    float azimuth = atan(dir.z, dir.x);
    vec2 cloudUv = vec2(azimuth * 2.6, dir.y * 12.0);
    float cloudNoise = noise2(cloudUv) * 0.62 + noise2(cloudUv * 2.1) * 0.25 + noise2(cloudUv * 4.3) * 0.13;
    float cloudBand = smoothstep(0.61, 0.79, cloudNoise) * smoothstep(-0.02, 0.35, dir.y);
    sky = mix(sky, vec3(0.80, 0.80, 0.72), cloudBand * 0.16);

    float sunDot = max(dot(dir, normalize(uSunDirection)), 0.0);
    float sunHalo = pow(sunDot, 16.0) * 0.12 + pow(sunDot, 64.0) * 0.28;
    sky += vec3(1.0, 0.78, 0.52) * sunHalo;

    vec3 duskTint = vec3(0.20, 0.12, 0.15);
    sky = mix(sky, sky * (vec3(0.82, 0.76, 0.79) + duskTint), uMood);
    gl_FragColor = vec4(sky, 1.0);
  }
`;

export class Sky {
  constructor({ scene, sun, hemi, quality = 'medium' }) {
    this.scene = scene;
    this.sun = sun;
    this.hemi = hemi;
    this.quality = quality;
    this.dome = null;
    this.domeMaterial = null;
    this.horizon = null;
    this.build();
    this.setTimeOfDay(0.36);
    recordWorldNote('The sky is rendered as a continuous atmospheric dome. No tiled 2D sky cards or unfilled black panorama seams are used.');
  }

  build() {
    this.scene.background = new THREE.Color(0xb6c8c1);
    const geometry = new THREE.SphereGeometry(142, 48, 28);
    this.domeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(-0.45, 0.82, 0.34).normalize() },
        uMood: { value: 0.0 }
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false
    });
    this.dome = new THREE.Mesh(geometry, this.domeMaterial);
    this.dome.name = 'CONTINUOUS_BUNGOMA_ATMOSPHERE';
    this.dome.renderOrder = -1000;
    this.scene.add(this.dome);

    // A low, continuous distant ridge softens the horizon without using repeated image planes.
    const segments = this.quality === 'high' ? 192 : this.quality === 'medium' ? 144 : 96;
    const positions = [];
    const indices = [];
    const radius = 126;
    const baseY = -15;
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      const wave = Math.sin(angle * 3.0 + 0.6) * 2.3
        + Math.sin(angle * 7.0 - 1.1) * 1.1
        + Math.sin(angle * 13.0 + 0.4) * 0.45;
      const ridgeY = 5.5 + wave;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      positions.push(x, baseY, z, x, ridgeY, z);
      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const ridgeGeometry = new THREE.BufferGeometry();
    ridgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    ridgeGeometry.setIndex(indices);
    ridgeGeometry.computeVertexNormals();
    const ridgeMaterial = new THREE.MeshStandardMaterial({
      color: 0x66745b,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      fog: true
    });
    this.horizon = new THREE.Mesh(ridgeGeometry, ridgeMaterial);
    this.horizon.name = 'DISTANT_HILL_RIDGE';
    this.horizon.frustumCulled = false;
    this.horizon.receiveShadow = false;
    this.horizon.castShadow = false;
    this.scene.add(this.horizon);
  }

  setTimeOfDay(value = 0.36) {
    const v = THREE.MathUtils.clamp(value, 0, 1);
    const angle = (v - 0.18) * Math.PI;
    this.sun.position.set(-28 + Math.cos(angle) * 10, Math.max(26, 42 + Math.sin(angle) * 8), 18);
    this.sun.color.setRGB(1, 0.93, 0.81);
    this.sun.intensity = 2.0;
    this.hemi.color.set(0xc3def3);
    this.hemi.groundColor.set(0x4c5540);
    this.hemi.intensity = 1.45;
    this.domeMaterial?.uniforms.uSunDirection.value.copy(this.sun.position).normalize();
  }

  setMood(mood) {
    const value = mood === 'dusk' ? 0.38 : mood === 'echo' ? 0.62 : 0.0;
    if (this.domeMaterial) this.domeMaterial.uniforms.uMood.value = value;
  }

  update() {}

  setQuality(quality) {
    if (!['low', 'medium', 'high'].includes(quality) || quality === this.quality) return;
    this.quality = quality;
  }

  dispose() {
    if (this.dome) {
      this.scene.remove(this.dome);
      this.dome.geometry.dispose();
      this.domeMaterial?.dispose();
      this.dome = null;
    }
    if (this.horizon) {
      this.scene.remove(this.horizon);
      this.horizon.geometry.dispose();
      this.horizon.material.dispose();
      this.horizon = null;
    }
  }
}
