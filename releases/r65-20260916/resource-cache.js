/* Content-addressed Cache API loader. Cache failures never make a resource unusable. */
(function(root){
'use strict';
class ResourceCache {
 constructor(manifest, options={}) {
  this.manifest=manifest; this.fetcher=options.fetcher||root.fetch.bind(root);
  this.storage=options.storage===undefined?root.caches:options.storage;
  this.base=options.base||location.href;this.name='hall-resources-v1';
  this.jobs=new Map();this.events=[];this.listeners=new Set();this.persist=true;
  this.deadline=options.deadline||30000;this.maxBytes=384*1024*1024;
 }
 emit(id,state,extra={}) {const event={id,state,at:performance.now(),...extra};this.events.push(event);if(this.events.length>200)this.events.shift();for(const f of this.listeners){try{f(event);}catch(e){console.warn("Resource progress observer failed",e);}}}
 key(item){const url=new URL(item.download||item.url,this.base);url.searchParams.set('sha256',item.sha256);return url.href;}
 async cache(){if(!this.storage){this.persist=false;return null;}try{return await this.storage.open(this.name);}catch(e){this.persist=false;return null;}}
 cancel(id){this.jobs.get(id)?.controller.abort();}
 async verify(buffer,item){if(buffer.byteLength!==item.bytes)throw Error('下載大小不符');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==item.sha256)throw Error('檔案驗證失敗');}
 get(id){
  if(this.jobs.has(id))return this.jobs.get(id).promise;
  const controller=new AbortController();const job={controller};
  job.promise=this.load(id,controller.signal).finally(()=>{if(this.jobs.get(id)===job)this.jobs.delete(id);});this.jobs.set(id,job);return job.promise;
 }
 async load(id,signal){
  const item=this.manifest.assets[id];if(!item)throw Error('未知資源 '+id);
  const key=this.key(item),cache=await this.cache();
  if(signal.aborted)throw new DOMException('取消下載','AbortError');
  if(cache){try{const hit=await cache.match(key);if(hit){const buffer=await hit.arrayBuffer();await this.verify(buffer,item);if(signal.aborted)throw new DOMException('取消下載','AbortError');this.emit(id,'cached',{bytes:item.bytes});return buffer;}}catch(e){if(signal.aborted)throw e;await cache.delete(key).catch(()=>{});}}
  let error;
  for(let attempt=1;attempt<=3;attempt++){
   if(signal.aborted)break;
   const transfer=new AbortController();const abort=()=>transfer.abort();signal.addEventListener('abort',abort,{once:true});
   let timer=setTimeout(abort,this.deadline);
   try{
    this.emit(id,'downloading',{bytes:0,total:item.bytes,attempt});
    const response=await this.fetcher(key,{signal:transfer.signal,cache:'no-store',priority:item.group==='core'?'high':'low'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const reader=response.body.getReader();const chunks=[];let size=0;
    while(true){const {value,done}=await reader.read();if(done)break;clearTimeout(timer);timer=setTimeout(abort,this.deadline);size+=value.byteLength;if(size>item.bytes){await reader.cancel();throw Error('檔案超過預期大小');}chunks.push(value);this.emit(id,'downloading',{bytes:size,total:item.bytes,attempt});}
    clearTimeout(timer);const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
    this.emit(id,'verifying',{bytes:size});await this.verify(buffer,item);
    if(signal.aborted)throw new DOMException('取消下載','AbortError');
    if(cache){try{await cache.put(key,new Response(buffer,{headers:{'Content-Type':item.type||'application/octet-stream','Content-Length':String(size)}}));}catch(e){this.persist=false;this.emit(id,'cache-unavailable',{message:'空間不足或快取不可用，本次仍可使用'});}}
    this.emit(id,'ready',{bytes:size,persistent:this.persist&&!!cache});return buffer.buffer;
   }catch(e){error=e;if(signal.aborted)break;this.emit(id,'retry',{attempt,message:e.message});if(attempt<3)await new Promise(r=>setTimeout(r,attempt*300));}
   finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
  }
  this.emit(id,signal.aborted?'cancelled':'failed',{message:error?.message});
  if(signal.aborted)throw new DOMException('取消下載','AbortError');throw error;
 }
 async trim(){
  const cache=await this.cache();if(!cache)return;
  // Pin this release's assets. Remove only our own obsolete entries, oldest first.
  const pinned=new Set(Object.values(this.manifest.assets).map(x=>this.key(x)));
  try{const keys=await cache.keys();let total=0;const old=[];for(const k of keys){const r=await cache.match(k);const bytes=Number(r.headers.get('Content-Length')||0);total+=bytes;if(!pinned.has(k.url))old.push([k,bytes]);}for(const [key,bytes] of old){if(total<=this.maxBytes)break;await cache.delete(key);total-=bytes;}}catch(e){this.persist=false;}
 }
 installFetchBridge(){
  // Godot's fetches use the same loader/cache; unrelated URLs keep native fetch.
  const mapping=new Map(Object.entries(this.manifest.assets).filter(([,v])=>v.group==='core').map(([id,v])=>[new URL(v.url,this.base).href,id]));
  const original=root.fetch.bind(root);
  root.fetch=(input,options)=>{const url=new URL(typeof input==='string'?input:input.url,this.base).href;const id=mapping.get(url);if(!id)return original(input,options);return this.get(id).then(buffer=>new Response(buffer,{headers:{'Content-Type':this.manifest.assets[id].type||'application/octet-stream','Content-Length':String(buffer.byteLength)}}));};
 }
}
root.ResourceCache=ResourceCache;
if(typeof module!=='undefined')module.exports=ResourceCache;
})(globalThis);
