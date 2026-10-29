import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const BungomaFilmShader = {
 uniforms: { tDiffuse:{value:null}, uVignette:{value:.12}, uGrain:{value:.006}, uWarmth:{value:.018}, uTime:{value:0} },
 vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader: 'uniform sampler2D tDiffuse;uniform float uVignette;uniform float uGrain;uniform float uWarmth;uniform float uTime;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 p=vUv-0.5;float v=1.0-uVignette*dot(p,p)*2.4;float n=fract(sin(dot(gl_FragCoord.xy+uTime,vec2(12.9898,78.233)))*43758.5453)-0.5;c.rgb*=v;c.r+=uWarmth*c.g;c.b-=uWarmth*0.7;c.rgb+=(n*uGrain);gl_FragColor=c;}'
};

export class Postprocessing {
 constructor({renderer,scene,camera,sun,quality='medium'}){
  this.renderer=renderer;this.scene=scene;this.camera=camera;this.sun=sun;
  this.composer=new EffectComposer(renderer);
  this.renderPass=new RenderPass(scene,camera);
  this.composer.addPass(this.renderPass);
  this.ssaoPass=null;this.bloomPass=null;this.filmPass=null;this.smaaPass=null;this.outputPass=null;
  this.clock=0;this.setQuality(quality);
 }
 rebuildPasses(){
  this.composer.passes.length=0;
  this.composer.addPass(this.renderPass);
  this.ssaoPass=null;this.bloomPass=null;this.filmPass=null;this.smaaPass=null;this.outputPass=null;
  if(this.quality==='medium'||this.quality==='high'){
   this.bloomPass=new UnrealBloomPass(new THREE.Vector2(window.innerWidth,window.innerHeight),this.quality==='high'?.22:.12,.42,.84);
   this.composer.addPass(this.bloomPass);
  }
  if(this.quality==='high'){
   this.ssaoPass=new SSAOPass(this.scene,this.camera,Math.max(1,Math.floor(window.innerWidth*.8)),Math.max(1,Math.floor(window.innerHeight*.8)));
   this.ssaoPass.kernelRadius=8;this.ssaoPass.minDistance=.001;this.ssaoPass.maxDistance=.12;
   this.composer.addPass(this.ssaoPass);
  }
  this.filmPass=new ShaderPass(BungomaFilmShader);
  this.filmPass.uniforms.uVignette.value=this.quality==='high'?.14:this.quality==='medium'?.095:.045;
  this.filmPass.uniforms.uGrain.value=this.quality==='high'?.009:this.quality==='medium'?.005:.002;
  this.composer.addPass(this.filmPass);
  if(this.quality!=='low'){
   this.smaaPass=new SMAAPass(Math.floor(window.innerWidth*this.renderer.getPixelRatio()),Math.floor(window.innerHeight*this.renderer.getPixelRatio()));
   this.composer.addPass(this.smaaPass);
  }
  this.outputPass=new OutputPass();
  this.composer.addPass(this.outputPass);
 }
 setQuality(quality){
  this.quality=quality;
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.renderer.toneMappingExposure=quality==='high'?1.1:quality==='medium'?1.04:.98;
  this.renderer.shadowMap.enabled=quality!=='low';
  this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const pixelRatio=Math.min(window.devicePixelRatio||1,quality==='high'?1.55:quality==='medium'?1.12:.82);
  this.renderer.setPixelRatio(pixelRatio);
  this.renderer.setSize(window.innerWidth,window.innerHeight);
  if(this.sun){
   this.sun.castShadow=quality!=='low';
   this.sun.shadow.mapSize.set(quality==='high'?2048:quality==='medium'?1024:512,quality==='high'?2048:quality==='medium'?1024:512);
   Object.assign(this.sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:.5,far:170});
   this.sun.shadow.bias=-0.00018;this.sun.shadow.normalBias=.025;
   this.sun.shadow.camera.updateProjectionMatrix();
  }
  this.composer.setPixelRatio(pixelRatio);
  this.composer.setSize(window.innerWidth,window.innerHeight);
  this.rebuildPasses();
 }
 setSize(width,height){
  this.renderer.setSize(width,height);
  this.composer.setSize(width,height);
 }
 render(_scene,_camera){
  this.clock+=1/60;
  if(this.filmPass)this.filmPass.uniforms.uTime.value=this.clock;
  this.composer.render();
 }
 dispose(){
  for(const pass of this.composer.passes){pass.dispose?.();}
  this.composer.dispose();
 }
}
