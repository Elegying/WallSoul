import type {Snapshot} from '../contracts';
import {BodyBehavior,easeMotionProgress,type BodyMotionClip} from './bodyBehavior';
import {selectPortraitMotion} from './portraitMotion';

/** Match the encoder's baked selection so diagnostics refer to actual source frames. */
export function videoSourceFrame(clip:BodyMotionClip,time:number,fps:number){
 const count=Math.round(clip.duration*fps),frame=Math.min(count-1,Math.max(0,Math.floor(time*fps+.00001)));
 const progress=frame/(count-1);
 return clip.start+Math.round((clip.timing==='native'?progress:easeMotionProgress(progress))*(clip.frames-1));
}

/** Advance only after a decoded movie completes, never by elapsed wall-clock time. */
export class VideoSequence {
 private director:BodyBehavior;
 private time=0;
 private current?:BodyMotionClip;
 constructor(private clips:BodyMotionClip[],random:()=>number=Math.random){this.director=new BodyBehavior(random)}
 private selection(snapshot:Snapshot){
  const audio=snapshot.audio?.enabled?snapshot.audio:undefined;
  const pose=audio?.phase==='speaking'?'speaking':audio?.phase==='listening'?'listening':snapshot.settings.mode==='demo'?snapshot.settings.demoPose:'idle';
  return {...selectPortraitMotion(this.clips,pose,snapshot.settings.motion??'auto'),emotion:audio?.phase==='listening'?'attentive':audio?.emotion??'neutral'};
 }
 /** Record the latest request during a gesture without interrupting its closing motion. */
 update(snapshot:Snapshot,mediaTime=0){
  const s=this.selection(snapshot);
  const safeTime=this.current?Math.min(Math.max(0,mediaTime),this.current.duration-.0001):0;
  const sample=this.director.sample(this.time+safeTime,s.clips,s.requested,true,s.emotion,true);
  if(!this.current)this.current=sample?.clip;
  return this.current;
 }
 complete(snapshot:Snapshot){
  if(this.current)this.time+=this.current.duration;
  this.current=undefined;
  return this.update(snapshot);
 }
}
