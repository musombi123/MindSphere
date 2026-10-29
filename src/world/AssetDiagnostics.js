const getState=()=>window.__worldDebug||(window.__worldDebug={
 photos:[],modelsLoaded:[],missingAssets:[],primitives:[
  'Gameplay effects use geometry for weapon projectiles, the Aegis shield, Echo Shard crystals and chapter-specific anomaly effects.',
  'Tree, fence and homestead layers are photographic billboards from your video. Near-range scanned GLB models are still missing.'
 ],performance:{fps:0,drawCalls:0,triangles:0,gpuMs:null}
});

export function installWorldDebugPanel(){
 const d=getState();if(document.getElementById('world-asset-missing-banner'))return d;
 const banner=document.createElement('div');banner.id='world-asset-missing-banner';
 Object.assign(banner.style,{position:'fixed',top:'58px',left:'50%',transform:'translateX(-50%)',zIndex:'10000',maxWidth:'min(850px,calc(100vw - 24px))',padding:'9px 13px',border:'1px solid #ff6565',borderRadius:'8px',background:'rgba(88,4,12,.96)',color:'#fff',font:'800 12px/1.4 ui-monospace,monospace',boxShadow:'0 5px 22px #0009',display:'none',pointerEvents:'none'});
 banner.setAttribute('role','alert');

 const loader=document.createElement('div');loader.id='world-photo-loader';
 Object.assign(loader.style,{position:'fixed',left:'50%',bottom:'22px',transform:'translateX(-50%)',zIndex:'9999',width:'min(360px,calc(100vw - 30px))',padding:'12px 15px',background:'rgba(5,13,18,.92)',border:'1px solid #9bb9c755',borderRadius:'10px',color:'#edfaff',font:'800 10px/1.4 ui-monospace,monospace',boxShadow:'0 8px 28px #0008',display:'none'});
 const loadTitle=document.createElement('div');loadTitle.textContent='LOADING YOUR BUNGOMA PHOTO ASSETS';loadTitle.style.letterSpacing='.08em';
 const track=document.createElement('div');Object.assign(track.style,{height:'5px',marginTop:'8px',overflow:'hidden',borderRadius:'99px',background:'#cfe8ee22'});
 const fill=document.createElement('div');Object.assign(fill.style,{height:'100%',width:'0%',background:'#83e5ce',transition:'width .12s linear'});track.append(fill);
 const loadTip=document.createElement('div');loadTip.textContent='Preparing textures from your uploaded video…';Object.assign(loadTip.style,{marginTop:'6px',fontWeight:'500',color:'#a9c5cd'});
 loader.append(loadTitle,track,loadTip);

 const panel=document.createElement('section');panel.id='world-debug-panel';
 Object.assign(panel.style,{position:'fixed',inset:'5vh 4vw',zIndex:'10001',background:'rgba(6,12,16,.98)',color:'#effaff',border:'1px solid #83b6c5',borderRadius:'12px',padding:'18px',overflow:'auto',font:'12px/1.5 ui-monospace,monospace',boxShadow:'0 20px 70px #000b',display:'none'});
 const heading=document.createElement('div');Object.assign(heading.style,{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px',marginBottom:'12px'});
 const title=document.createElement('strong');title.textContent='WORLD ASSET DIAGNOSTICS · F3';title.style.fontSize='16px';
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
 settings.append(setTitle,setNote,select);

 d.updatePerformance=(stats)=>{
  d.performance={...d.performance,...stats};
  const p=d.performance;
  perf.textContent='WORLD PERFORMANCE · F4\nFPS  '+Number(p.fps||0).toFixed(1)+'\nDRAW CALLS  '+Number(p.drawCalls||0)+'\nTRIANGLES  '+Number(p.triangles||0);
  if(body.isConnected&&panel.style.display!=='none')d.render();
 };
 d.render=()=>{
  select.value=window.__worldQuality||'medium';
  body.replaceChildren(settings,
   section('Photos used from the uploaded video',d.photos),
   section('Models loaded',d.modelsLoaded),
   section('Missing assets — see red banner',d.missingAssets,true),
   section('Geometry / primitives remaining',d.primitives),
   section('Performance snapshot',[
    'FPS: '+Number(d.performance.fps||0).toFixed(1),
    'Draw calls: '+Number(d.performance.drawCalls||0),
    'Triangles: '+Number(d.performance.triangles||0)
   ])
  );
  if(d.missingAssets.length){const x=d.missingAssets[0];banner.textContent='ASSET MISSING: '+x.path+(d.missingAssets.length>1?' (+'+(d.missingAssets.length-1)+' more — open F3)':'');banner.style.display='block';}
  else banner.style.display='none';
  const uniquePaths=[...new Set(d.photos.map(p=>p.path))];
  const loadingPaths=uniquePaths.filter(path=>d.photos.some(p=>p.path===path&&p.status==='loading'));
  const total=uniquePaths.length,loaded=uniquePaths.filter(path=>d.photos.some(p=>p.path===path&&p.status==='loaded')).length;
  fill.style.width=(total?Math.round(loaded/total*100):0)+'%';
  loadTip.textContent=loaded+' / '+total+' source photos ready · photo-based world assets';
  loader.style.display=total>0&&loadingPaths.length?'block':'none';
 };
 d.render();
 window.addEventListener('keydown',e=>{
  if(e.repeat)return;
  if(e.key==='F3'){e.preventDefault();panel.style.display=panel.style.display==='none'?'block':'none';}
  if(e.key==='F4'){e.preventDefault();perf.style.display=perf.style.display==='none'?'block':'none';}
 });
 return d;
}
export function recordPhotoUsed(path,role,status='loading'){
 const d=installWorldDebugPanel();const old=d.photos.find(p=>p.path===path&&p.role===role);
 if(old)old.status=status;else d.photos.push({path,role,status});d.render?.();
}
export function recordModelLoaded(path){
 const d=installWorldDebugPanel();if(!d.modelsLoaded.some(m=>m.path===path))d.modelsLoaded.push({path,status:'loaded'});d.render?.();
}
export function registerMissingAsset(path,reason='Required file is not present in the repository'){
 const d=installWorldDebugPanel();if(!d.missingAssets.some(x=>x.path===path))d.missingAssets.push({path,reason});d.render?.();
}
export function recordWorldNote(note){
 const d=installWorldDebugPanel();if(!d.primitives.includes(note))d.primitives.push(note);d.render?.();
}
export function updateWorldPerformanceStats(stats){
 const d=installWorldDebugPanel();d.updatePerformance?.(stats);
}
