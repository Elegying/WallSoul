export interface BodyMotionClip {
 id:string;label:string;start:number;frames:number;duration:number;
 emotions?:string[]; automatic?:boolean; kind?:'body'|'expression'; playback?:'idle'|'speaking'|'listening';
 /** Reviewed clips with natural filmed entrances retain their original timing. */
 timing?:'native';
 /** Optional complete HEVC-with-alpha movie, with the timing curve baked in. */
 video?:string;
 videoLowPower?:string;
}
/** All timing uses scene time, so pausing never skips to a later gesture. */
export function easeMotionProgress(p:number){
 const r=.18;
 return p<r?p*p/(2*r*(1-r)):p>1-r?1-(1-p)*(1-p)/(2*r*(1-r)):(p-r/2)/(1-r);
}
export class BodyBehavior {
 private clip?:BodyMotionClip;
 private since=0;
 private next=4;
 private pendingRequest?:string;
 private previous='auto';
 private lastId='';
 private remainingByMode=new Map<string,string[]>();
 private emotion='neutral';
 private speed=1;
 private accentAt=12;
 constructor(private random:()=>number=Math.random){}
 sample(time:number,clips:BodyMotionClip[],requested:string,allowed:boolean,emotion='neutral',settle=false){
  const voice=requested.startsWith('voice:');const mix=requested.startsWith('mix:');const automatic=requested==='auto'||voice||mix;
  const changed=requested!==this.previous;
  if(changed&&this.previous.startsWith('voice:')&&mix){
   const remaining=this.clip?Math.max(0,this.clip.duration/this.speed-(time-this.since)):0;
   this.accentAt=time+remaining+12+this.random()*8;
  }
  this.previous=requested;
  const moodChanged=emotion!==this.emotion;this.emotion=emotion;
  if(changed)this.pendingRequest=automatic?undefined:requested;
  // Whole-frame clips share neutral endpoints. Keep their original timeline through
  // interruptions: reversing or replacing easing mid-gesture causes a visible jerk.
  // The next request waits at most the remaining clip duration (3.5s in this library).
  if(!settle&&(!allowed||(changed&&!automatic)))this.clip=undefined;
  if(this.clip&&time-this.since>=this.clip.duration/this.speed){if(this.clip.id!=='resting-natural')this.lastId=this.clip.id;this.clip=undefined;this.next=time+(voice||mix||settle?0:requested==='auto'?5+this.random()*9:5);}
  if((voice||mix)&&changed&&!this.clip)this.next=time;
  if(!allowed&&!this.clip){this.next=time+3;return undefined;}
  // Finish the current gesture before choosing another mood, avoiding sudden hand jumps.
  if(!this.clip){
   const explicit=clips.find(c=>c.id===requested);
   const resting=clips.find(c=>c.id==='resting-natural');
   const pending=explicit&&this.pendingRequest===requested;
   const quiet=!voice&&!pending&&time<this.accentAt&&(mix||(!changed&&explicit))?(resting??(mix?clips.find(c=>c.id==='listening-soft'):undefined)):undefined;
   const candidates=clips.filter(c=>c.id!=='resting-natural'&&(mix||(c.automatic!==false&&(!c.emotions?.length||c.emotions.includes(emotion)))));
   const choices=candidates.filter(c=>c.id!==this.lastId);
   const pool=choices.length?choices:candidates;
   if(quiet)this.clip=quiet;
   else if(explicit&&(pending||time>=this.next)){this.clip=explicit;this.pendingRequest=undefined;if(resting)this.accentAt=time+explicit.duration+12+this.random()*8;}
   else if(automatic&&pool.length&&(time>=this.next||(moodChanged&&time>=this.next-8))){
    let selection=pool;
    if(voice||mix){
     let ids=(this.remainingByMode.get(requested)??[]).filter(id=>candidates.some(c=>c.id===id));
     if(!ids.length)ids=candidates.map(c=>c.id);
     this.remainingByMode.set(requested,ids);
     const remaining=candidates.filter(c=>ids.includes(c.id));
     selection=remaining.filter(c=>c.id!==this.lastId);if(!selection.length)selection=remaining;
    }
    this.clip=selection[Math.min(selection.length-1,Math.floor(this.random()*selection.length))];
    if(voice||mix)this.remainingByMode.set(requested,this.remainingByMode.get(requested)!.filter(id=>id!==this.clip!.id));
    if(mix)this.accentAt=time+this.clip.duration+12+this.random()*8;
   }
   if(this.clip){this.since=time;this.speed=quiet?(quiet.id==='resting-natural'?1:.8):requested==='auto'?.9+this.random()*.16:1;}
  }
  if(!this.clip)return undefined;
  const progress=Math.min(1,Math.max(0,(time-this.since)*this.speed/this.clip.duration));
  return {clip:this.clip,position:this.clip.start+(settle&&this.clip.timing!=='native'?easeMotionProgress(progress):progress)*(this.clip.frames-1)};
 }
}
