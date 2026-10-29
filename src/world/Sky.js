import * as THREE from 'three';
export class Sky {
 constructor({scene,sun,hemi,quality='medium'}) {
  this.scene=scene;this.sun=sun;this.hemi=hemi;this.quality=quality;this.clouds=[];
  const skyGeo=new THREE.SphereGeometry(420,32,20);
  const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uDusk:{value:0}},vertexShader:'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 vPos; uniform float uDusk; void main(){float h=max(normalize(vPos).y,0.0);vec3 horizon=mix(vec3(0.78,0.73,0.60),vec3(0.52,0.39,0.35),uDusk);vec3 zenith=mix(vec3(0.20,0.42,0.59),vec3(0.08,0.15,0.27),uDusk);gl_FragColor=vec4(mix(horizon,zenith,pow(h,0.55)),1.0);}'});
  this.sky=new THREE.Mesh(skyGeo,skyMat);this.sky.name='PROCEDURAL_BUNGOMA_SKY';this.sky.frustumCulled=false;scene.add(this.sky);
  const count=quality==='high'?16:quality==='medium'?9:4;const cloudMat=new THREE.MeshBasicMaterial({color:0xf2e8d3,transparent:true,opacity:.14,depthWrite:false});
  for(let i=0;i<count;i++){const g=new THREE.Group();for(let p=0;p<4;p++){const puff=new THREE.Mesh(new THREE.SphereGeometry(2+(p%2),8,6),cloudMat);puff.position.set((p-1.5)*2,Math.sin(p+i)*.3,Math.cos(p+i)*1.1);puff.scale.y=.3;g.add(puff);}g.position.set(Math.sin(i*13.7)*100,45+(i%4)*6,-85-i*17);g.userData.x=g.position.x;g.userData.speed=.15+(i%4)*.04;scene.add(g);this.clouds.push(g);}
  this.hills=[];for(let layer=0;layer<3;layer++){const points=[];for(let i=0;i<=60;i++){const x=-190+i/60*380;points.push(new THREE.Vector2(x,3+Math.sin(i*.23+layer*1.6)*4+Math.sin(i*.08+layer)*7+layer*2));}points.push(new THREE.Vector2(190,-12),new THREE.Vector2(-190,-12));const mesh=new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(points)),new THREE.MeshStandardMaterial({color:[0x526b62,0x6d8171,0x87927d][layer],transparent:true,opacity:.5-layer*.09,depthWrite:false,roughness:1}));mesh.position.z=-165-layer*18;scene.add(mesh);this.hills.push(mesh);}
  this.setTimeOfDay(.36);
 }
 setTimeOfDay(t=.36){const dusk=THREE.MathUtils.smoothstep(t,.68,.95);this.sky.material.uniforms.uDusk.value=dusk;const a=(t-.25)*Math.PI;this.sun.position.set(Math.cos(a)*46,Math.max(9,Math.sin(a)*52),22);this.sun.intensity=1.45+Math.sin(a)*.9;this.sun.color.setHSL(.105-dusk*.04,.45,.72);this.hemi.intensity=1.5-dusk*.5;}
 update(dt,elapsed){for(const c of this.clouds)c.position.x=c.userData.x+Math.sin(elapsed*.012+c.position.z)*5+elapsed*c.userData.speed*.04;}
 setQuality(q){this.quality=q;}
 dispose(){this.scene.remove(this.sky);this.sky.geometry.dispose();this.sky.material.dispose();for(const c of this.clouds){this.scene.remove(c);c.traverse(o=>{if(o.geometry)o.geometry.dispose();});}for(const h of this.hills){this.scene.remove(h);h.geometry.dispose();h.material.dispose();}}
}