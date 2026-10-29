import * as THREE from 'three';
import { registerMissingAsset } from './AssetDiagnostics.js';

export class Weather {
 constructor({scene,quality='medium',settings={}}){
  this.scene=scene;this.quality=quality;this.settings=settings;this.elapsed=0;
  this.createParticles();
 }
 createParticles(){
  const count=this.quality==='high'?480:this.quality==='medium'?240:74;
  const positions=new Float32Array(count*3);
  let seed=777;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<count;i++){positions[i*3]=(random()-.5)*70;positions[i*3+1]=random()*18;positions[i*3+2]=10-random()*100;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  this.particles=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xe7d9be,size:this.quality==='high'?.08:.055,transparent:true,opacity:this.quality==='high'?.26:.2,depthWrite:false,sizeAttenuation:true}));
  this.particles.name='PHOTO-MATCHED DUST AND POLLEN';this.scene.add(this.particles);
 }
 update(dt,elapsed){
  this.elapsed=elapsed;const a=this.particles.geometry.attributes.position;
  for(let i=0;i<a.count;i++){
   const k=i*3;
   a.array[k]+=(Math.sin(elapsed*.17+i)*.055+.02)*dt;
   a.array[k+1]+=(.08+Math.sin(i*1.7+elapsed*.4)*.018)*dt;
   a.array[k+2]+=Math.cos(elapsed*.12+i)*.025*dt;
   if(a.array[k+1]>19)a.array[k+1]=0;
   if(a.array[k]<-38)a.array[k]=38;
   if(a.array[k]>38)a.array[k]=-38;
  }
  a.needsUpdate=true;
 }
 setWeather(type='clear'){
  if(type==='rain'){
   if(!this.rain){const count=this.quality==='high'?420:this.quality==='medium'?180:0;if(count){const positions=new Float32Array(count*3);this.rainGeometry=new THREE.BufferGeometry();this.rainGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));this.rain=new THREE.Points(this.rainGeometry,new THREE.PointsMaterial({color:0xb5cbd4,size:.06,transparent:true,opacity:.42,depthWrite:false}));this.rain.name='OPTIONAL_LIGHT_RAIN';this.scene.add(this.rain);}}
  }else if(this.rain){this.scene.remove(this.rain);this.rainGeometry.dispose();this.rain.material.dispose();this.rain=null;}
 }
 setQuality(q){
  if(q===this.quality)return;this.scene.remove(this.particles);this.particles.geometry.dispose();this.particles.material.dispose();this.quality=q;this.createParticles();
 }
 dispose(){this.scene.remove(this.particles);this.particles.geometry.dispose();this.particles.material.dispose();if(this.rain){this.scene.remove(this.rain);this.rainGeometry.dispose();this.rain.material.dispose();}}
}
