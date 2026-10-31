import * as THREE from 'three';
import { createProceduralPbrTextures } from './TextureFactory.js';
import { Terrain } from './Terrain.js';
import { Road } from './Road.js';
import { Sky } from './Sky.js';
import { Vegetation } from './Vegetation.js';
import { Props } from './Props.js';
import { Weather } from './Weather.js';
import { AudioAmbience } from './AudioAmbience.js';
import { Postprocessing } from './Postprocessing.js';
import { WorldAssetLibrary } from './WorldAssetLibrary.js';
import { installWorldDebugPanel } from './AssetDiagnostics.js';

export class WorldManager {
  constructor({ scene, renderer, camera, chapter = 1, hemi, sun, quality = null }) {
    installWorldDebugPanel();
    this.scene = scene; this.renderer = renderer; this.camera = camera; this.chapter = chapter;
    this.hemi = hemi; this.sun = sun;
    this.quality = quality || (matchMedia('(pointer: coarse)').matches ? 'low' : 'medium');
    try { const saved = localStorage.getItem('zeroHourWorldQuality'); if (['low','medium','high'].includes(saved)) this.quality = saved; } catch {}
    this.textures = createProceduralPbrTextures(this.quality === 'high' ? 384 : 256);
    this.assetLibrary = new WorldAssetLibrary({ renderer, scene });
    this.terrain = new Terrain({ scene, quality: this.quality, textures: this.textures });
    this.road = new Road({ scene, terrain: this.terrain, textures: this.textures, quality: this.quality });
    this.sky = new Sky({scene,sun,hemi,quality:this.quality,photos:this.textures.photo});
    this.vegetation = new Vegetation({scene,quality:this.quality,textures:this.textures,terrain:this.terrain,camera,assetLibrary:this.assetLibrary});
    this.props = new Props({scene,terrain:this.terrain,textures:this.textures,quality:this.quality,camera,assetLibrary:this.assetLibrary});
    this.weather = new Weather({scene,quality:this.quality});
    this.audio = new AudioAmbience();
    this.postprocessing = new Postprocessing({renderer,scene,camera,sun,quality:this.quality});
    window.__worldQuality=this.quality;
    window.__setWorldQuality=(preset)=>this.setQuality(preset);
    this.phaseRoadMesh = null;
    this.elapsed = 0;
  }
  initialize() {}
  getHeightAt(x, z) { return this.terrain.getHeightAt(x, z); }
  createPhaseRoadOverlay(material) { this.phaseRoadMesh = this.road.createPhaseOverlay(material); return this.phaseRoadMesh; }
  update(dt, elapsed) { this.elapsed = elapsed; this.road.update(dt, elapsed); this.sky.update(dt,elapsed); this.vegetation.update(dt,elapsed); this.props.update(dt,elapsed); this.weather.update(dt,elapsed); }
  render(dt, elapsed) { this.update(dt, elapsed); this.postprocessing.render(this.scene,this.camera); }
  resize(width=window.innerWidth,height=window.innerHeight){this.postprocessing.setSize(width,height);}
  setQuality(quality) {
    if (!['low','medium','high'].includes(quality) || quality === this.quality) return;
    this.quality = quality;window.__worldQuality=quality;
    try { localStorage.setItem('zeroHourWorldQuality', quality); } catch {}
    this.terrain.setQuality(quality);
    this.road.setQuality(quality);
    this.sky.setQuality(quality);this.vegetation.setQuality(quality);this.props.setQuality(quality);this.weather.setQuality(quality);this.postprocessing.setQuality(quality);
  }
  dispose() { this.props.dispose();this.vegetation.dispose();this.assetLibrary.dispose();this.road.dispose();this.terrain.dispose();this.sky.dispose();this.weather.dispose();this.audio.dispose();this.postprocessing.dispose(); }
}
