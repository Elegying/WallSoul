import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VideoSequence,videoSourceFrame} from '../src/renderer/videoSequence';
import type {Snapshot} from '../src/contracts';
import type {BodyMotionClip} from '../src/renderer/bodyBehavior';
const clips:BodyMotionClip[]=[
 {id:'resting-natural',label:'静息',start:0,frames:113,duration:3.5,playback:'idle',automatic:false},
 {id:'wave',label:'挥手',start:113,frames:113,duration:3.5},
 {id:'joy',label:'喜',start:226,frames:113,duration:3.5},
 {id:'listen',label:'聆听',start:339,frames:113,duration:3.5,playback:'listening'},
 {id:'talk',label:'说话',start:452,frames:113,duration:3.5,playback:'speaking'},
];
const snapshot=(motion='auto',phase?:string)=>({settings:{motion,mode:'manual'},audio:{enabled:!!phase,phase,emotion:'neutral'}} as Snapshot);
test('video scheduling finishes gestures before reacting and uses decoded completion time',()=>{
 const d=new VideoSequence(clips,()=>0);
 assert.equal(d.update(snapshot('wave'))?.id,'wave');
 assert.equal(d.update(snapshot('auto','listening'),1)?.id,'wave');
 // Pausing or a stalled movie does not accumulate wall-clock time.
 for(let i=0;i<100;i++)assert.equal(d.update(snapshot('auto','listening'),1)?.id,'wave');
 assert.equal(d.complete(snapshot('auto','listening'))?.id,'listen');
 assert.equal(d.complete(snapshot('auto','speaking'))?.id,'talk');
 assert.equal(d.complete(snapshot())?.id,'resting-natural');
});
test('automatic video gestures retain quiet breathing intervals and no immediate repeat',()=>{
 const d=new VideoSequence(clips,()=>0);
 const seen=[d.update(snapshot())?.id];
 for(let i=0;i<14;i++)seen.push(d.complete(snapshot())?.id);
 assert.deepEqual(seen.slice(0,4),Array(4).fill('resting-natural'));
 assert.equal(seen[4],'wave');
 assert.ok(seen.includes('joy'));
 assert.deepEqual(seen.filter(id=>id!=='resting-natural'),['wave','joy','wave']);
});
test('latest explicit request replaces an earlier pending gesture',()=>{
 const d=new VideoSequence(clips,()=>0);
 d.update(snapshot('wave'));
 d.update(snapshot('joy'),1);
 d.update(snapshot('resting-natural'),2);
 assert.equal(d.complete(snapshot('resting-natural'))?.id,'resting-natural');
});
test('diagnostic source indices include the actual baked first and last frames in both renditions',()=>{
 for(const fps of [16,32])for(const timing of [undefined,'native'] as const){
  const clip={...clips[1],timing};
  assert.equal(videoSourceFrame(clip,0,fps),clip.start);
  assert.equal(videoSourceFrame(clip,3.5-1/fps,fps),clip.start+clip.frames-1);
  assert.equal(videoSourceFrame(clip,3.5,fps),clip.start+clip.frames-1);
  const indices=Array.from({length:Math.round(3.5*fps)},(_,i)=>videoSourceFrame(clip,i/fps,fps));
  assert.ok(indices.every((value,i)=>i===0||value>=indices[i-1]));
 }
});
