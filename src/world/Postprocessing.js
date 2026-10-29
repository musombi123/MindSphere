import * as THREE from 'three';
/** Safe renderer quality presets; postprocessing composer is intentionally separate from the current render loop. */
export class Postprocessing{
 constructor({renderer,quality='medium'}){this.renderer=renderer;this.setQuality(quality);}
 setQuality(q){this.quality=q;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=q==='high'?1.12:q==='medium'?1.08:1;this.renderer.shadowMap.enabled=q!=='low';this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,q==='high'?1.6:q==='medium'?1.2:.9));}
 render(scene,camera){this.renderer.render(scene,camera);}dispose(){}
}