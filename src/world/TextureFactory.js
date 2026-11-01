import * as THREE from 'three';
import { recordPhotoUsed, registerMissingAsset, installWorldDebugPanel } from './AssetDiagnostics.js';

const ROOT='reference/world/';
const FILES={
 road:ROOT+'video_frame_02s.webp',
 landscape:ROOT+'video_frame_02s.webp',
 fence:ROOT+'video_frame_16s.webp',
 homestead:ROOT+'video_frame_26s.webp'
};
const imageCache=new Map();
function assetUrl(path){return (import.meta.env.BASE_URL||'./')+String(path).replace(/^\/+/,'');}
function loadImage(path,role){
 recordPhotoUsed('/'+path,role,'loading');
 if(imageCache.has(path))return imageCache.get(path).then(image=>{recordPhotoUsed('/'+path,role,'loaded');return image;});
 const promise=new Promise((resolve,reject)=>{
  const image=new Image();image.decoding='async';
  image.onload=()=>{recordPhotoUsed('/'+path,role,'loaded');resolve(image);};
  image.onerror=()=>{registerMissingAsset('/'+path,'A photo extracted from your uploaded video is required for this world surface.');reject(new Error('Required photo missing: '+path));};
  image.src=assetUrl(path);
 });
 imageCache.set(path,promise);return promise;
}
function makeTexture(canvas,srgb,repeat){const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.wrapS=texture.wrapT=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;texture.anisotropy=4;texture.needsUpdate=true;return texture;}
function createProceduralPbr(baseColor, roughnessBase = 0.94) {
 const size=512,albedoCanvas=document.createElement('canvas'),normalCanvas=document.createElement('canvas'),roughCanvas=document.createElement('canvas');
 for(const canvas of [albedoCanvas,normalCanvas,roughCanvas])canvas.width=canvas.height=size;
 const albedoCtx=albedoCanvas.getContext('2d'),normalCtx=normalCanvas.getContext('2d'),roughCtx=roughCanvas.getContext('2d');
 const albedoImage=albedoCtx.createImageData(size,size),normalImage=normalCtx.createImageData(size,size),roughImage=roughCtx.createImageData(size,size);
 const heights=new Float32Array(size*size);
 const tau=Math.PI*2;
 const clamp=(v)=>Math.max(0,Math.min(255,Math.round(v)));
 for(let y=0;y<size;y++){
  const v=y/size;
  for(let x=0;x<size;x++){
   const u=x/size;
   const coarse=Math.sin(tau*(u*5+Math.sin(v*tau*3)*.11))*.52+Math.cos(tau*(v*6+Math.sin(u*tau*4)*.09))*.48;
   const medium=Math.sin(tau*(u*19+v*13))*.42+Math.cos(tau*(u*31-v*23))*.34+Math.sin(tau*(u*43+v*37))*.24;
   const fine=Math.sin(tau*(u*97+v*71))*Math.cos(tau*(u*83-v*109));
   const h=coarse*.46+medium*.24+fine*.08;
   const grain=(Math.sin(tau*(u*157+v*131))*.5+Math.cos(tau*(u*113-v*173))*.5)*7;
   const index=(y*size+x)*4;
   heights[y*size+x]=h;
   albedoImage.data[index]=clamp(baseColor[0]+coarse*17+medium*11+grain);
   albedoImage.data[index+1]=clamp(baseColor[1]+coarse*13+medium*9+grain*.68);
   albedoImage.data[index+2]=clamp(baseColor[2]+coarse*9+medium*7+grain*.42);
   albedoImage.data[index+3]=255;
   const rough=clamp((roughnessBase+(Math.abs(medium)*.035))*255);
   roughImage.data[index]=roughImage.data[index+1]=roughImage.data[index+2]=rough;
   roughImage.data[index+3]=255;
  }
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const left=heights[y*size+(x-1+size)%size],right=heights[y*size+(x+1)%size];
  const up=heights[((y-1+size)%size)*size+x],down=heights[((y+1)%size)*size+x];
  const nx=(left-right)*2.3,ny=(up-down)*2.3,len=Math.sqrt(nx*nx+ny*ny+1),i=(y*size+x)*4;
  normalImage.data[i]=clamp(128+nx/len*127);
  normalImage.data[i+1]=clamp(128+ny/len*127);
  normalImage.data[i+2]=clamp(128+127/len);
  normalImage.data[i+3]=255;
 }
 albedoCtx.putImageData(albedoImage,0,0);normalCtx.putImageData(normalImage,0,0);roughCtx.putImageData(roughImage,0,0);
 const albedo=makeTexture(albedoCanvas,true,true),normal=makeTexture(normalCanvas,false,true),roughness=makeTexture(roughCanvas,false,true);
 return {albedo,normal,roughness,sourcePath:'procedural-pbr'};
}
function drawCrop(ctx,canvas,image,crop,feather){
 const [u,v,w,h]=crop||[0,0,1,1];ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(image,Math.floor(image.width*u),Math.floor(image.height*v),Math.max(1,Math.floor(image.width*w)),Math.max(1,Math.floor(image.height*h)),0,0,canvas.width,canvas.height);
 if(feather){const im=ctx.getImageData(0,0,canvas.width,canvas.height),d=im.data,fx=canvas.width*.07,fy=canvas.height*.09;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const e=Math.min(x/fx,(canvas.width-1-x)/fx,y/fy,(canvas.height-1-y)/fy,1);d[(y*canvas.width+x)*4+3]=Math.round(255*THREE.MathUtils.smoothstep(e,0,1));}ctx.putImageData(im,0,0);}
}
function surface(name,path,crop){
 const size=512,albedoCanvas=document.createElement('canvas'),normalCanvas=document.createElement('canvas'),roughCanvas=document.createElement('canvas');
 for(const c of [albedoCanvas,normalCanvas,roughCanvas])c.width=c.height=size;
 const albedoCtx=albedoCanvas.getContext('2d',{willReadFrequently:true}),normalCtx=normalCanvas.getContext('2d'),roughCtx=roughCanvas.getContext('2d');
 const albedo=makeTexture(albedoCanvas,true,true),normal=makeTexture(normalCanvas,false,true),roughness=makeTexture(roughCanvas,false,true);
 loadImage(path,name).then(image=>{
  drawCrop(albedoCtx,albedoCanvas,image,crop,false);
  const src=albedoCtx.getImageData(0,0,size,size),norm=normalCtx.createImageData(size,size),rough=roughCtx.createImageData(size,size),lum=new Float32Array(size*size);
  for(let i=0;i<lum.length;i++)lum[i]=(src.data[i*4]*.2126+src.data[i*4+1]*.7152+src.data[i*4+2]*.0722)/255;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,L=lum[y*size+Math.max(0,x-1)],R=lum[y*size+Math.min(size-1,x+1)],U=lum[Math.max(0,y-1)*size+x],D=lum[Math.min(size-1,y+1)*size+x],nx=(L-R)*2.5,ny=(U-D)*2.5,len=Math.sqrt(nx*nx+ny*ny+1);norm.data[i*4]=128+nx/len*127;norm.data[i*4+1]=128+ny/len*127;norm.data[i*4+2]=128+127/len;norm.data[i*4+3]=255;const q=Math.round(THREE.MathUtils.clamp(.96-(Math.abs(L-R)+Math.abs(U-D))*.38,.55,1)*255);rough.data[i*4]=rough.data[i*4+1]=rough.data[i*4+2]=q;rough.data[i*4+3]=255;}
  normalCtx.putImageData(norm,0,0);roughCtx.putImageData(rough,0,0);albedo.needsUpdate=normal.needsUpdate=roughness.needsUpdate=true;
 }).catch(()=>{});
 return {albedo,normal,roughness,sourcePath:'/'+path};
}
function photo(name,path,crop,{feather=true,foliageKey=false}={}){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const ctx=canvas.getContext('2d',{willReadFrequently:true}),texture=makeTexture(canvas,true,false);
 loadImage(path,name).then(image=>{
  drawCrop(ctx,canvas,image,crop,feather);
  if(foliageKey){
   const im=ctx.getImageData(0,0,canvas.width,canvas.height),d=im.data;
   for(let i=0;i<d.length;i+=4){
    const r=d[i],g=d[i+1],b=d[i+2],bright=(r+g+b)/3;
    const sky=(b>r*1.16&&g>r*1.1&&b>80)||(bright>205&&Math.max(r,g,b)-Math.min(r,g,b)<26);
    const soil=(r>g*1.2&&r>b*1.25&&r>64);
    const green=g>r*1.08&&g>b*.93&&g>38;
    if(sky||soil||!green)d[i+3]=0;
    else d[i+3]=Math.round(d[i+3]*THREE.MathUtils.smoothstep(g-r,2,22));
   }
   ctx.putImageData(im,0,0);
  }
  texture.needsUpdate=true;
 }).catch(()=>{});
 return texture;
}
export function createPhotoPbrTextures(){
 installWorldDebugPanel();
 return {
  road:createProceduralPbr([132,70,43],.96),
  laterite:createProceduralPbr([145,81,49],.95),
  mud:createProceduralPbr([89,62,43],.98),
  rock:createProceduralPbr([112,104,86],.96),
  ground:createProceduralPbr([86,96,58],.98),
  grass:createProceduralPbr([76,101,49],.97),
  dryGrass:createProceduralPbr([121,107,64],.98),
  bark:surface('tree trunk photo crop',FILES.fence,[.11,0,.22,.90]),
  wood:surface('weathered timber fence photo crop',FILES.fence,[.02,.22,.96,.60]),
  metal:surface('corrugated roof photo crop',FILES.homestead,[0,0,1,.31]),
  leaf:surface('leaf canopy photo crop',FILES.fence,[0,0,1,.43]),
  photo:{
   sky:photo('photo sky and skyline strip',FILES.landscape,[0,0,1,.58]),
   horizon:photo('rural road and tree-line backdrop',FILES.landscape,[0,.17,1,.56]),
   treeLine:photo('distant tree-line photo panel',FILES.landscape,[0,.22,1,.43]),
   treeCutout:photo('tree canopy foliage alpha cutout from user video',FILES.landscape,[.12,.16,.76,.40],{feather:true,foliageKey:true}),
   plants:photo('green understory alpha cutout from user garden photo',FILES.fence,[0,.58,1,.40],{feather:true,foliageKey:true}),
   vegetation:photo('garden and fence photo',FILES.fence,[0,0,1,1]),
   fence:photo('hand-built timber fence photo',FILES.fence,[0,.1,1,.72]),
   homestead:photo('rural homestead and corrugated roof photo',FILES.homestead,[0,0,1,1])
  }
 };
}
export const createProceduralPbrTextures=createPhotoPbrTextures;
export async function loadOptionalPbrMaps(){return null;}
