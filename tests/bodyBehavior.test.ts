import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BodyBehavior,easeMotionProgress} from '../src/renderer/bodyBehavior';
import {validateCharacter} from '../src/renderer/character';
import {readFileSync} from 'node:fs';
const clips=[{id:'hair-tuck',label:'整理头发',start:0,frames:57,duration:3.5,emotions:['neutral']},{id:'wave',label:'挥手',start:57,frames:29,duration:3.5,emotions:['happy','neutral']}];
test('reviewed native motion preserves recorded timing through interruptions and pauses',()=>{
 const rest={id:'resting-natural',label:'自然静息',start:300,frames:113,duration:3.5,playback:'idle' as const,timing:'native' as const};
 const d=new BodyBehavior(()=>0);
 d.sample(0,[rest],'resting-natural',true,'neutral',true);
 assert.equal(d.sample(.5,[rest],'resting-natural',true,'neutral',true)!.position,316);
 assert.equal(d.sample(.5,clips,'wave',true,'neutral',true)!.position,316);
 assert.equal(d.sample(1,clips,'wave',true,'neutral',true)!.position,332);
 assert.equal(d.sample(3.5,clips,'wave',true,'neutral',true)!.clip.id,'wave');
 const m=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8'));
 m.portrait.body.clips[0].timing='native';assert.ok(validateCharacter(m));
 m.portrait.body.clips[0].timing='fast';assert.throws(()=>validateCharacter(m));
});
test('body gestures freeze with scene time and yield immediately to speech',()=>{
 const d=new BodyBehavior(()=>0);
 assert.equal(d.sample(0,clips,'auto',true),undefined);
 assert.equal(d.sample(12,clips,'auto',true)?.clip.id,'hair-tuck');
 assert.deepEqual(d.sample(13,clips,'auto',true),d.sample(13,clips,'auto',true));
 assert.equal(d.sample(13,clips,'auto',false),undefined);
 assert.equal(d.sample(14,clips,'auto',true),undefined);
 assert.equal(d.sample(14,clips,'hair-tuck',true)?.position,0);
 assert.equal(d.sample(18,clips,'hair-tuck',true),undefined);
 assert.equal(d.sample(19,clips,'hair-tuck',true),undefined);
 assert.equal(d.sample(23,clips,'hair-tuck',true)?.position,0);
});
test('body selection follows mood, avoids adjacent repeats and lets gestures finish',()=>{
 const d=new BodyBehavior(()=>0);
 assert.equal(d.sample(12,clips,'auto',true)?.clip.id,'hair-tuck');
 assert.equal(d.sample(13,clips,'auto',true,'happy')?.clip.id,'hair-tuck');
 assert.equal(d.sample(16,clips,'auto',true,'happy'),undefined);
 assert.equal(d.sample(34,clips,'auto',true,'happy')?.clip.id,'wave');
 const e=new BodyBehavior(()=>0);
 assert.equal(e.sample(12,clips,'auto',true,'concerned'),undefined);
 assert.equal(e.sample(13,clips,'wave',true,'concerned')?.clip.id,'wave');
});
test('body atlas rejects excessive decode memory and path traversal',()=>{
 const c=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8'));
 validateCharacter(c);
 c.portrait.body.sheets=['../private.png'];assert.throws(()=>validateCharacter(c));
 c.portrait.body.sheets=['body.png'];c.portrait.body.width=1024;c.portrait.body.height=1024;assert.throws(()=>validateCharacter(c));
});
test('native body frame paths and decode dimensions are validated',()=>{
 const c=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8'));
 validateCharacter(c);
 c.portrait.body.frameFiles[0]='../outside.png';assert.throws(()=>validateCharacter(c));
 c.portrait.body.frameFiles[0]='body-frame-000.png';c.portrait.body.frameWidth=4096;assert.throws(()=>validateCharacter(c));
});
test('manual expressions never enter random idle selection, but remain selectable',()=>{
 const list=[{id:'anger',label:'怒',start:0,frames:113,duration:3.5,automatic:false},...clips];
 const d=new BodyBehavior(()=>0);
 assert.equal(d.sample(12,list,'auto',true)?.clip.id,'hair-tuck');
 assert.equal(d.sample(13,list,'anger',true)?.clip.id,'anger');
 assert.equal(d.sample(14,list,'anger',false),undefined);
});
test('streamed libraries exceed atlas capacity without increasing decoded frame size',()=>{
 const c=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8'));
 const a=c.portrait.body;a.frames=3072;a.frameFiles=Array.from({length:a.frames},(_,i)=>`test-${i}.png`);
 assert.ok(validateCharacter(c));
 a.frames=3073;a.frameFiles=Array.from({length:a.frames},(_,i)=>`test-${i}.png`);assert.throws(()=>validateCharacter(c));
});
test('whole-frame interruption preserves forward direction and the original eased timeline',()=>{
 const d=new BodyBehavior(()=>0),reference=new BodyBehavior(()=>0);
 d.sample(0,clips,'hair-tuck',true,'neutral',true);
 reference.sample(0,clips,'hair-tuck',true,'neutral',true);
 const before=d.sample(1,clips,'hair-tuck',true,'neutral',true)!;
 assert.equal(d.sample(1,clips,'hair-tuck',false,'neutral',true)!.position,before.position);
 let previous=before.position;
 for(let frame=1;frame<250;frame++){
  const time=1+frame/100;
  const current=d.sample(time,clips,'hair-tuck',false,'neutral',true)!;
  assert.ok(current.position>=previous);
  assert.equal(current.position,reference.sample(time,clips,'hair-tuck',true,'neutral',true)!.position);
  previous=current.position;
 }
 assert.equal(d.sample(3.5,clips,'hair-tuck',false,'neutral',true),undefined);
});

