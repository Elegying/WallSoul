import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Settings} from '../src/contracts';
import {SettingsQueue} from '../src/ui/settingsQueue';
const initial:Settings={character:'soul',screen:1,x:.65,y:.58,size:.9,lowPower:false,mode:'manual',demoPose:'idle',application:'豆包',motion:'auto'};
const deferred=<T>()=>{let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};

test('rapid settings edits merge optimistically and save serially without stale-snapshot rollback',async()=>{
 const first=deferred<Settings>(),second=deferred<Settings>(),writes:Settings[]=[],shown:Settings[]=[];
 const queue=new SettingsQueue(value=>{writes.push(value);return writes.length===1?first.promise:second.promise},value=>shown.push(value),error=>assert.fail(String(error)));
 queue.receive(initial);queue.update({x:.7});queue.update({y:.65});
 assert.equal(shown.at(-1)!.x,.7);assert.equal(shown.at(-1)!.y,.65);assert.equal(writes.length,0);
 const done=queue.flush();assert.equal(writes.length,1);
 queue.update({x:.8});queue.update({size:1.3});
 queue.receive({...initial,lowPower:true});
 assert.deepEqual([shown.at(-1)!.x,shown.at(-1)!.y,shown.at(-1)!.size],[.8,.65,1.3]);
 assert.equal(writes.length,1);
 first.resolve({...writes[0],lowPower:true});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(writes.length,2);
 assert.deepEqual([writes[1].x,writes[1].y,writes[1].size,writes[1].lowPower],[.8,.65,1.3,true]);
 second.resolve(writes[1]);assert.equal(await done,true);
 queue.receive(writes[1]);assert.deepEqual(shown.at(-1),writes[1]);
});

test('a failed settings batch rolls back its fields, reports failure, and keeps newer edits',async()=>{
 const first=deferred<Settings>(),writes:Settings[]=[],shown:Settings[]=[],errors:unknown[]=[];
 const queue=new SettingsQueue(async value=>{writes.push(value);return writes.length===1?first.promise:value},value=>shown.push(value),error=>errors.push(error));
 queue.receive(initial);queue.update({x:.7,y:.7});const done=queue.flush();
 queue.update({x:.82});first.reject(Error('磁盘已满'));
 assert.equal(await done,false);assert.equal(errors.length,1);assert.equal(writes.length,2);
 assert.equal(writes[1].x,.82);assert.equal(writes[1].y,initial.y);
 assert.equal(shown.at(-1)!.x,.82);assert.equal(shown.at(-1)!.y,initial.y);
});

test('flush waits for the final intent, including updates queued during an earlier flush',async()=>{
 const first=deferred<Settings>(),writes:Settings[]=[];
 const queue=new SettingsQueue(async value=>{writes.push(value);return writes.length===1?first.promise:value},()=>{},error=>assert.fail(String(error)));
 queue.receive(initial);queue.update({size:1});const background=queue.flush();
 queue.update({size:1.4,motion:'wave'});const beforeQuit=queue.flush();
 first.resolve(writes[0]);assert.equal(await beforeQuit,true);assert.equal(await background,true);
 assert.equal(writes.length,2);assert.equal(writes.at(-1)!.size,1.4);assert.equal(writes.at(-1)!.motion,'wave');
});
