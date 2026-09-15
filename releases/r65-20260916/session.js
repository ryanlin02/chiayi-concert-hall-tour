/* Lifecycle independent of DOM/Godot, with cancellation safe at every async boundary. */
(function(root){
class PerformanceSession {
 constructor(adapter){this.a=adapter;this.state='idle';this.generation=0;this.priorLight='all';this.message='';this.operation=null;this.stopping=null;this.resuming=false;}
 set(state){this.state=state;this.a.changed?.(this);}
 get active(){return this.state!=='idle';}
 start(){
  if(this.active||!this.a.seated())return this.operation||Promise.resolve();
  const generation=++this.generation,valid=()=>generation===this.generation;
  this.priorLight=this.a.light();this.message='';this.a.lock(true);this.set('preparing');
  this.operation=(async()=>{
   try{
    await this.a.prepare(valid);if(!valid())return;
    this.set('starting');await this.a.transition('stage',valid);if(!valid())return;
    this.a.show(true);await this.a.play(true);if(!valid())return;
    this.set(this.a.playing()?'playing':'paused');
    if(!this.a.playing())this.message='音樂尚未開始，請按繼續聆聽';
   }catch(e){
    if(!valid())return;
    this.message='準備未完成：'+e.message;this.a.pause();this.a.show(false);
    try{await this.a.transition(this.priorLight,valid);}catch(restore){this.a.restore(this.priorLight);}
    if(!valid())return;this.a.lock(false);this.set('idle');
   }
  })();return this.operation;
 }
 async stop(message='演出已結束'){
  if(this.stopping)return this.stopping;
  if(!this.active)return;
  const previousState=this.state;
  ++this.generation;this.a.pause();this.a.show(false);this.set('stopping');
  const pending=previousState==='preparing'?Promise.resolve():this.operation;
  this.stopping=(async()=>{
   try{await pending;await this.a.transition(this.priorLight,()=>true);}
   finally{this.a.pause();this.a.show(false);this.a.restore(this.priorLight);this.a.lock(false);this.a.reset();this.message=message;this.set('idle');this.operation=null;this.stopping=null;}
  })();return this.stopping;
 }
 pause(){if(!['playing','starting'].includes(this.state))return;this.a.pause();this.set('paused');}
 resume(){if(this.resuming)return this.operation;if(this.state!=='paused')return Promise.resolve();this.resuming=true;const generation=this.generation;this.operation=(async()=>{try{await this.a.play(false);if(generation!==this.generation)return;this.set(this.a.playing()?'playing':'paused');}finally{this.resuming=false;}})();return this.operation;}
 hidden(){if(['preparing','starting'].includes(this.state))return this.stop('準備已取消，回來後可重新開始');if(this.state==='playing')this.pause();}
}
root.PerformanceSession=PerformanceSession;
if(typeof module!=='undefined')module.exports=PerformanceSession;
})(globalThis);
