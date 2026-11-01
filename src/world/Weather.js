import * as THREE from 'three';
import { heightAtWorld } from './Terrain.js';

const WEATHER_PRESETS = Object.freeze({
  clear: {
    rain: 0,
    windX: 0.12,
    windZ: 0.04,
    gust: 0.08,
    visibility: 1,
    dustOpacity: 0.2,
    dustColor: 0xe7d9be,
    dustRise: 0.085,
    lightning: false
  },
  dust: {
    rain: 0,
    windX: 1.05,
    windZ: 0.24,
    gust: 0.74,
    visibility: 0.9,
    dustOpacity: 0.34,
    dustColor: 0xc7a77a,
    dustRise: 0.045,
    lightning: false
  },
  rain: {
    rain: 0.72,
    windX: 0.82,
    windZ: 0.24,
    gust: 0.56,
    visibility: 0.84,
    dustOpacity: 0.075,
    dustColor: 0xb8c9ce,
    dustRise: 0.02,
    lightning: false
  },
  storm: {
    rain: 1,
    windX: 1.75,
    windZ: 0.48,
    gust: 1.25,
    visibility: 0.7,
    dustOpacity: 0.035,
    dustColor: 0x9fb6c5,
    dustRise: 0.012,
    lightning: true
  },
  anomaly: {
    rain: 0,
    windX: 0.34,
    windZ: -0.18,
    gust: 0.32,
    visibility: 0.74,
    dustOpacity: 0.27,
    dustColor: 0xbdaaff,
    dustRise: 0.065,
    lightning: false
  }
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Weather {
  constructor({ scene, quality = 'medium', settings = {} }) {
    this.scene = scene;
    this.quality = quality;
    this.settings = settings;
    this.elapsed = 0;
    this.type = 'clear';
    this.profile = WEATHER_PRESETS.clear;
    this.randomState = 777;
    this.lightningCooldown = 0;
    this.lightningRemaining = 0;
    this.lightningPeak = 0;
    this.rain = null;
    this.rainGeometry = null;
    this.baseFog = null;

    this.createParticles();
    this.createLightning();
    this.setWeather(settings.type || 'clear');
  }

  random() {
    this.randomState = (this.randomState * 1664525 + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  particleCount() {
    return this.quality === 'high' ? 480 : this.quality === 'medium' ? 240 : 74;
  }

  createParticles() {
    const count = this.particleCount();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (this.random() - 0.5) * 70;
      positions[i * 3 + 1] = this.random() * 18;
      positions[i * 3 + 2] = 10 - this.random() * 100;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: this.profile.dustColor,
      size: this.quality === 'high' ? 0.08 : 0.055,
      transparent: true,
      opacity: this.profile.dustOpacity,
      depthWrite: false,
      sizeAttenuation: true
    });

    this.particles = new THREE.Points(geometry, material);
    this.particles.name = 'WIND-DRIVEN ATMOSPHERIC PARTICLES';
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
  }

  createLightning() {
    this.lightningLight = new THREE.DirectionalLight(0xe5f2ff, 0);
    this.lightningLight.position.set(-24, 58, -44);
    this.lightningLight.name = 'WEATHER_STORM_LIGHTNING';
    this.lightningLight.castShadow = false;
    this.scene.add(this.lightningLight);
  }

  rainCount() {
    return this.quality === 'high' ? 680 : this.quality === 'medium' ? 360 : 120;
  }

  createRain() {
    this.disposeRain();
    if (!this.profile.rain) return;

    const count = Math.max(48, Math.round(this.rainCount() * this.profile.rain));
    const positions = new Float32Array(count * 6);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const offset = i * 6;
      const x = (this.random() - 0.5) * 76;
      const y = 1 + this.random() * 22;
      const z = 24 - this.random() * 112;
      const fallSpeed = 14 + this.random() * 9;
      speeds[i] = fallSpeed;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
      positions[offset + 3] = x - this.profile.windX * 0.055;
      positions[offset + 4] = y - 0.62;
      positions[offset + 5] = z - this.profile.windZ * 0.055;
    }

    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainGeometry.setAttribute('fallSpeed', new THREE.BufferAttribute(speeds, 1));
    this.rainGeometry.attributes.position.setUsage(THREE.DynamicDrawUsage);

    const opacity = this.type === 'storm' ? 0.66 : 0.44;
    const material = new THREE.LineBasicMaterial({
      color: this.type === 'storm' ? 0xd7e5f0 : 0xb5cbd4,
      transparent: true,
      opacity,
      depthWrite: false,
      fog: true
    });

    this.rain = new THREE.LineSegments(this.rainGeometry, material);
    this.rain.name = this.type === 'storm' ? 'WIND-DRIVEN STORM RAIN' : 'WIND-DRIVEN LIGHT RAIN';
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  disposeRain() {
    if (!this.rain) return;
    this.scene.remove(this.rain);
    this.rainGeometry?.dispose();
    this.rain.material.dispose();
    this.rain = null;
    this.rainGeometry = null;
  }

  captureFogBaseline() {
    if (this.baseFog || !this.scene.fog) return;
    this.baseFog = this.scene.fog.isFogExp2
      ? { type: 'exp2', density: this.scene.fog.density }
      : {
          type: 'linear',
          near: this.scene.fog.near,
          far: this.scene.fog.far
        };
  }

  applyVisibility() {
    this.captureFogBaseline();
    if (!this.scene.fog || !this.baseFog) return;
    const visibility = this.profile.visibility;
    if (this.baseFog.type === 'exp2' && this.scene.fog.isFogExp2) {
      this.scene.fog.density = this.baseFog.density / Math.max(0.35, visibility);
    } else if (this.scene.fog.isFog) {
      this.scene.fog.near = this.baseFog.near * (0.9 + visibility * 0.1);
      this.scene.fog.far = this.baseFog.far * visibility;
    }
  }

  setWeather(type = 'clear') {
    const key = String(type || 'clear').toLowerCase();
    const profile = WEATHER_PRESETS[key];
    if (!profile) {
      console.warn('[Project Zero Hour] Unknown weather preset:', type);
      return false;
    }

    this.type = key;
    this.profile = profile;
    this.applyVisibility();

    if (this.particles?.material) {
      this.particles.material.color.setHex(profile.dustColor);
      this.particles.material.opacity = profile.dustOpacity;
    }
    if (this.rain) this.disposeRain();
    this.createRain();

    this.lightningCooldown = profile.lightning ? 0.8 + this.random() * 1.4 : 0;
    this.lightningRemaining = 0;
    this.lightningPeak = 0;
    this.lightningLight.intensity = 0;
    this.lightningLight.color.setHex(key === 'anomaly' ? 0xc5aaff : 0xe5f2ff);

    if (this.rain?.material) {
      this.rain.material.color.setHex(key === 'storm' ? 0xd7e5f0 : 0xb5cbd4);
      this.rain.material.opacity = key === 'storm' ? 0.66 : 0.44;
    }

    if (typeof window !== 'undefined') window.__worldWeather = key;
    console.info('[Project Zero Hour] Weather profile active:', key);
    return true;
  }

  updateDust(dt, elapsed) {
    const attribute = this.particles.geometry.attributes.position;
    const positions = attribute.array;
    const windPulse = Math.sin(elapsed * 0.31) * this.profile.gust;
    const windX = this.profile.windX + windPulse;
    const windZ = this.profile.windZ + Math.cos(elapsed * 0.23) * this.profile.gust * 0.25;

    for (let i = 0; i < attribute.count; i++) {
      const offset = i * 3;
      positions[offset] += (windX * 0.055 + Math.sin(elapsed * 0.17 + i) * 0.055) * dt;
      positions[offset + 1] += (this.profile.dustRise + Math.sin(i * 1.7 + elapsed * 0.4) * 0.018) * dt;
      positions[offset + 2] += (windZ * 0.04 + Math.cos(elapsed * 0.12 + i) * 0.025) * dt;

      if (positions[offset + 1] > 19) positions[offset + 1] = 0;
      if (positions[offset] < -38) positions[offset] = 38;
      if (positions[offset] > 38) positions[offset] = -38;
      if (positions[offset + 2] < -116) positions[offset + 2] = 26;
      if (positions[offset + 2] > 26) positions[offset + 2] = -116;
    }

    attribute.needsUpdate = true;
  }

  updateRain(dt, elapsed) {
    if (!this.rain || !this.rainGeometry) return;
    const attribute = this.rainGeometry.attributes.position;
    const positions = attribute.array;
    const speeds = this.rainGeometry.attributes.fallSpeed.array;
    const gust = Math.sin(elapsed * 0.8) * this.profile.gust;
    const windX = this.profile.windX + gust;
    const windZ = this.profile.windZ + Math.cos(elapsed * 0.37) * this.profile.gust * 0.32;

    for (let i = 0; i < speeds.length; i++) {
      const offset = i * 6;
      let x = positions[offset] + windX * dt;
      let y = positions[offset + 1] - speeds[i] * dt;
      let z = positions[offset + 2] + windZ * dt;

      if (
        y < heightAtWorld(x, z) + 0.3 ||
        x < -42 || x > 42 ||
        z < -120 || z > 30
      ) {
        x = (this.random() - 0.5) * 76;
        y = 14 + this.random() * 12;
        z = 24 - this.random() * 112;
      }

      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
      positions[offset + 3] = x - windX * 0.055;
      positions[offset + 4] = y - 0.62 - (speeds[i] - 14) * 0.012;
      positions[offset + 5] = z - windZ * 0.055;
    }

    attribute.needsUpdate = true;
  }

  updateLightning(dt) {
    if (!this.profile.lightning) {
      this.lightningLight.intensity = 0;
      return;
    }

    this.lightningCooldown = Math.max(0, this.lightningCooldown - dt);
    if (this.lightningRemaining > 0) {
      this.lightningRemaining = Math.max(0, this.lightningRemaining - dt);
      const envelope = this.lightningRemaining / 0.16;
      this.lightningLight.intensity = this.lightningPeak * clamp(envelope, 0, 1);
      return;
    }

    this.lightningLight.intensity = 0;
    if (this.lightningCooldown <= 0) {
      this.lightningPeak = 3.6 + this.random() * 2.4;
      this.lightningRemaining = 0.16;
      this.lightningCooldown = 7 + this.random() * 13;
      this.lightningLight.intensity = this.lightningPeak;
    }
  }

  update(dt, elapsed) {
    const delta = clamp(Number(dt) || 0, 0, 0.08);
    this.elapsed = Number(elapsed) || 0;
    this.updateDust(delta, this.elapsed);
    this.updateRain(delta, this.elapsed);
    this.updateLightning(delta);
  }

  setQuality(quality) {
    if (!['low', 'medium', 'high'].includes(quality) || quality === this.quality) return;
    this.scene.remove(this.particles);
    this.particles.geometry.dispose();
    this.particles.material.dispose();
    this.disposeRain();

    this.quality = quality;
    this.createParticles();
    this.createRain();
  }

  dispose() {
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.particles = null;
    }
    this.disposeRain();
    if (this.lightningLight) {
      this.scene.remove(this.lightningLight);
      this.lightningLight = null;
    }
  }
}
