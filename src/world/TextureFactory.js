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
function photo(name,path,crop){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const ctx=canvas.getContext('2d',{willReadFrequently:true}),texture=makeTexture(canvas,true,false);
 loadImage(path,name).then(image=>{drawCrop(ctx,canvas,image,crop,true);texture.needsUpdate=true;}).catch(()=>{});
 return texture;
}
export function createPhotoPbrTextures(){
 installWorldDebugPanel();
 return {
  road:surface('red laterite road albedo and photo-derived PBR',FILES.road,[.05,.42,.90,.39]),
  laterite:surface('red laterite soil crop',FILES.road,[.05,.54,.90,.34]),
  mud:surface('darker red soil crop',FILES.road,[.13,.55,.74,.26]),
  rock:surface('roadside earth crop',FILES.road,[.08,.51,.84,.30]),
  ground:surface('garden ground photo',FILES.fence,[0,.38,1,.60]),
  grass:surface('green garden ground photo',FILES.fence,[0,.46,1,.52]),
  dryGrass:surface('road verge ground cover photo',FILES.landscape,[0,.57,1,.37]),
  bark:surface('tree trunk photo crop',FILES.fence,[.11,0,.22,.90]),
  wood:surface('weathered timber fence photo crop',FILES.fence,[.02,.22,.96,.60]),
  metal:surface('corrugated roof photo crop',FILES.homestead,[0,0,1,.31]),
  leaf:surface('leaf canopy photo crop',FILES.fence,[0,0,1,.43]),
  photo:{
   sky:photo('photo sky and skyline strip',FILES.landscape,[0,0,1,.58]),
   horizon:photo('rural road and tree-line backdrop',FILES.landscape,[0,.17,1,.56]),
   treeLine:photo('distant tree-line photo panel',FILES.landscape,[0,.22,1,.43]),
   vegetation:photo('garden and fence photo',FILES.fence,[0,0,1,1]),
   fence:photo('hand-built timber fence photo',FILES.fence,[0,.1,1,.72]),
   homestead:photo('rural homestead and corrugated roof photo',FILES.homestead,[0,0,1,1])
  }
 };
}
export const createProceduralPbrTextures=createPhotoPbrTextures;
export async function loadOptionalPbrMaps(){return null;}
