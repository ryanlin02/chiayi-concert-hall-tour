/* A single streaming media clock; no native audio control widget. */
class ConcertAudio {
  constructor(url) {
    this.media = new Audio(); this.media.preload = 'none'; if(url)this.media.src = url;
    this.media.volume = 0.7; this.armed = false; this.seated = false; this.context = null;
    this.spatial=true;this.listenerPose={x:0,y:2.4,z:8,yaw:0,pitch:0};
    this.error = ''; this.events = []; this.started = false;
    for (const event of ['playing','pause','waiting','seeking','seeked','ended','error'])
      this.media.addEventListener(event, () => {
        this.events.push({event,time:this.media.currentTime}); this.events=this.events.slice(-40);
        if(event==='error')this.error='音樂載入失敗，請再試一次';
        if(event==='ended'){this.armed=false;this.started=false;}
      });
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
  }
  async unlock() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.context = new AudioContext();
      this.source = this.context.createMediaElementSource(this.media);
      this.analyser = this.context.createAnalyser();this.analyser.fftSize=256;
      this.source.connect(this.analyser);
      this.stereoGain=this.context.createGain();this.analyser.connect(this.stereoGain);this.stereoGain.connect(this.context.destination);
      this.panner=ConcertAudio.stagePanner(this.context);
      this.stageGain=this.context.createGain();this.stageGain.gain.value=0;
      this.analyser.connect(this.panner);this.panner.connect(this.stageGain);this.stageGain.connect(this.context.destination);
      this.reverb=this.context.createConvolver();this.reverb.buffer=ConcertAudio.impulse(this.context);
      this.reverbGain=this.context.createGain();this.reverbGain.gain.value=0;
      this.panner.connect(this.reverb);this.reverb.connect(this.reverbGain);this.reverbGain.connect(this.context.destination);
      this.setSpatial(this.spatial);this.updateListener(this.listenerPose);
      this.samples=new Uint8Array(256);
    }
    await this.context.resume();
  }
  static stagePanner(context) {
    const p=context.createPanner();p.panningModel='HRTF';p.distanceModel='inverse';p.refDistance=8;p.rolloffFactor=.22;p.maxDistance=60;p.setPosition(0,2.4,-4);return p;
  }
  static impulse(context) {
    const length=Math.floor(context.sampleRate*1.35), buffer=context.createBuffer(2,length,context.sampleRate);
    let seed=20260915;
    for(let channel=0;channel<2;channel++) {
      const data=buffer.getChannelData(channel);
      for(let i=0;i<length;i++) {seed=(1664525*seed+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*Math.exp(-6*i/length)*(i<context.sampleRate*.024?0:1);}
    }
    return buffer;
  }
  setSpatial(enabled) {
    this.spatial=enabled;
    if(!this.context)return;
    const t=this.context.currentTime;
    this.stereoGain.gain.setTargetAtTime(enabled?0:1,t,.04);
    this.stageGain.gain.setTargetAtTime(enabled?.9:0,t,.04);
    this.updateListener(this.listenerPose);
  }
  updateListener(pose) {
    this.listenerPose=pose;if(!this.context)return;
    const {x,y,z,yaw,pitch}=pose,listener=this.context.listener;
    listener.setPosition(x,y,z);
    listener.setOrientation(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch),Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch));
    const distance=Math.hypot(x,y-2.4,z+4);
    this.reverbGain.gain.setTargetAtTime(this.spatial?Math.min(.22,.08+distance*.004):0,this.context.currentTime,.05);
  }
  async arm() {
    try { await this.unlock();this.armed=true;this.error='';if(this.seated)await this.play(); }
    catch(e) {this.armed=false;this.error='請按播放重試：'+e.message;}
  }
  async play() {
    if(!this.armed || !this.seated || !this.media.paused)return;
    try {await this.media.play();this.started=true;} catch(e) {this.armed=false;this.error='請再按一次播放：'+e.message;}
  }
  pause() {this.armed=false;this.media.pause();}
  setSeat(seated) {
    const changed=this.seated!==seated;this.seated=seated;
    if(!changed)return;
    if(seated && this.armed)this.play();
    if(!seated)this.media.pause(); // Keep currentTime and armed intent for the next seat.
  }
  seek(seconds) {if(Number.isFinite(this.media.duration))this.media.currentTime=Math.max(0,Math.min(this.media.duration,seconds));}
  energy() {
    if(!this.analyser || this.media.paused)return 0;
    this.analyser.getByteTimeDomainData(this.samples);
    let sum=0;for(const v of this.samples)sum+=((v-128)/128)**2;
    return Math.min(1,Math.sqrt(sum/this.samples.length)*5);
  }
  snapshot() {return {time:this.media.currentTime,duration:this.media.duration||0,paused:this.media.paused,armed:this.armed,seated:this.seated,ended:this.media.ended,ready:this.media.readyState,context:this.context?.state,spatial:this.spatial,listener:this.listenerPose,error:this.error};}
}
window.ConcertAudio=ConcertAudio;
