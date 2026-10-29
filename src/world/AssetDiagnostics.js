const getState=()=>window.__worldDebug||(window.__worldDebug={photos:[],modelsLoaded:[],missingAssets:[],primitives:[
'Mission effects remain geometry-based for gameplay compatibility: projectiles, the Aegis shield, pickup crystals, chapter-2 river surge and chapter-3 phase effects.',
'Near-range tree/home/fence GLBs have not been supplied yet; photo billboards are not 3D models.'
]});
export function installWorldDebugPanel(){
 const d=getState();if(document.getElementById('world-asset-missing-banner'))return d;
 const style=(o)=>Object.assign(document.createElement('div').style,o);
 const banner=document.createElement('div');banner.id='world-asset-missing-banner';Object.assign(banner.style,{position:'fixed',top:'58px',left:'50%',transform:'translateX(-50%)',zIndex:'10000',maxWidth:'min(850px,calc(100vw - 24px))',padding:'9px 13px',border:'1px solid #ff6565',borderRadius:'8px',background:'rgba(88,4,12,.96)',color:'#fff',font:'800 12px/1.4 ui-monospace,monospace',boxShadow:'0 5px 22px #0009',display:'none',pointerEvents:'none'});
 banner.setAttribute('role','alert');
 const panel=document.createElement('section');panel.id='world-debug-panel';Object.assign(panel.style,{position:'fixed',inset:'5vh 4vw',zIndex:'10001',background:'rgba(6,12,16,.98)',color:'#effaff',border:'1px solid #83b6c5',borderRadius:'12px',padding:'18px',overflow:'auto',font:'12px/1.5 ui-monospace,monospace',boxShadow:'0 20px 70px #000b',display:'none'});
 const head=document.createElement('div');Object.assign(head.style,{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'});
 const title=document.createElement('strong');title.textContent='WORLD ASSET DIAGNOSTICS · F3';title.style.fontSize='16px';
 const close=document.createElement('button');close.textContent='CLOSE';close.onclick=()=>panel.style.display='none';head.append(title,close);
 const body=document.createElement('div');body.id='world-debug-panel-body';panel.append(head,body);document.body.append(banner,panel);
 const section=(label,items,bad=false)=>{const wrap=document.createElement('section');wrap.style.margin='14px 0';const h=document.createElement('h3');h.textContent=label+' ('+items.length+')';Object.assign(h.style,{fontSize:'13px',color:bad?'#ff7777':'#86e5f0',margin:'0 0 5px'});const ul=document.createElement('ul');ul.style.paddingLeft='20px';if(!items.length){const li=document.createElement('li');li.textContent='None';ul.append(li);}for(const item of items){const li=document.createElement('li');li.style.marginBottom='4px';li.style.overflowWrap='anywhere';li.style.color=bad?'#ffb2b2':'#d5e7ec';li.textContent=typeof item==='string'?item:[item.path,item.role,item.status,item.reason].filter(Boolean).join(' — ');ul.append(li);}wrap.append(h,ul);return wrap;};
 d.render=()=>{body.replaceChildren(section('Photos used from uploaded video',d.photos),section('Models loaded',d.modelsLoaded),section('Missing assets — action required',d.missingAssets,true),section('Geometry / primitives remaining',d.primitives));if(d.missingAssets.length){const x=d.missingAssets[0];banner.textContent='ASSET MISSING: '+x.path+(d.missingAssets.length>1?' (+'+(d.missingAssets.length-1)+' more — open F3)':'');banner.style.display='block';}else banner.style.display='none';};d.render();
 window.addEventListener('keydown',e=>{if(e.key==='F3'&&!e.repeat){e.preventDefault();panel.style.display=panel.style.display==='none'?'block':'none';}});
 return d;
}
export function recordPhotoUsed(path,role,status='loading'){const d=installWorldDebugPanel();const old=d.photos.find(p=>p.path===path&&p.role===role);if(old)old.status=status;else d.photos.push({path,role,status});d.render?.();}
export function recordModelLoaded(path){const d=installWorldDebugPanel();if(!d.modelsLoaded.some(m=>m.path===path))d.modelsLoaded.push({path,status:'loaded'});d.render?.();}
export function registerMissingAsset(path,reason='Required file is not present in the repository'){const d=installWorldDebugPanel();if(!d.missingAssets.some(x=>x.path===path))d.missingAssets.push({path,reason});d.render?.();}

export function recordWorldNote(note){const d=installWorldDebugPanel();if(!d.primitives.includes(note))d.primitives.push(note);d.render?.();}