test('late interruption finishes at normal speed and queues the next gesture',()=>{
 const d=new BodyBehavior(()=>0);d.sample(0,clips,'hair-tuck',true,'neutral',true);
 const before=d.sample(2.5,clips,'hair-tuck',true,'neutral',true)!;
 assert.equal(d.sample(2.5,clips,'wave',true,'neutral',true)!.position,before.position);
 const middle=d.sample(2.6,clips,'wave',true,'neutral',true)!;
 assert.ok(middle.position>before.position&&middle.position-before.position<2);
 assert.equal(d.sample(3.51,clips,'wave',true,'neutral',true)?.clip.id,'wave');
});

test('voice clips start immediately and rotate without empty frames or adjacent repeats',()=>{
 const list=[{id:'soft-a',label:'轻声一',start:0,frames:113,duration:3.5,playback:'speaking' as const},{id:'soft-b',label:'轻声二',start:113,frames:113,duration:3.5,playback:'speaking' as const}];
 const d=new BodyBehavior(()=>0);
 assert.equal(d.sample(0,list,'voice:speaking',true,'neutral',true)?.clip.id,'soft-a');
 for(let frame=1;frame<=224;frame++){const current=d.sample(frame/32,list,'voice:speaking',true,'neutral',true);assert.ok(current);if(frame===112)assert.equal(current.clip.id,'soft-b');}
 assert.equal(d.sample(7,list,'voice:speaking',true,'neutral',true)?.clip.id,'soft-a');
 const before=d.sample(7.5,list,'voice:speaking',true,'neutral',true)!;
 assert.equal(d.sample(7.5,clips,'auto',false,'neutral',true)?.position,before.position);
 assert.ok(d.sample(7.6,clips,'auto',false,'neutral',true)!.position>before.position);
 assert.equal(d.sample(10.51,clips,'auto',false,'neutral',true),undefined);
});

