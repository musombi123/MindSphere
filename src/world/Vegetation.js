import * as THREE from 'three';
import { roadCenterX } from './Terrain.js';
import { registerMissingAsset, recordWorldNote } from './AssetDiagnostics.js';

function seeded(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}

export class Vegetation {
 constructor({scene,quality='medium',textures,terrain,camera,assetLibrary=null}){
  this.scene=scene;this.quality=quality;this.textures=textures;this.terrain=terrain;this.camera=camera;this.assetLibrary=assetLibrary;
  this.meshes=[];this.billboards=[];this.realVegetation=[];this.build();
  this.assetLibrary?.ready.then(()=>this.addCatalogVegetation()).catch(error=>console.warn('[Project Zero Hour] Real vegetation loading failed:',error));
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
  recordWorldNote('Near-range vegetation uses verified models from the world asset catalog where available; user-video foliage cutouts remain the distant layer.');
  recordWorldNote('User-video alpha cutouts provide distant tree and ground-cover layers; mapped near-field tree and crop GLBs are placed separately when available. This is a hybrid photo-reference environment, not a full photogrammetry reconstruction.');
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
 addCatalogVegetation(){
  if(!this.assetLibrary)return;
  for(const item of this.realVegetation)this.assetLibrary.releaseInstance(item.instance);
  this.realVegetation=[];
  const treeKeys=['acacia','eucalyptus','mangoTree','figTree'].filter(key=>this.assetLibrary.has(key));
  const cropKeys=['bananaPlant','maizePatch','sugarcanePatch'].filter(key=>this.assetLibrary.has(key));
  const treeCount=this.quality==='high'?20:this.quality==='medium'?14:8;
  const cropCount=this.quality==='high'?15:this.quality==='medium'?9:4;
  const random=seeded(2097);
  const add=(key,x,z,height,rotation=0)=>{
   const y=this.terrain.getHeightAt(x,z);
   const instance=this.assetLibrary.createInstance(key,{position:[x,y,z],targetHeight:height,rotationY:rotation});
   if(instance)this.realVegetation.push({instance,position:new THREE.Vector3(x,y,z)});
  };
  for(let i=0;i<treeCount&&treeKeys.length;i++){
   const key=treeKeys[i%treeKeys.length];
   const side=random()<.5?-1:1;
   const x=side*(12+random()*39);
   const z=-119+random()*132;
   if(Math.abs(x-roadCenterX(z))<9)continue;
   const height=key==='acacia'?6.2+random()*1.4:key==='eucalyptus'?8+random()*2:5.4+random()*1.2;
   add(key,x,z,height,random()*Math.PI*2);
  }
  for(let i=0;i<cropCount&&cropKeys.length;i++){
   const key=cropKeys[i%cropKeys.length];
   const side=i%2===0?-1:1;
   const x=side*(19+random()*21),z=-111+random()*118;
   if(Math.abs(x-roadCenterX(z))<12)continue;
   add(key,x,z,key==='maizePatch'?2.25:key==='sugarcanePatch'?2.7:2.1,random()*Math.PI*2);
  }
  console.info('[Project Zero Hour] Real near-field vegetation instances:',this.realVegetation.length);
 }
 update(_dt,elapsed){
  if(this.camera){
   for(const item of this.realVegetation){
    const distance=this.camera.position.distanceTo(item.position);
    item.instance.visible=distance<118;
   }
  }
  if(!this.camera||!this.billboards.length)return;
  const dummy=new THREE.Object3D(),touched=new Set();
  for(const card of this.billboards){
   const dx=this.camera.position.x-card.position.x,dz=this.camera.position.z-card.position.z;
   const distance=Math.hypot(dx,dz);
   dummy.position.copy(card.position);
   if(distance>96){dummy.scale.set(0,0,0);}
   else{
    const yaw=Math.atan2(dx,dz);
    const lod=distance>54?1.18:distance>30?1.06:1;
    dummy.rotation.set(0,yaw+Math.sin(elapsed*.45+card.phase)*.009,Math.sin(elapsed*1.1+card.phase)*.008);
    dummy.scale.set(card.width*lod,card.height*lod,1);
   }
   dummy.updateMatrix();card.mesh.setMatrixAt(card.index,dummy.matrix);touched.add(card.mesh);
  }
  for(const mesh of touched)mesh.instanceMatrix.needsUpdate=true;
 }
 setQuality(q){if(q===this.quality)return;this.dispose();this.quality=q;this.build();this.addCatalogVegetation();}
 dispose(){for(const item of this.realVegetation)this.assetLibrary?.releaseInstance(item.instance);this.realVegetation=[];for(const mesh of this.meshes){this.scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}this.meshes=[];this.billboards=[];}
}
