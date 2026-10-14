export interface MotionClip {id:string;start:number;frames:number;duration:number}
/** Elapsed scene time is supplied by the renderer, so pause freezes the whole gesture. */
export class BehaviorDirector {
 private clip?:MotionClip;
 private since=0;
 private emotion='neutral';
 constructor(private random:()=>number=Math.random){}
 sample(time:number,clips:MotionClip[],emotion='neutral',requested='auto') {
  const wanted=requested!=='auto'?requested:emotion==='thoughtful'?'look-away':emotion==='attentive'?'nod':emotion;
  const key=emotion+requested;const changed=key!==this.emotion;this.emotion=key;
  if(!this.clip||time-this.since>=this.clip.duration||changed){
   const preferred=(changed||requested!=='auto')?clips.find(c=>c.id===wanted):undefined;
   const weights:Record<string,number>={neutral:6,'look-away':3,nod:2,happy:2,curious:1,wink:0.2,concerned:0};
   const candidates=clips.filter(c=>c.id!==this.clip?.id);
   let ticket=this.random()*candidates.reduce((sum,c)=>sum+(weights[c.id]??1),0);
   const randomClip=candidates.find(c=>(ticket-=weights[c.id]??1)<0);
   this.clip=preferred??randomClip??clips[0];
   this.since=time;
  }
  const clip=this.clip;
  return {clip,position:clip?clip.start+Math.min(.999999,(time-this.since)/clip.duration)*(clip.frames-1):0};
 }
}