test('video speech requires two automatic full-frame clips and validates playback',()=>{
 const c=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8'));
 c.portrait.videoSpeech=true;
 for(const clip of c.portrait.body.clips)delete clip.playback;
 assert.throws(()=>validateCharacter(c));
 for(const clip of c.portrait.body.clips.slice(0,2)){clip.playback='speaking';clip.automatic=true;delete clip.emotions;}
 assert.ok(validateCharacter(c));
 c.portrait.body.clips[0].playback='unknown';assert.throws(()=>validateCharacter(c));
});

test('voice shuffle uses all five clips before repeating and avoids a repeat across rounds',()=>{
 const list=Array.from({length:5},(_,i)=>({id:`speech-${i}`,label:`说话${i}`,start:i*113,frames:113,duration:3.5,playback:'speaking' as const}));
 const d=new BodyBehavior(()=>0),seen=[];
 for(let i=0;i<10;i++)seen.push(d.sample(i*3.5,list,'voice:speaking',true,'neutral',true)!.clip.id);
 assert.equal(new Set(seen.slice(0,5)).size,5);assert.equal(new Set(seen.slice(5)).size,5);assert.notEqual(seen[4],seen[5]);
});

test('listening loops continuously and yields through the existing gesture transition',()=>{
 const listening=[{id:'listening-soft',label:'专注聆听',start:0,frames:113,duration:3.5,playback:'listening' as const}];
 const speech=[{id:'speech-a',label:'说话',start:113,frames:113,duration:3.5,playback:'speaking' as const}];
 const d=new BodyBehavior(()=>0);
 for(let i=0;i<240;i++)assert.ok(d.sample(i/30,listening,'voice:listening',true,'attentive',true));
 const before=d.sample(8,listening,'voice:listening',true,'attentive',true)!;
 assert.equal(d.sample(8,speech,'voice:speaking',true,'neutral',true)!.position,before.position);
 assert.equal(d.sample(10,speech,'voice:speaking',true,'neutral',true)!.clip.id,'listening-soft');
 assert.equal(d.sample(10.51,speech,'voice:speaking',true,'neutral',true)!.clip.id,'speech-a');
});

test('four listening states shuffle without gaps or repetition within each round',()=>{
 const clips=Array.from({length:4},(_,i)=>({id:`listen-${i}`,label:`聆听${i}`,start:i*113,frames:113,duration:3.5,playback:'listening' as const}));
 const d=new BodyBehavior(()=>.7),seen:string[]=[];
 for(let frame=0;frame<32*28;frame++){
  const current=d.sample(frame/32,clips,'voice:listening',true,'attentive',true);assert.ok(current);
  if(frame%112===0)seen.push(current.clip.id);
 }
 assert.equal(new Set(seen.slice(0,4)).size,4);assert.equal(new Set(seen.slice(4,8)).size,4);
 assert.notEqual(seen[3],seen[4]);
});

test('mixed random visits every action including manual expressions and voice clips',()=>{
 const list=[...clips,{id:'anger',label:'怒',start:86,frames:113,duration:3.5,automatic:false},{id:'speech',label:'说话',start:199,frames:113,duration:3.5,playback:'speaking' as const}];
 const d=new BodyBehavior(()=>0),seen:string[]=[];let previous='';
 for(let frame=0;frame<32*20;frame++){const c=d.sample(frame/32,list,'mix:all',true,'attentive',true);if(c&&c.clip.id!==previous){seen.push(c.clip.id);previous=c.clip.id;}}
 assert.equal(new Set(seen.slice(0,4)).size,4);assert.ok(seen.includes('anger'));assert.ok(seen.includes('speech'));assert.ok(seen.includes('wave'));
});

test('bundled relaxed mixed mode eventually reaches all 21 states',()=>{
 const m=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8'));
 const list=m.portrait.body.clips,d=new BodyBehavior(()=>.35),seen:string[]=[];let previous='';
 for(let frame=0;frame<32*800;frame++){const c=d.sample(frame/32,list,'mix:all',true,'neutral',true);if(c&&c.clip.id!=='resting-natural'&&c.clip.id!==previous){seen.push(c.clip.id);previous=c.clip.id;}}
 assert.equal(new Set(seen).size,list.filter((c:any)=>c.id!=='resting-natural').length);assert.equal(list.length,22);
});

