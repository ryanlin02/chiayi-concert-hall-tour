(async()=>{
 await window.cacheBoot;
 const $=id=>document.getElementById(id),cache=window.resourceCache,command=(...args)=>window.bandCommand?.(...args);
 const audio=window.performanceAudio=new ConcertAudio('');
 const integrated=!!window.hallPerformanceIntegrated;
 if(integrated){document.querySelector('.hall-display-options')?.remove();document.body.classList.remove('reduce-glass','reduce-motion');const credits=document.createElement('p');credits.innerHTML='<a href="model-credits.html" target="_blank" rel="noopener" style="color:inherit">演出素材來源與授權 ↗</a>';document.querySelector('[data-info-panel=graphics]')?.append(credits);}
 audio.setSpatial(true);
 if(integrated){document.querySelector('.center-nav').prepend($('performance-panel'));$('performance-panel').querySelector('nav').append($('walk'));}
 let manualLightJob=null;
 const ids=['band','music','lights'],states=new Map();
 let hall={},tourStarted=false,downloaded=false,downloadJob=null,downloadPaused=false,warmJob=null,bandMounted=false,lightsMounted=false,audioUrl=null;
 let downloadMessage='',warmMessage='',lightName='all',notice='',warmDone=false;
 const evidence={events:[],transition:[],warmStarted:0,warmFinished:0,bandBuildMs:0};
 const record=(type,extra={})=>{evidence.events.push({type,at:performance.now(),...extra});if(evidence.events.length>70)evidence.events.shift();};
 const seated=()=>!!hall.seat&&['seated','walking'].includes(hall.seatPhase);
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const paint=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 const wait=async(fn,timeout=60000)=>{const start=performance.now();while(!fn()){if(performance.now()-start>timeout)throw Error('準備逾時，請重試');await delay(50);}};
 async function ensureDownload(){
  if(downloaded)return;if(downloadJob)return downloadJob;
  downloadPaused=false;downloadMessage='背景下載演出資源中，可繼續導覽';
  downloadJob=(async()=>{for(const id of ids){if(downloadPaused)throw new DOMException('取消','AbortError');await cache.get(id);}downloaded=true;downloadMessage='演出資源下載完成';await cache.trim();})().catch(e=>{downloadMessage=e.name==='AbortError'?'背景下載已暫停':'下載未完成，可重試';throw e;}).finally(()=>{downloadJob=null;render();});return downloadJob;
 }
 async function mount(id,file){
  engine.copyToFS('/tmp/'+file,await cache.get(id));window.packMounted=false;window.mountOptional('/tmp/'+file);if(!window.packMounted)throw Error('資源掛載失敗');
 }
 async function warm(force=false){
  if(warmDone)return;if(warmJob){await warmJob;if(force&&!warmDone)return warm(true);return;}
  warmMessage='正在準備座位的演出燈光…';evidence.warmStarted=performance.now();render();
  warmJob=(async()=>{
   await ensureDownload();if(!force&&!seated()){warmMessage='';return;}await paint();
   if(!force&&!seated()){warmMessage='';return;}
   if(!lightsMounted){await mount('lights','lights.pck');lightsMounted=true;}
   window.lightError='';command('prepare_lights');
   await wait(()=>window.lightsPrepared||window.lightError);
   if(window.lightError)throw Error(window.lightError);
   warmDone=true;warmMessage='';evidence.warmFinished=performance.now();record('lights-prepared',{bandVisible:!!window.bandReady});
  })().catch(e=>{warmMessage='演出準備未完成，按演出可重試';throw e;}).finally(()=>{warmJob=null;render();});return warmJob;
 }
 async function transition(mode,valid){
  const fade=$('scene-fade');if(evidence.transition.length>90)evidence.transition.splice(0,30);evidence.transition.push({mode,step:'fade-out',at:performance.now()});
  fade.style.opacity='1';await delay(matchMedia('(prefers-reduced-motion: reduce)').matches?100:280);
  if(valid()){command('performance_light',mode);lightName=mode;evidence.transition.push({mode,step:'switch',at:performance.now()});}
  await paint();fade.style.opacity='0';await delay(280);
  evidence.transition.push({mode,step:'visible',at:performance.now()});
 }
 const session=window.performanceSession=new PerformanceSession({
  seated,light:()=>hall.lighting||lightName,
  lock:value=>command('performance_lock',value),
  show:value=>{command('show_band',value);record(value?'band-shown':'band-hidden');},
  prepare:async(valid)=>{
   await warm();if(!valid())return;
   if(!bandMounted){await mount('band','band.zip');bandMounted=true;}
   if(!audioUrl){const music=await cache.get('music');if(!valid())return;audioUrl=URL.createObjectURL(new Blob([music],{type:'audio/mpeg'}));audio.media.src=audioUrl;}
   if(!valid())return;
   notice='正在建立樂團，請稍候…';render();await paint();
   if(!valid())return;
   const start=performance.now();command('prepare');evidence.bandBuildMs=performance.now()-start;
   if(!window.bandReady)throw Error(window.bandError||'角色建立失敗');
  },
  transition,restore:mode=>{command('performance_light',mode);lightName=mode;$('scene-fade').style.opacity='0';},
  play:async(restart)=>{audio.setSeat(true);if(restart)audio.media.currentTime=0;await audio.arm();if(document.hidden)audio.pause();},
  playing:()=>!audio.media.paused,pause:()=>audio.pause(),reset:()=>{audio.seek(0);notice='';},
  changed:s=>{record('state',{state:s.state});render();}
 });
 function render(){
  const s=session.state,isSeated=seated();
  if(integrated){
   $('performance-panel').hidden=!isSeated||!!document.querySelector('dialog[open]');
   document.body.dataset.performance=s;
   for(const el of document.querySelectorAll('[data-place],#seat-pick,#visitor-seat,#lighting,[data-light]'))el.disabled=session.active||!!manualLightJob;
   $('perform-stand').style.display='none';$('perform-sit').style.display='none';
   $('performance-seat-status').hidden=true;
  }
  $('perform-start').hidden=!isSeated||s!=='idle';$('perform-start').disabled=!window.tourUsable||!!manualLightJob;
  $('perform-resume').hidden=s!=='paused';$('perform-stop').hidden=!['playing','paused'].includes(s);
  $('perform-cancel').hidden=!['preparing','starting'].includes(s);
  $('perform-stand').hidden=!isSeated;$('perform-stand').disabled=s==='stopping';
  $('perform-sit').hidden=isSeated||!hall.seatCandidate||s!=='idle';
  for(const id of ['preview-seat','preview-approach','preview-walk'])$(id).disabled=!window.tourUsable||session.active;
  $('concert-volume').hidden=!isSeated;
  $('concert-track').hidden=!['playing','paused'].includes(s);
  $('concert-seat').textContent=(hall.seat||'').replace(/^([12])F-(\d+)-(\d+)$/,(m,f,r,n)=>(f==='1'?'一樓':'二樓')+' '+r+' 排 '+n+' 號');
  document.body.dataset.concertSeated=String(isSeated);
  $('prepare-status').hidden=integrated&&s==='idle'&&!session.message;
  if(integrated&&s==='idle'&&/結束|再次欣賞/.test(session.message||''))$('prepare-status').hidden=true;
  if(integrated&&s==='playing')$('prepare-status').hidden=true;
  const messages={preparing:notice||'正在準備演出，可取消…',starting:'正在切換演出燈光…',playing:'《亮起以前》演出中',paused:'已暫停，按「繼續聆聽」恢復',stopping:'正在結束演出並還原燈光…'};
  $('prepare-status').textContent=messages[s]||(!window.tourUsable?'正在載入音樂廳…':session.message|| (isSeated?(warmMessage||'已入座 · 按演出開始欣賞'):downloadMessage||'自由導覽 · 坐下後可欣賞演出'));
  $('performance-seat-status').textContent=isSeated?'座位 '+hall.seat+' · 可拖曳轉頭觀看':'WASD 走動 · 拖曳轉向 · E 入座';
  const total=ids.reduce((n,id)=>n+cache.manifest.assets[id].bytes,0);$('resource-progress').max=total;$('resource-progress').value=ids.reduce((n,id)=>n+(states.get(id)?.bytes||0),0);$('resource-progress').hidden=downloaded;
  $('music-time').textContent=' '+Math.floor(audio.media.currentTime/60)+':'+String(Math.floor(audio.media.currentTime%60)).padStart(2,'0');
  $('performance-diagnostic').textContent=JSON.stringify({state:s,seat:hall.seat,phase:hall.seatPhase,position:[hall.x,hall.z],lighting:hall.lighting,downloaded,lightsPrepared:!!window.lightsPrepared,lightProgress:window.lightProgress||0,bandBuilt:!!window.bandReady,audio:audio.snapshot(),routing:{stereo:audio.stereoGain?.gain.value,stage:audio.stageGain?.gain.value,reverb:audio.reverbGain?.gain.value},cache:cache.events.filter(e=>['cached','ready','failed'].includes(e.state)).map(e=>({id:e.id,state:e.state})),fps:hall.fps,evidence},null,2);
 }
 const previousHallUpdate=window.hallUpdate;
 window.hallUpdate=state=>{
  previousHallUpdate?.(state);if(state.ready===undefined)return;
  if(integrated){$('walk').innerHTML='<span class="desktop-key">E · </span>起立';$('walk').disabled=session.state==='stopping';}
  const wasSeated=seated();hall=state;
  if(integrated&&state.seatPhase==='sit'){$('seat-status').textContent='';$('seat-status').hidden=true;}
  document.body.dataset.concertSeated=String(seated());
  audio.updateListener({x:state.x,y:state.y+1.18,z:state.z,yaw:state.yaw,pitch:state.pitch});
  audio.setSeat(seated());
  if(!wasSeated&&seated()&&window.tourUsable)warm().catch(()=>{});
  if(wasSeated&&!seated()&&session.active)session.stop('已離開座位，演出結束').catch(()=>{});
 };
 async function start(){if(!seated()||session.active||manualLightJob||document.querySelector('dialog[open]'))return;try{await audio.unlock();await session.start();}catch(e){session.message='請再次按演出：'+e.message;render();}}
 const dialog=$('stand-dialog');let returnFocus=null;
 window.requestPerformanceStand=()=>{
  if(!seated())return;
  if(!session.active){command('walk');return;}
  if(dialog.open)return;returnFocus=document.activeElement;if(integrated){resetPads();resetGestures();}dialog.showModal();
 };
 function closeDialog(){dialog.close();if(returnFocus?.isConnected)returnFocus.focus();}
 $('stand-continue').onclick=closeDialog;
 $('stand-confirm').onclick=async()=>{closeDialog();await session.stop('已結束聆聽');command('walk');};
 dialog.addEventListener('cancel',()=>{record('stand-dialog-dismissed');});
 $('perform-start').onclick=start;$('perform-resume').onclick=()=>session.resume();
 $('perform-stop').onclick=()=>session.stop();$('perform-cancel').onclick=()=>session.stop('準備已取消');
 $('perform-stand').onclick=window.requestPerformanceStand;$('perform-sit').onclick=()=>command('interact');
 $('music-volume').oninput=e=>audio.media.volume=Number(e.target.value);
 $('preview-seat').onclick=()=>command('seat','1F-6-1');$('preview-approach').onclick=()=>command('approach','1F-6-1');$('preview-walk').onclick=()=>command('walk');
 $('download-pause').onclick=()=>{downloadPaused=true;for(const id of ids)cache.cancel(id);};
 $('download-retry').onclick=()=>ensureDownload().catch(()=>{});
 audio.media.addEventListener('ended',()=>session.stop('演出結束，可再次欣賞'));
 audio.media.addEventListener('error',()=>{if(session.active)session.stop('音樂播放失敗，請重試');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){record('document-hidden');session.hidden();}});
 $('check-hidden').onclick=()=>{record('simulated-hidden');session.hidden();};
 $('check-end').onclick=()=>{if(session.state==='playing'&&Number.isFinite(audio.media.duration))audio.seek(audio.media.duration-.5);};
 document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.isComposing||e.target.isContentEditable||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.code==='KeyP'&&seated()){e.preventDefault();e.stopImmediatePropagation();if(session.state==='idle')start();else if(['playing','paused'].includes(session.state))session.stop();else if(['preparing','starting'].includes(session.state))session.stop('準備已取消');}
  if(e.code==='KeyE'&&seated()){e.preventDefault();e.stopImmediatePropagation();window.requestPerformanceStand();}
 },true);
 cache.listeners.add(e=>{states.set(e.id,e);});
 setInterval(()=>{
  if(window.tourUsable&&!tourStarted){tourStarted=true;record('tour-usable');setTimeout(()=>ensureDownload().catch(()=>{}),1200);}
  if(seated()&&downloaded&&!warmDone&&!warmJob&&window.tourUsable&&!warmMessage.startsWith('演出準備未完成'))warm().catch(()=>{});
  render();
 },150);
 setInterval(()=>{if(window.bandReady&&session.state==='playing')command('clock',audio.media.currentTime,audio.energy());},1000/30);
 window.addEventListener('pagehide',()=>{audio.pause();if(audioUrl)URL.revokeObjectURL(audioUrl);});
 if(integrated){
  const chooseLighting=window.hallChooseLighting;
  window.hallChooseLighting=mode=>{
   if(session.active||manualLightJob)return;
   if(mode==='all'||lightsMounted){chooseLighting(mode);return;}
   const status=document.querySelector('#lighting-dialog .light-status');
   status.hidden=false;status.classList.add('busy');status.textContent='正在準備燈光…';
   manualLightJob=(async()=>{if(!lightsMounted){await mount('lights','lights.pck');lightsMounted=true;}await paint();if(!session.active)chooseLighting(mode);})().catch(()=>{
    status.textContent='燈光準備未完成，請再試一次';status.classList.remove('busy');
   }).finally(()=>{manualLightJob=null;render();});render();
  };
 }
 render();
})();
