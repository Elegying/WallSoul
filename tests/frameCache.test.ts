import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FrameCache,FramePlaybackClock} from '../src/renderer/frameCache';
test('frame cache bounds in-flight and decoded images and ignores disposed loads',async()=>{
 const pending:{index:number;resolve:(value:number)=>void}[]=[];
 const cache=new FrameCache<number>(index=>new Promise(resolve=>pending.push({index,resolve})),error=>{throw error});
 for(let i=0;i<30;i++)cache.get(i);
 assert.equal(pending.length,4);assert.equal(cache.size,4);
 for(const item of pending)item.resolve(item.index);
 await Promise.resolve();assert.equal(cache.get(0),0);
 for(let round=0;round<10;round++){
  for(let i=0;i<4;i++)cache.get(30+round*4+i);
  for(const item of pending)item.resolve(item.index);
  await Promise.resolve();assert.ok(cache.size<=8);
 }
 cache.get(1000);cache.dispose();
 for(const item of pending)item.resolve(item.index);
 await Promise.resolve();assert.equal(cache.size,0);assert.equal(cache.get(0),undefined);
});

test('decoder stalls freeze animation time instead of skipping buffered motion',()=>{
 const clock=new FramePlaybackClock();assert.equal(clock.sample(0,true),0);
 const before=clock.sample(1/30,true);
 assert.equal(clock.sample(1,false),before);assert.equal(clock.sample(4,false),before);
 assert.ok(clock.sample(4+1/30,true)-before<.034);
});
