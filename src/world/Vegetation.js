import * as THREE from 'three';
import { roadCenterX } from './Terrain.js';
import { registerMissingAsset, recordWorldNote } from './AssetDiagnostics.js';

function seeded(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}

export class Vegetation {
 constructor({scene,quality='medium',textures,terrain,camera}){
  this.scene=scene;this.quality=quality;this.textures=textures;this.terrain=terrain;this.camera=camera;
  this.meshes=[];this.billboards=[];this.build();
 }
 build(){
  const random=seeded(2097);
  const q=this.quality==='high'?1:this.quality==='medium'?.62:.30;
  // These are actual cutouts derived from user footage, not generated leaf colours.
  this.addCutoutCards(this.textures.photo.treeCutout,'PHOTO_TREE_CANOPY',Math.round((this.quality==='high'?112:this.quality==='medium'?68:34)*q),random,{
   minDistance:9,minX:10,maxX:59,minZ:-125,maxZ:19,minY:0.2,width:4.8,height:8.6
  });
  this.addCutoutCards(this.textures.photo.plants,'PHOTO_GARDEN_UNDERSTORY',Math.round((this.quality==='high'?180:this.quality==='medium'?110:50)*q),random,{
   minDistance:5.0,minX:6.5,maxX:32,minZ:-123,maxZ:20,minY:0.02,width:2.1,height:1.8
  });
  for(const path of [
   '/assets/world/models/acacia.glb','/assets/world/models/eucalyptus.glb',
   '/assets/world/models/mango_tree.glb','/assets/world/models/fig_tree.glb',
   '/assets/world/models/banana_plant.glb','/assets/world/models/maize_patch.glb',
   '/assets/world/models/sugarcane_patch.glb'
  ])registerMissingAsset(path,'Near-range licensed model was not supplied. The distant layer uses extracted photo cutouts from your video.');
  recordWorldNote('Trees and ground cover use extracted, alpha-keyed pixels from the user video as camera-facing billboards. Near-range tree GLBs are still missing and must not be mistaken for completed photogrammetry.');
 }
 addCutoutCards(texture,name,count,random,options){
  if(!texture){registerMissingAsset('/reference/world/video_frame_16s.webp','Required plant/tree photo cutout texture is unavailable.');return;}
  const geometry=new THREE.PlaneGeometry(1,1,1,2);geometry.translate(0,.5,0);
  const material=new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.045,side:THREE.DoubleSide,roughness:1,metalness:0,depthWrite:false});
  const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=name;mesh.frustumCulled=true;mesh.castShadow=false;mesh.receiveShadow=false;
  const dummy=new THREE.Object3D();let placed=0;
  for(let i=0;i<count*5&&placed<count;i++){
   const side=random()<.5?-1:1;
   const x=side*(options.minX+random()*(options.maxX-options.minX));
   const z=options.minZ+random()*(options.maxZ-options.minZ);
   if(Math.abs(x-roadCenterX(z))<options.minDistance)continue;
   const y=this.terrain.getHeightAt(x,z)+(options.minY||0);
   const width=options.width*(.72+random()*.72),height=options.height*(.72+random()*.72);
   const record={mesh,index:placed,position:new THREE.Vector3(x,y,z),width,height,phase:random()*Math.PI*2,yawSeed:random()*Math.PI*2};
   dummy.position.copy(record.position);dummy.rotation.y=record.yawSeed;dummy.scale.set(width,height,1);dummy.updateMatrix();mesh.setMatrixAt(placed,dummy.matrix);
   this.billboards.push(record);placed++;
  }
  mesh.count=placed;mesh.instanceMatrix.needsUpdate=true;this.scene.add(mesh);this.meshes.push(mesh);
 }
 update(_dt,elapsed){
  if(!this.camera||!this.billboards.length)return;
  const dummy=new THREE.Object3D(),touched=new Set();
  for(const card of this.billboards){
   const yaw=Math.atan2(this.camera.position.x-card.position.x,this.camera.position.z-card.position.z);
   dummy.position.copy(card.position);
   dummy.rotation.set(0,yaw+Math.sin(elapsed*.45+card.phase)*.009,Math.sin(elapsed*1.1+card.phase)*.008);
   dummy.scale.set(card.width,card.height,1);dummy.updateMatrix();card.mesh.setMatrixAt(card.index,dummy.matrix);touched.add(card.mesh);
  }
  for(const mesh of touched)mesh.instanceMatrix.needsUpdate=true;
 }
 setQuality(q){if(q===this.quality)return;this.dispose();this.quality=q;this.build();}
 dispose(){for(const mesh of this.meshes){this.scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}this.meshes=[];this.billboards=[];}
}
