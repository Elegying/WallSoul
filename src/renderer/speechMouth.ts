/** Select a single opaque, pose-aligned mouth. No lip images are crossfaded. */
export class SpeechMouth {
 private level=0;private last=-1;private shape=0;private shapeUntil=0;private index=0;
 sample(time:number,amplitude:number,brightness:number,levels:number,shapes:number){
  const dt=this.last<0?1/30:Math.max(0,Math.min(.1,time-this.last));this.last=time;
  const target=Math.max(0,Math.min(1,Number.isFinite(amplitude)?amplitude:0));
  this.level+=(target-this.level)*(1-Math.exp(-dt*(target>this.level?28:20)));
  if(time>=this.shapeUntil){this.shape=Math.min(shapes-1,brightness<.16?1:brightness>.5?2:0);this.shapeUntil=time+.1;}
  const openness=this.level<.045?0:Math.min(levels-1,Math.round(Math.pow(this.level,1.7)*(levels-1)*.75));
  this.index=openness===0?0:this.shape*levels+openness;return this.index;
 }
 reset(){this.level=0;this.last=-1;this.shape=0;this.shapeUntil=0;this.index=0;}
}
