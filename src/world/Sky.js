import * as THREE from 'three';
import { recordWorldNote, registerMissingAsset } from './AssetDiagnostics.js';

export class Sky {
 constructor({scene,sun,hemi,quality='medium',photos={}}){
  this.scene=scene;this.sun=sun;this.hemi=hemi;this.quality=quality;this.photos=photos;this.panels=[];
  this.scene.background=null;
  const segmentCount=quality==='high'?12:quality==='medium'?9:6;
  for(let i=0;i<segmentCount;i++){
   const angle=i/segmentCount*Math.PI*2;
   const distant=i%3===0?photos.homestead:(i%2===0?photos.horizon:photos.treeLine);
   this.addPhotoPanel(distant,86,10,44,21,angle,'PHOTO_DISTANT_LANDSCAPE_'+i);
   this.addPhotoPanel(photos.sky,92,34,50,32,angle,'PHOTO_SKY_PANEL_'+i);
  }
  if(!photos.sky||!photos.horizon||!photos.treeLine){
   registerMissingAsset('/reference/world/video_frame_02s.webp','Required user footage for the photographic sky and tree-line panorama.');
  }
  recordWorldNote('Distant skyline and sky are normal photographs cut into feathered curved backdrop panels; the upload is not a 360-degree panorama.');
  this.setTimeOfDay(.36);
 }
 addPhotoPanel(texture,radius,y,width,height,angle,name){
  if(!texture){registerMissingAsset('/reference/world/video_frame_02s.webp','Photographic backdrop texture was not created.');return;}
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.98,side:THREE.DoubleSide,depthWrite:false,toneMapped:false,fog:true});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
  mesh.name=name;mesh.position.set(Math.sin(angle)*radius,y,Math.cos(angle)*radius);
  mesh.lookAt(0,y,0);mesh.renderOrder=-10;mesh.frustumCulled=false;this.scene.add(mesh);this.panels.push(mesh);
 }
 setTimeOfDay(value=.36){
  const v=THREE.MathUtils.clamp(value,0,1);
  // Keep the mission-one light consistent with the sunny late-morning source footage.
  const angle=(v-.18)*Math.PI;
  this.sun.position.set(-28+Math.cos(angle)*10,Math.max(26,42+Math.sin(angle)*8),18);
  this.sun.color.setRGB(1,0.93,0.81);this.sun.intensity=2.0;
  this.hemi.color.set(0xc3def3);this.hemi.groundColor.set(0x4c5540);this.hemi.intensity=1.45;
 }
 setMood(mood){
  const opacity=mood==='dusk'?.84:mood==='echo'?.78:0.98;
  for(const p of this.panels)p.material.opacity=opacity;
 }
 update(){}
 setQuality(q){this.quality=q;}
 dispose(){for(const p of this.panels){this.scene.remove(p);p.geometry.dispose();p.material.dispose();}this.panels=[];}
}