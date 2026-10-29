import * as THREE from 'three';
import { createProceduralPbrTextures } from './TextureFactory.js';
import { Terrain } from './Terrain.js';
import { Road } from './Road.js';

export class WorldManager {
  constructor({ scene, renderer, camera, chapter = 1, hemi, sun, quality = null }) {
    this.scene = scene; this.renderer = renderer; this.camera = camera; this.chapter = chapter;
    this.hemi = hemi; this.sun = sun;
    this.quality = quality || (matchMedia('(pointer: coarse)').matches ? 'low' : 'medium');
    try { const saved = localStorage.getItem('zeroHourWorldQuality'); if (['low','medium','high'].includes(saved)) this.quality = saved; } catch {}
    this.textures = createProceduralPbrTextures(this.quality === 'high' ? 384 : 256);
    this.terrain = new Terrain({ scene, quality: this.quality, textures: this.textures });
    this.road = new Road({ scene, terrain: this.terrain, textures: this.textures, quality: this.quality });
    this.phaseRoadMesh = null;
    this.elapsed = 0;
  }
  initialize() {}
  getHeightAt(x, z) { return this.terrain.getHeightAt(x, z); }
  createPhaseRoadOverlay(material) { this.phaseRoadMesh = this.road.createPhaseOverlay(material); return this.phaseRoadMesh; }
  update(dt, elapsed) { this.elapsed = elapsed; this.road.update(dt, elapsed); }
  render(dt, elapsed) { this.update(dt, elapsed); this.renderer.render(this.scene, this.camera); }
  setQuality(quality) {
    if (!['low','medium','high'].includes(quality) || quality === this.quality) return;
    this.quality = quality;
    try { localStorage.setItem('zeroHourWorldQuality', quality); } catch {}
    this.terrain.setQuality(quality);
    this.road.setQuality(quality);
  }
  dispose() { this.road.dispose(); this.terrain.dispose(); }
}
