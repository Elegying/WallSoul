export interface MotionFrame {at:number;bones:Record<string,[number,number,number]>;height:number}
export interface MotionClip {id:string;label:string;duration:number;frames:MotionFrame[]}
export interface MotionLibrary {version:1;clips:MotionClip[]}
export function validateMotions(value:unknown):MotionLibrary {
 const m=value as MotionLibrary;
 if(!m||m.version!==1||!Array.isArray(m.clips)||m.clips.length<1||m.clips.length>32)throw Error('动作库格式无效');
 const ids=new Set<string>();
 for(const c of m.clips){
  if(!/^[a-z-]{1,40}$/.test(c.id)||ids.has(c.id)||typeof c.label!=='string'||c.label.length>30||!Number.isFinite(c.duration)||c.duration<1||c.duration>30||!Array.isArray(c.frames)||c.frames.length<2||c.frames.length>120)throw Error('动作定义无效');ids.add(c.id);
  let previous=-1;
  for(const f of c.frames){if(!Number.isFinite(f.at)||f.at<0||f.at>1||f.at<=previous||!Number.isFinite(f.height)||Math.abs(f.height)>.5||!f.bones||Object.keys(f.bones).length>60)throw Error('动作关键帧无效');previous=f.at;for(const [bone,v] of Object.entries(f.bones))if(!/^[a-zA-Z]{1,40}$/.test(bone)||!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isFinite(n)||Math.abs(n)>Math.PI))throw Error('骨骼角度无效');}
  if(c.frames[0].at!==0||c.frames.at(-1)!.at!==1)throw Error('动作必须包含完整起止帧');
 }
 return m;
}
// All runtime assets must stay inside one embedded GLB; no network or file URI resolution.
export function validateEmbeddedVRM(buffer:ArrayBuffer):void {
 if(buffer.byteLength<20||buffer.byteLength>32*1024*1024)throw Error('3D 文件大小无效');
 const v=new DataView(buffer);const n=v.getUint32(12,true);
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==buffer.byteLength||v.getUint32(16,true)!==0x4e4f534a||20+n>buffer.byteLength)throw Error('3D 文件格式无效');
 const j=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,n)));
 if(!j.extensions?.VRMC_vrm||[...(j.buffers??[]),...(j.images??[])].some(x=>x.uri!==undefined))throw Error('仅接受内嵌资源的 VRM 1 模型');
}
