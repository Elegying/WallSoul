/** Bounded decoded frames and requests; late loads cannot resurrect a disposed scene. */
export class FrameCache<T> {
 private entries=new Map<number,{value?:T;pending:boolean}>();
 private disposed=false;
 constructor(private load:(index:number)=>Promise<T>,private fail:(error:unknown)=>void){}
 get size(){return this.entries.size}
 get(index:number):T|undefined {
  if(this.disposed)return;
  const found=this.entries.get(index);
  if(found){this.entries.delete(index);this.entries.set(index,found);return found.value;}
  if([...this.entries.values()].filter(e=>e.pending).length>=4)return;
  if(this.entries.size>=8){const old=[...this.entries].find(([,e])=>!e.pending);if(!old)return;this.entries.delete(old[0]);}
  const entry:{value?:T;pending:boolean}={pending:true};this.entries.set(index,entry);
  void this.load(index).then(value=>{if(!this.disposed&&this.entries.get(index)===entry){entry.value=value;entry.pending=false;}}).catch(error=>{if(!this.disposed){this.entries.delete(index);this.fail(error);}});
 }
 dispose(){this.disposed=true;this.entries.clear();}
}

/** Advance only after the requested image is decoded; never jump ahead after I/O stalls. */
export class FramePlaybackClock {
 private previous?:number;
 private position=0;
 sample(time:number,ready:boolean){
  const dt=this.previous===undefined?0:Math.max(0,Math.min(1/15,time-this.previous));
  this.previous=time;if(ready)this.position+=dt;return this.position;
 }
}
