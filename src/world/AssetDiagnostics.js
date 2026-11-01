const getState=()=>window.__worldDebug||(window.__worldDebug={
 photos:[],modelsLoaded:[],missingAssets:[],optionalAssets:[],tasks:{},primitives:[
  'Terrain, the laterite road, roadside stones, tree canopies and undergrowth are rendered as 3D geometry.',
  'Catalog GLBs not yet mapped are optional art upgrades, not failed runtime requests. See ASSETS_NEEDED.md.'
 ],performance:{fps:0,drawCalls:0,triangles:0,geometries:0,textures:0,jsHeapMb:null,gpuMs:null}
});
const ensureStateShape=(d)=>{
 if(!d.tasks)d.tasks={};
 d.performance={fps:0,drawCalls:0,triangles:0,geometries:0,textures:0,jsHeapMb:null,...(d.performance||{})};
 return d;
}

export function installWorldDebugPanel(){
 const d=ensureStateShape(getState());if(document.getElementById('world-asset-missing-banner'))return d;
 const banner=document.createElement('div');banner.id='world-asset-missing-banner';
 Object.assign(banner.style,{position:'fixed',top:'58px',left:'50%',transform:'translateX(-50%)',zIndex:'10000',maxWidth:'min(850px,calc(100vw - 24px))',padding:'9px 13px',border:'1px solid #ff6565',borderRadius:'8px',background:'rgba(88,4,12,.96)',color:'#fff',font:'800 12px/1.4 ui-monospace,monospace',boxShadow:'0 5px 22px #0009',display:'none',pointerEvents:'none'});
 banner.setAttribute('role','alert');

 const loader=document.createElement('div');loader.id='world-photo-loader';
 Object.assign(loader.style,{position:'fixed',left:'50%',bottom:'22px',transform:'translateX(-50%)',zIndex:'9999',width:'min(360px,calc(100vw - 30px))',padding:'12px 15px',background:'rgba(5,13,18,.92)',border:'1px solid #9bb9c755',borderRadius:'10px',color:'#edfaff',font:'800 10px/1.4 ui-monospace,monospace',boxShadow:'0 8px 28px #0008',display:'none'});
 const loadTitle=document.createElement('div');loadTitle.textContent='LOADING PROJECT ZERO HOUR ASSETS';loadTitle.style.letterSpacing='.08em';
 const track=document.createElement('div');Object.assign(track.style,{height:'5px',marginTop:'8px',overflow:'hidden',borderRadius:'99px',background:'#cfe8ee22'});
 const fill=document.createElement('div');Object.assign(fill.style,{height:'100%',width:'0%',background:'#83e5ce',transition:'width .12s linear'});track.append(fill);
 const loadTip=document.createElement('div');loadTip.textContent='Preparing textures from your uploaded video…';Object.assign(loadTip.style,{marginTop:'6px',fontWeight:'500',color:'#a9c5cd'});
 loader.append(loadTitle,track,loadTip);

 const panel=document.createElement('section');panel.id='world-debug-panel';
 Object.assign(panel.style,{position:'fixed',inset:'5vh 4vw',zIndex:'10001',background:'rgba(6,12,16,.98)',color:'#effaff',border:'1px solid #83b6c5',borderRadius:'12px',padding:'18px',overflow:'auto',font:'12px/1.5 ui-monospace,monospace',boxShadow:'0 20px 70px #000b',display:'none'});
 const heading=document.createElement('div');Object.assign(heading.style,{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px',marginBottom:'12px'});
 const title=document.createElement('strong');title.textContent='WORLD ASSET DIAGNOSTICS · F3 / 3-FINGER TAP';title.style.fontSize='16px';
 const close=document.createElement('button');close.textContent='CLOSE';close.onclick=()=>panel.style.display='none';heading.append(title,close);
 const body=document.createElement('div');body.id='world-debug-panel-body';panel.append(heading,body);
 const perf=document.createElement('div');perf.id='world-performance-overlay';
 Object.assign(perf.style,{position:'fixed',left:'12px',bottom:'12px',zIndex:'10002',padding:'8px 11px',border:'1px solid #8bcbd488',borderRadius:'8px',background:'rgba(3,11,15,.9)',color:'#dffaff',font:'11px/1.45 ui-monospace,monospace',whiteSpace:'pre',pointerEvents:'none',display:'none'});
 document.body.append(banner,loader,panel,perf);

 const section=(label,items,bad=false)=>{
  const wrap=document.createElement('section');wrap.style.margin='14px 0';
  const h=document.createElement('h3');h.textContent=label+' ('+items.length+')';
  Object.assign(h.style,{fontSize:'13px',color:bad?'#ff7777':'#86e5f0',margin:'0 0 5px'});
  const ul=document.createElement('ul');ul.style.paddingLeft='20px';
  if(!items.length){const li=document.createElement('li');li.textContent='None';ul.append(li);}
  for(const item of items){const li=document.createElement('li');li.style.marginBottom='4px';li.style.overflowWrap='anywhere';li.style.color=bad?'#ffb2b2':'#d5e7ec';li.textContent=typeof item==='string'?item:[item.path,item.role,item.status,item.reason].filter(Boolean).join(' — ');ul.append(li);}
  wrap.append(h,ul);return wrap;
 };
 const settings=document.createElement('section');settings.style.margin='14px 0';
 const setTitle=document.createElement('h3');setTitle.textContent='WORLD SETTINGS · QUALITY PRESET';Object.assign(setTitle.style,{fontSize:'13px',color:'#86e5f0',margin:'0 0 5px'});
 const setNote=document.createElement('p');setNote.textContent='Low is recommended for entry-level phones. High enables SSAO, stronger bloom and higher-resolution shadows.';Object.assign(setNote.style,{margin:'0 0 8px',color:'#bfd0d5'});
 const select=document.createElement('select');select.id='world-quality-selector';Object.assign(select.style,{padding:'7px 10px',background:'#10232b',color:'#f1fbff',border:'1px solid #5c828e',borderRadius:'6px'});
 for(const [value,label] of [['low','Low · mobile performance'],['medium','Medium · balanced'],['high','High · visual quality']]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
 select.value=window.__worldQuality||'medium';
 select.onchange=()=>{const set=window.__setWorldQuality;if(typeof set==='function')set(select.value);};

 const weatherTitle=document.createElement('h3');weatherTitle.textContent='ATMOSPHERE · WEATHER PROFILE';
 Object.assign(weatherTitle.style,{fontSize:'13px',color:'#86e5f0',margin:'14px 0 5px'});
 const weatherNote=document.createElement('p');weatherNote.textContent='Chapter defaults: clear dust, Nzoia storm, and phase anomaly. Override here for testing.';
 Object.assign(weatherNote.style,{margin:'0 0 8px',color:'#bfd0d5'});
 const weatherSelect=document.createElement('select');weatherSelect.id='world-weather-selector';
 Object.assign(weatherSelect.style,{padding:'7px 10px',background:'#10232b',color:'#f1fbff',border:'1px solid #5c828e',borderRadius:'6px'});
 for(const [value,label] of [['clear','Clear · late-morning air'],['dust','Dust · dry wind'],['rain','Rain · overcast'],['storm','Storm · wind and lightning'],['anomaly','Echo · phase atmosphere']]){
  const option=document.createElement('option');option.value=value;option.textContent=label;weatherSelect.append(option);
 }
 weatherSelect.value=window.__worldWeather||'clear';
 weatherSelect.onchange=()=>{const set=window.__setWorldWeather;if(typeof set==='function')set(weatherSelect.value);};
 settings.append(setTitle,setNote,select,weatherTitle,weatherNote,weatherSelect);

 d.updatePerformance=(stats)=>{
  d.performance={...d.performance,...stats};
  const p=d.performance;
  const heap=p.jsHeapMb!=null&&Number.isFinite(Number(p.jsHeapMb))?Number(p.jsHeapMb).toFixed(1)+' MB':'n/a';
  perf.textContent='WORLD PERFORMANCE · F4\nFPS  '+Number(p.fps||0).toFixed(1)+'\nDRAW CALLS  '+Number(p.drawCalls||0)+'\nTRIANGLES  '+Number(p.triangles||0)+'\nGEOMETRIES  '+Number(p.geometries||0)+'\nTEXTURES  '+Number(p.textures||0)+'\nJS HEAP  '+heap;
  if(body.isConnected&&panel.style.display!=='none')d.render();
 };
 d.render=()=>{
  select.value=window.__worldQuality||'medium';
  weatherSelect.value=window.__worldWeather||'clear';
  body.replaceChildren(settings,
   section('Photos used from the uploaded video',d.photos),
   section('Models loaded',d.modelsLoaded),
   section('Required assets that failed to load',d.missingAssets,true),
   section('Optional 3D models not yet mapped',d.optionalAssets),
   section('Geometry / primitives remaining',d.primitives),
   section('Performance snapshot',[
    'FPS: '+Number(d.performance.fps||0).toFixed(1),
    'Draw calls: '+Number(d.performance.drawCalls||0),
    'Triangles: '+Number(d.performance.triangles||0),
    'Geometries: '+Number(d.performance.geometries||0),
    'Textures: '+Number(d.performance.textures||0),
    'JavaScript heap: '+(d.performance.jsHeapMb!=null&&Number.isFinite(Number(d.performance.jsHeapMb))?Number(d.performance.jsHeapMb).toFixed(1)+' MB':'not exposed by this browser')
   ])
  );
  const blockingLayer=Boolean(document.querySelector('.screen-layer:not(.hidden)'));
  if(d.missingAssets.length&&!blockingLayer){const x=d.missingAssets[0];banner.textContent='REQUIRED ASSET FAILED: '+x.path+(d.missingAssets.length>1?' (+'+(d.missingAssets.length-1)+' more — open F3)':'');banner.style.display='block';}
  else banner.style.display='none';
  const uniquePaths=[...new Set(d.photos.map(p=>p.path))];
  const loadingPaths=uniquePaths.filter(path=>d.photos.some(p=>p.path===path&&p.status==='loading'));
  const photoTotal=uniquePaths.length;
  const photoLoaded=uniquePaths.filter(path=>d.photos.some(p=>p.path===path&&p.status==='loaded')).length;
  const tasks=Object.values(d.tasks||{}).filter(task=>Number(task.total)>0);
  const combinedTotal=photoTotal+tasks.reduce((sum,task)=>sum+Number(task.total||0),0);
  const combinedLoaded=photoLoaded+tasks.reduce((sum,task)=>sum+Math.min(Number(task.loaded||0),Number(task.total||0)),0);
  const pendingTask=tasks.find(task=>!task.done);
  const pending=loadingPaths.length>0||Boolean(pendingTask);
  fill.style.width=(combinedTotal?Math.round(combinedLoaded/combinedTotal*100):0)+'%';
  loadTitle.textContent=pendingTask?(pendingTask.label||'LOADING RUNTIME ASSETS'):'LOADING PROJECT ZERO HOUR ASSETS';
  loadTip.textContent=pendingTask
    ? Number(pendingTask.loaded||0)+' / '+Number(pendingTask.total||0)+' · '+(pendingTask.label||'runtime assets')
    : photoLoaded+' / '+photoTotal+' source photos ready · local world textures';
  loader.style.display=pending?'block':'none';
 };
 d.render();
 window.addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.key==='F3'){e.preventDefault();panel.style.display=panel.style.display==='none'?'block':'none';}
  if(e.key==='F4'){e.preventDefault();perf.style.display=perf.style.display==='none'?'block':'none';}
 });
 let threeFingerOpen=false;
 document.addEventListener('touchstart',event=>{
  if(event.touches&&event.touches.length>=3&&!threeFingerOpen){
   threeFingerOpen=true;
   panel.style.display=panel.style.display==='none'?'block':'none';
   d.render?.();
  }
 },{passive:true});
 const releaseThreeFinger=event=>{if(!event.touches||event.touches.length<3)threeFingerOpen=false;};
 document.addEventListener('touchend',releaseThreeFinger,{passive:true});
 document.addEventListener('touchcancel',releaseThreeFinger,{passive:true});
 return d;
}
export function updateAssetTask(key,{label='',loaded=0,total=0,done=false}={}){
 const d=installWorldDebugPanel();
 const taskTotal=Math.max(0,Number(total)||0);
 const taskLoaded=Math.max(0,Math.min(taskTotal,Number(loaded)||0));
 d.tasks[key]={label:String(label||key),loaded:taskLoaded,total:taskTotal,done:Boolean(done)||(taskTotal>0&&taskLoaded>=taskTotal)};
 d.render?.();
}
export function recordPhotoUsed(path,role,status='loading'){
 const d=installWorldDebugPanel();const old=d.photos.find(p=>p.path===path&&p.role===role);
 if(old)old.status=status;else d.photos.push({path,role,status});d.render?.();
}
export function recordModelLoaded(path){
 const d=installWorldDebugPanel();
 if(!d.modelsLoaded.some(m=>m.path===path))d.modelsLoaded.push({path,status:'loaded'});
 d.missingAssets=d.missingAssets.filter(item=>item.path!==path);
 d.render?.();
}
export function registerMissingAsset(path,reason='Required file is not present in the repository'){
 const d=installWorldDebugPanel();if(!d.missingAssets.some(x=>x.path===path))d.missingAssets.push({path,reason});d.render?.();
}
export function resolveMissingAsset(path){
 const d=installWorldDebugPanel();
 const before=d.missingAssets.length;
 d.missingAssets=d.missingAssets.filter(item=>item.path!==path);
 if(d.missingAssets.length!==before)d.render?.();
}
export function recordWorldNote(note){
 const d=installWorldDebugPanel();if(!d.primitives.includes(note))d.primitives.push(note);d.render?.();
}
export function updateWorldPerformanceStats(stats){
 const d=installWorldDebugPanel();d.updatePerformance?.(stats);
}

export function registerOptionalAsset(path,reason='Optional 3D enhancement is not mapped; the current photo/procedural world remains active'){
 const d=installWorldDebugPanel();if(!d.optionalAssets.some(x=>x.path===path))d.optionalAssets.push({path,status:'not mapped',reason});d.render?.();
}
export function resolveOptionalAsset(path){
 const d=installWorldDebugPanel();
 const before=d.optionalAssets.length;
 d.optionalAssets=d.optionalAssets.filter(item=>item.path!==path);
 if(d.optionalAssets.length!==before)d.render?.();
}
