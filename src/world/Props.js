import * as THREE from 'three';
import { roadCenterX } from './Terrain.js';
import { registerMissingAsset, recordWorldNote } from './AssetDiagnostics.js';

export class Props {
 constructor({scene,terrain,textures,quality='medium',camera}){
  this.scene=scene;this.terrain=terrain;this.textures=textures;this.quality=quality;this.camera=camera;this.meshes=[];this.build();
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
  for(const path of [
   '/assets/world/models/mud_house.glb','/assets/world/models/timber_fence.glb',
   '/assets/world/models/boda_boda.glb','/assets/world/models/rusted_pickup.glb',
   '/assets/world/models/water_tank.glb','/assets/world/models/bridge.glb',
   '/assets/world/models/crates.glb','/assets/world/models/tyres.glb',
   '/assets/world/models/fire_pit.glb','/assets/world/models/stone_wall.glb'
  ])registerMissingAsset(path,'Real near-range model not supplied; no generic box/cone substitute is used for this element.');
  recordWorldNote('Rural homes and timber fences are shown using the actual user-video photos on feathered photo cards. These are not true 3D buildings or colliders; matching GLBs are still required for close-up geometry.');
 }
 update(){}
 setQuality(q){if(q===this.quality)return;this.dispose();this.quality=q;this.build();}
 dispose(){for(const mesh of this.meshes){this.scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}this.meshes=[];}
}
