import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('five distinct speech videos share exact endpoints across every possible transition',()=>{
 const root=new URL('../resources/characters/soul/',import.meta.url);
 const m=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8')),b=m.portrait.body;
 assert.equal(m.portrait.videoSpeech,true);
 const clips=b.clips.filter((c:any)=>c.playback==='speaking');assert.equal(clips.length,5);
 const hash=(name:string)=>createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex');
 const first=clips.map((c:any)=>hash(b.frameFiles[c.start])),last=clips.map((c:any)=>hash(b.frameFiles[c.start+c.frames-1]));
 for(const end of last)for(const start of first)assert.equal(end,start);
 assert.equal(new Set(clips.map((c:any)=>hash(b.frameFiles[c.start+56]))).size,5);
});

test('listening contains actual motion and shares the speaking transition anchor',()=>{
 const root=new URL('../resources/characters/soul/',import.meta.url);
 const m=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8')),b=m.portrait.body;
 const listening=b.clips.filter((c:any)=>c.playback==='listening'),speaking=b.clips.find((c:any)=>c.playback==='speaking');assert.equal(listening.length,4);
 const frame=(n:number)=>readFileSync(new URL(b.frameFiles[n],root));
 for(const clip of listening){
  assert.deepEqual(frame(clip.start),frame(speaking.start));
  assert.deepEqual(frame(clip.start+clip.frames-1),frame(speaking.start));
  assert.notDeepEqual(frame(clip.start+56),frame(clip.start));
 }
 const hashes=listening.map((c:any)=>createHash('sha256').update(frame(c.start+56)).digest('hex'));assert.equal(new Set(hashes).size,4);
});