test('mixed full-frame playback never falls back to a still between actions',()=>{
 const m=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8'));
 const d=new BodyBehavior(()=>.4);
 for(let frame=0;frame<32*160;frame++)assert.ok(d.sample(frame/32,m.portrait.body.clips,'mix:all',true,'neutral',true));
 const b=m.portrait.body,joy=b.clips.find((c:any)=>c.id==='joy');
 assert.deepEqual(readFileSync(new URL('../resources/characters/soul/'+b.frameFiles[joy.start],import.meta.url)),readFileSync(new URL('../resources/characters/soul/'+b.frameFiles[joy.start+joy.frames-1],import.meta.url)));
 assert.deepEqual(readFileSync(new URL('../resources/characters/soul/'+m.layers[0].src,import.meta.url)),readFileSync(new URL('../resources/characters/soul/'+b.frameFiles[0],import.meta.url)));
});


test('relaxed mixed mode uses moving quiet clips between accents and responds to speech',()=>{
 const m=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8'));
 const d=new BodyBehavior(()=>.5),list=m.portrait.body.clips;let quiet=0;
 for(let f=0;f<32*120;f++){const c=d.sample(f/32,list,'mix:all',true,'neutral',true)!;assert.ok(c);if(c.clip.id==='resting-natural')quiet++;}
 assert.ok(quiet/(32*120)>.7);
 const speech=list.filter((c:any)=>c.playback==='speaking');
 d.sample(120,speech,'voice:speaking',true,'neutral',true);
 assert.equal(d.sample(126,speech,'voice:speaking',true,'neutral',true)!.clip.playback,'speaking');
});

test('dedicated rest bridges random and repeated manual actions without static gaps',()=>{
 const rest={id:'resting-natural',label:'自然静息',start:300,frames:113,duration:3.5,playback:'idle' as const};
 const list=[...clips,rest],d=new BodyBehavior(()=>.5);
 assert.equal(d.sample(0,list,'mix:all',true,'neutral',true)!.clip.id,rest.id);
 assert.ok(d.sample(1,list,'mix:all',true,'neutral',true)!.position>rest.start);
 const manual=new BodyBehavior(()=>.5);
 assert.equal(manual.sample(0,list,'wave',true,'neutral',true)!.clip.id,'wave');
 const duration=clips.find(c=>c.id==='wave')!.duration;
 assert.equal(manual.sample(duration+.01,list,'wave',true,'neutral',true)!.clip.id,rest.id);
});

test('full-frame motion has continuous speed and settles at both ends',()=>{
 assert.equal(easeMotionProgress(0),0);assert.equal(easeMotionProgress(1),1);
 let last=0;for(let i=1;i<=1000;i++){const p=easeMotionProgress(i/1000);assert.ok(p>=last);last=p;}
 const h=.00001;assert.ok(easeMotionProgress(h)/h<.001);assert.ok((1-easeMotionProgress(1-h))/h<.001);
 for(const p of [.18,.82])assert.ok(Math.abs((easeMotionProgress(p+h)-easeMotionProgress(p))/h-(easeMotionProgress(p)-easeMotionProgress(p-h))/h)<.001);
});


test('manual request survives the current rest and bypasses its remaining quiet interval',()=>{
 const rest={id:'resting-natural',label:'自然静息',start:300,frames:113,duration:3.5,playback:'idle' as const};
 const list=[...clips,rest],d=new BodyBehavior(()=>.5);
 d.sample(0,list,'mix:all',true,'neutral',true);
 const before=d.sample(1,list,'mix:all',true,'neutral',true)!;
 assert.equal(d.sample(1,list,'wave',true,'neutral',true)!.position,before.position);
 assert.equal(d.sample(3.49,list,'wave',true,'neutral',true)!.clip.id,rest.id);
 assert.equal(d.sample(3.5,list,'wave',true,'neutral',true)!.clip.id,'wave');
 assert.equal(d.sample(7,list,'wave',true,'neutral',true)!.clip.id,rest.id);
});

