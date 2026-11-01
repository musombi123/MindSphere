import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Weather } from '../src/world/Weather.js';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9dbb9a, 48, 128);
const weather = new Weather({ scene, quality: 'low' });

assert.equal(weather.type, 'clear');
assert.ok(weather.particles.geometry.attributes.position.count > 0);
assert.equal(weather.rain, null);

const baselineFar = scene.fog.far;
assert.equal(weather.setWeather('rain'), true);
assert.equal(weather.type, 'rain');
assert.ok(weather.rain);
assert.ok(weather.rainGeometry.attributes.fallSpeed.count >= 48);
assert.ok(scene.fog.far < baselineFar);

const positions = weather.rainGeometry.attributes.position.array;
const before = positions.slice(0, 6);
weather.update(1 / 30, 1 / 30);
const after = weather.rainGeometry.attributes.position.array.slice(0, 6);
assert.notDeepEqual([...after], [...before], 'rain streaks should move between updates');

assert.equal(weather.setWeather('storm'), true);
assert.equal(weather.profile.lightning, true);
weather.lightningCooldown = 0;
weather.update(1 / 60, 0.05);
assert.ok(weather.lightningLight.intensity > 0, 'storm should produce a lightning flash');

assert.equal(weather.setWeather('anomaly'), true);
assert.equal(weather.rain, null, 'anomaly weather should not leave rain geometry active');
assert.equal(weather.lightningLight.intensity, 0, 'anomaly weather should disable storm flashes');
assert.equal(weather.particles.material.color.getHex(), 0xbdaaff);

const invalidType = weather.type;
assert.equal(weather.setWeather('monsoon-unknown'), false);
assert.equal(weather.type, invalidType, 'invalid weather must not corrupt the active preset');

const oldParticleCount = weather.particles.geometry.attributes.position.count;
weather.setQuality('medium');
assert.notEqual(weather.particles.geometry.attributes.position.count, oldParticleCount);
assert.equal(weather.type, 'anomaly');

weather.setWeather('clear');
assert.equal(scene.fog.far, baselineFar, 'clear weather restores the fog baseline');
weather.dispose();
assert.ok(!scene.children.some((child) => child.name === 'WIND-DRIVEN ATMOSPHERIC PARTICLES'));
assert.ok(!scene.children.some((child) => child.name === 'WEATHER_STORM_LIGHTNING'));

console.log('[Project Zero Hour] Weather tests passed: rain movement, wind presets, storm flashes, fog restoration, quality rebuild and disposal.');
