import * as THREE from 'three';
import { roadCenterX } from './Terrain.js';
import { recordWorldNote } from './AssetDiagnostics.js';

export class Props {
 constructor({scene,terrain,textures,quality='medium',camera,assetLibrary=null}){
  this.scene=scene;this.terrain=terrain;this.textures=textures;this.quality=quality;this.camera=camera;this.assetLibrary=assetLibrary;this.meshes=[];this.realInstances=[];this.build();
  this.assetLibrary?.ready.then(()=>this.addCatalogWorldModels()).catch(error=>console.warn('[Project Zero Hour] World prop loading failed:',error));
 }
 addPhotoPanel(texture,name,x,y,z,width,height,rotationY=0){
  if(!texture){registerMissingAsset('/reference/world/video_frame_26s.webp','Required user photo for a rural house/fence panel is unavailable.');return;}
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.98,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);
  mesh.name=name;mesh.position.set(x,y,z);mesh.rotation.y=rotationY;mesh.frustumCulled=true;mesh.castShadow=false;mesh.receiveShadow=false;
  this.scene.add(mesh);this.meshes.push(mesh);return mesh;
 }
 build(){
  const fence=this.textures.photo.fence,homestead=this.textures.photo.homestead;
  const segments=this.quality==='high'?14:this.quality==='medium'?9:5;
  // The fence is the owner's actual photo, displayed as a perspective roadside panel.
  for(const side of [-1,1]){
   for(let i=0;i<segments;i++){
    const z=16-i*(128/segments),x=roadCenterX(z)+side*8.7,y=this.terrain.getHeightAt(x,z);
    this.addPhotoPanel(fence,'USER_PHOTO_TIMBER_FENCE_'+side+'_'+i,x,y+1.45,z,9.2,2.9,Math.PI/2);
   }
  }
  // The homestead photo is used as a photo card until a matching near-field GLB is supplied.
  const count=this.quality==='high'?9:this.quality==='medium'?6:3;
  for(let i=0;i<count;i++){
   const z=8-i*20,side=i%2?1:-1,x=roadCenterX(z)+side*(17+(i%3)*2),y=this.terrain.getHeightAt(x,z);
   this.addPhotoPanel(homestead,'USER_PHOTO_RURAL_HOMESTEAD_'+i,x,y+3.0,z,9.4,5.3,side===1?-.10:.10);
  }
  recordWorldNote('Near-field rural geometry is loaded from the verified worldModels section of public/assets/asset-catalog.json. Missing entries are listed in the F3 asset diagnostics.');
  recordWorldNote('Rural homes and timber fences are shown using the actual user-video photos on feathered photo cards. These are not true 3D buildings or colliders; matching GLBs are still required for close-up geometry.');
 }
 addCatalogWorldModels(){
  if(!this.assetLibrary)return;
  for(const instance of this.realInstances)this.assetLibrary.releaseInstance(instance);
  this.realInstances=[];
  const place=(key,x,z,{height=1.5,rotation=0,scale=1}={})=>{
   if(!this.assetLibrary.has(key))return null;
   const y=this.terrain.getHeightAt(x,z);
   const instance=this.assetLibrary.createInstance(key,{position:[x,y,z],targetHeight:height,rotationY:rotation,scale});
   if(instance)this.realInstances.push(instance);
   return instance;
  };

  // Real homestead silhouettes replace the distant photo panels only when an authored model is mapped.
  if(this.assetLibrary.has('mudHouse')){
   for(const site of [
    {z:4,side:-1},{z:-28,side:1},{z:-64,side:-1},{z:-101,side:1}
   ]){
    const x=roadCenterX(site.z)+site.side*(18+(Math.abs(site.z)%3));
    place('mudHouse',x,site.z,{height:3.8,rotation:site.side<0?-.12:Math.PI+.12});
   }
   for(const mesh of this.meshes)if(mesh.name.startsWith('USER_PHOTO_RURAL_HOMESTEAD_'))mesh.visible=false;
  }

  if(this.assetLibrary.has('timberFence')){
   for(const side of [-1,1]){
    for(let i=0;i<12;i++){
     const z=17-i*11.2,x=roadCenterX(z)+side*10.5;
     place('timberFence',x,z,{height:1.35,rotation:Math.PI/2});
    }
   }
   for(const mesh of this.meshes)if(mesh.name.startsWith('USER_PHOTO_TIMBER_FENCE_'))mesh.visible=false;
  }

  place('bodaBoda',roadCenterX(-4)-16,-4,{height:1.35,rotation:Math.PI*.45});
  place('rustedPickup',roadCenterX(-59)+20,-59,{height:1.95,rotation:-Math.PI*.5});
  place('waterTank',roadCenterX(-31)-19,-31,{height:2.8});
  place('stoneWall',roadCenterX(-91)+17,-91,{height:1.65,rotation:Math.PI/2});
  place('crates',roadCenterX(-18)+12,-18,{height:.75});
  place('tyres',roadCenterX(-72)-14,-72,{height:.82});
  place('firePit',roadCenterX(-43)+18,-43,{height:.5});
 }
 update(){}
 setQuality(q){if(q===this.quality)return;for(const instance of this.realInstances)this.assetLibrary?.releaseInstance(instance);this.realInstances=[];this.dispose();this.quality=q;this.build();this.addCatalogWorldModels();}
 dispose(){for(const instance of this.realInstances)this.assetLibrary?.releaseInstance(instance);this.realInstances=[];for(const mesh of this.meshes){this.scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}this.meshes=[];}
}