test('latest manual selection wins after the current action, and voice cancels pending manual work',()=>{
 const rest={id:'resting-natural',label:'自然静息',start:300,frames:113,duration:3.5,playback:'idle' as const};
 const speech={id:'speech',label:'轻声说话',start:413,frames:113,duration:3.5,playback:'speaking' as const};
 const list=[...clips,rest,speech],d=new BodyBehavior(()=>.5);
 d.sample(0,list,'wave',true,'neutral',true);
 assert.equal(d.sample(1,list,'hair-tuck',true,'neutral',true)!.clip.id,'wave');
 assert.equal(d.sample(2,list,'resting-natural',true,'neutral',true)!.clip.id,'wave');
 assert.equal(d.sample(3.5,list,'resting-natural',true,'neutral',true)!.clip.id,rest.id);
 d.sample(4,list,'hair-tuck',true,'neutral',true);
 assert.equal(d.sample(5,[speech],'voice:speaking',true,'neutral',true)!.clip.id,rest.id);
 assert.equal(d.sample(7,[speech],'voice:speaking',true,'neutral',true)!.clip.id,speech.id);
});

test('brief voice-state changes do not lock the player into an obsolete interruption',()=>{
 const rest={id:'resting-natural',label:'自然静息',start:300,frames:113,duration:3.5,playback:'idle' as const};
 const speech={id:'speech',label:'轻声说话',start:413,frames:113,duration:3.5,playback:'speaking' as const};
 const list=[...clips,rest],d=new BodyBehavior(()=>.5),reference=new BodyBehavior(()=>.5);
 d.sample(0,list,'mix:all',true,'neutral',true);reference.sample(0,list,'mix:all',true,'neutral',true);
 d.sample(.5,[speech],'voice:speaking',true,'neutral',true);
 assert.equal(d.sample(.6,list,'mix:all',true,'neutral',true)!.position,reference.sample(.6,list,'mix:all',true,'neutral',true)!.position);
 assert.equal(d.sample(3.5,list,'mix:all',true,'neutral',true)!.clip.id,rest.id);
});


test('resting intervals preserve the previous accent across shuffle rounds',()=>{
 const rest={id:'resting-natural',label:'自然静息',start:300,frames:113,duration:3.5,playback:'idle' as const};
 const choices=[.99,0,0,0,0,0],d=new BodyBehavior(()=>choices.shift()??0),seen:string[]=[];
 let previous='';
 for(let t=0;t<70;t+=3.5){const clip=d.sample(t,[...clips,rest],'mix:idle',true,'neutral',true)!.clip;if(clip.id!==previous&&clip.id!==rest.id)seen.push(clip.id);previous=clip.id;}
 assert.deepEqual(seen.slice(0,3),['wave','hair-tuck','wave']);
});

test('leaving a long voice session settles into rest before another random accent',()=>{
 const rest={id:'resting-natural',label:'自然静息',start:300,frames:113,duration:3.5,playback:'idle' as const};
 const speech={id:'speech',label:'轻声说话',start:413,frames:113,duration:3.5,playback:'speaking' as const};
 const d=new BodyBehavior(()=>0),list=[...clips,rest];
 for(let t=0;t<40;t+=.5)d.sample(t,[speech],'voice:speaking',true,'neutral',true);
 assert.equal(d.sample(40,list,'mix:idle',true,'neutral',true)!.clip.id,speech.id);
 for(let t=42;t<54;t+=.5)assert.equal(d.sample(t,list,'mix:idle',true,'neutral',true)!.clip.id,rest.id);
 assert.notEqual(d.sample(56,list,'mix:idle',true,'neutral',true)!.clip.id,rest.id);
});
