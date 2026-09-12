/* Internal-test, foreground-only aggregate telemetry. No coordinates or raw errors leave the page. */
(()=>{'use strict';
const ID='G-55SFX6CT6E',VERSION='r48-20260912',KEY='hall_analytics_internal_v2';
const allowed=location.hostname==='ryanlin02.github.io'&&location.pathname.startsWith('/chiayi-concert-hall-tour/');
const debug=new URLSearchParams(location.search).get('analytics_debug')==='1';
let choice;try{choice=localStorage.getItem(KEY)}catch{}
let enabled=false,started=false,ready=false,loadMS=0,failure=null,lastState=null,lastSample=0,lastFrame=0,lastInput=0;
let buckets=new Map(),sentErrors=new Set(),timer=null,raf=null,zone='loading',quality='unknown';
const cleanURL=location.origin+location.pathname;
const n=v=>Math.round(v*100)/100;
const foreground=()=>!document.hidden&&document.hasFocus()&&!document.querySelector('dialog[open]');
const validZones={'舞台':'stage','一樓觀眾席':'floor1','二樓觀眾席':'floor2'};
function event(name,params={}){if(!enabled||!allowed)return;window.gtag('event',name,{send_to:ID,scene_version:VERSION,zone,quality,...params,...(debug?{debug_mode:true}:{})});}
function bucket(){const key=zone+'|'+quality;if(!buckets.has(key))buckets.set(key,{zone,quality,seconds:0,weighted:0,low:0,stalls:0,active:0});return buckets.get(key)}
function flush(){if(!enabled)return;for(const b of buckets.values()){if(b.seconds<.5)continue;event('hall_performance',{zone:b.zone,quality:b.quality,frame_estimate:n(b.weighted),low_seconds:n(b.low),avg_fps:n(b.weighted/b.seconds),low_fps_pct:n(100*b.low/b.seconds),sample_seconds:n(b.seconds),active_seconds:n(b.active),stall_count:b.stalls})}buckets.clear()}
function reset(){lastSample=0;lastFrame=0}
function frame(now){if(!enabled)return;if(ready&&foreground()){if(lastFrame&&now-lastFrame>100&&now-lastFrame<10000)bucket().stalls++;lastFrame=now}else lastFrame=0;raf=requestAnimationFrame(frame)}
function activate(){if(enabled||!allowed)return;enabled=true;window['ga-disable-'+ID]=false;window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};
if(!started){started=true;window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});window.gtag('js',new Date());window.gtag('config',ID,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_location:cleanURL,page_referrer:'',cookie_domain:'none',cookie_path:'/chiayi-concert-hall-tour/',cookie_expires:2592000,...(debug?{debug_mode:true}:{})});const s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+ID;document.head.appendChild(s)}else window.gtag('consent','update',{analytics_storage:'granted'});
event('page_view',{page_location:cleanURL,page_title:'嘉義市音樂廳 3D 空間漫遊',page_referrer:''});event('hall_visit');if(ready)event('hall_ready',{load_ms:loadMS});if(failure)event('hall_load_failed',{error_kind:failure});reset();timer=setInterval(flush,30000);raf=requestAnimationFrame(frame)}
function deactivate(){enabled=false;window['ga-disable-'+ID]=true;clearInterval(timer);cancelAnimationFrame(raf);buckets.clear();reset();if(window.gtag)window.gtag('consent','update',{analytics_storage:'denied'});for(const c of document.cookie.split(';')){const key=c.split('=')[0].trim();if(key==='_ga'||key==='_ga_'+ID.slice(2))document.cookie=key+'=;Max-Age=0;Path=/chiayi-concert-hall-tour/;SameSite=Lax;Secure'}}
function setChoice(value){choice=value;try{localStorage.setItem(KEY,value)}catch{}if(value==='granted')activate();else deactivate();updateStatus()}
function updateStatus(){document.getElementById('analytics-status').textContent=enabled?'內部測試統計已啟用；可隨時停止。':'目前已停止統計。';}
window.hallTelemetry={update(s){const now=performance.now();const z=validZones[s.zone]||'loading',q=s.quality==='省電'?'low':'standard';
if(s.ready===2&&!ready){zone=z;quality=q;ready=true;loadMS=Math.round(now);event('hall_ready',{load_ms:loadMS})}
if(enabled&&lastState&&ready){if(z!==zone){flush();zone=z;event('hall_zone')}if(q!==quality){flush();quality=q;event('hall_quality')}
if(s.seat&&s.seat!==lastState.seat)event('hall_seat',{seat_floor:String(s.seat).startsWith('2F')?'floor2':'floor1'});
const dt=(now-lastSample)/1000;if(foreground()&&lastSample&&dt>0&&dt<10){const b=bucket(),fps=Number(s.fps);if(Number.isFinite(fps)&&fps>=0){b.seconds+=dt;b.weighted+=fps*dt;if(fps<30)b.low+=dt;if(now-lastInput<15000)b.active+=dt}}
}zone=z;quality=q;lastState={seat:s.seat};lastSample=foreground()?now:0},fail(kind){failure=kind;if(!sentErrors.has(kind)){sentErrors.add(kind);event('hall_load_failed',{error_kind:kind})}}};
window.addEventListener('error',()=>{if(!sentErrors.has('script_error')){sentErrors.add('script_error');event('hall_error',{error_kind:'script_error'})}});
window.addEventListener('unhandledrejection',()=>{if(!sentErrors.has('promise_error')){sentErrors.add('promise_error');event('hall_error',{error_kind:'promise_error'})}});
for(const name of ['keydown','pointerdown','pointermove','wheel','touchstart'])window.addEventListener(name,()=>{lastInput=performance.now()},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();reset()});window.addEventListener('blur',()=>{flush();reset()});window.addEventListener('focus',reset);window.addEventListener('pagehide',()=>{flush();if(!ready)event('hall_load_abandoned')});
const style=document.createElement('style');style.textContent='#analytics-dialog button{float:none;margin:4px;padding:9px 13px;border-radius:8px;border:1px solid #aab29b;background:#29362b;color:#fff}#analytics-dialog a{color:#efdaa7}#analytics-dialog{max-height:85vh;overflow:auto}#analytics-dialog h3{font-size:16px}';document.head.appendChild(style);
const dialog=document.createElement('dialog');dialog.id='analytics-dialog';dialog.innerHTML='<h2>使用統計與測試回饋</h2><p>目的：了解裝置相容性與 3D 導覽效能。此內部測試版本會自動將統計資料送至 Google Analytics，由網站管理者查看。Google 會處理連線與裝置資訊；分析 Cookie 可用於區分訪客，這不代表完全匿名。</p><p>記錄項目：網站版本、載入時間與結果、每 30 秒彙整的 FPS／低 FPS 比例／停頓次數、前景使用時間、區域切換、畫質和選位功能使用。另有瀏覽器、作業系統、螢幕解析度等一般分析資訊。不傳送座號、座標、按鍵內容、姓名或原始錯誤文字；不啟用廣告個人化。</p><p>您可隨時停止後續蒐集，停止選擇會保存在這個瀏覽器；停止不會刪除已送出的歷史統計。報表可能受停止統計、廣告阻擋器與斷網影響。</p><p><a href="https://policies.google.com/privacy?hl=zh-TW" target="_blank" rel="noopener">Google 隱私權政策</a></p><p id="analytics-status"></p><button id="analytics-enable">啟用統計</button><button id="analytics-disable">停止統計</button><h3>這次使用順暢嗎？</h3><p>以下回饋只在統計啟用時送出，不包含自由輸入文字。</p><button data-feedback="smooth">順暢</button><button data-feedback="occasional">偶爾卡頓</button><button data-feedback="poor">很卡</button><p id="feedback-status" role="status"></p><button id="analytics-close">返回導覽</button>';document.body.appendChild(dialog);
function open(){updateStatus();window.hallCommand?.('pause',true);dialog.showModal()}
document.getElementById('analytics-enable').onclick=()=>setChoice('granted');document.getElementById('analytics-disable').onclick=()=>setChoice('denied');document.getElementById('analytics-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>window.hallCommand?.('pause',Boolean(document.querySelector('dialog[open]'))));
let lastFeedback=0;dialog.querySelectorAll('[data-feedback]').forEach(b=>b.onclick=()=>{const msg=document.getElementById('feedback-status');if(!enabled){msg.textContent='請先啟用統計，再送出回饋。';return}if(Date.now()-lastFeedback<30000){msg.textContent='已收到本次回饋，謝謝。';return}lastFeedback=Date.now();event('hall_feedback',{feedback:b.dataset.feedback});msg.textContent='感謝回饋。'});
const settings=document.createElement('button');settings.type='button';settings.textContent='使用統計與回饋';settings.style.float='none';settings.onclick=()=>{document.getElementById('info').close();open()};document.getElementById('info').appendChild(settings);
document.getElementById('canvas').addEventListener('webglcontextlost',()=>{event('hall_error',{error_kind:'webgl_context_lost'})});
if(choice!=='denied')activate();updateStatus();
})();
