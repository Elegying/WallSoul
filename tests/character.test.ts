import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {validateCharacter,safeAsset} from '../src/renderer/character';import {acceptSnapshot,type Snapshot} from '../src/contracts';
const character=JSON.parse(readFileSync(new URL('../resources/characters/lumi/manifest.json',import.meta.url),'utf8'));
test('bundled character validates and all assets exist',()=>{const c=validateCharacter(character);for(const file of [c.preview,c.background,...c.layers.flatMap(l=>[l.src,l.blink,l.speaking].filter(Boolean))])assert.ok(readFileSync(new URL(`../resources/characters/lumi/${file}`,import.meta.url)).length>0)});
test('reject traversal, URLs and executable assets',()=>{for(const path of ['../a.png','/etc/passwd','https://x/a.png','a.js','a.svg?x','a%2f.svg','a/b.png'])assert.equal(safeAsset(path),false);assert.throws(()=>validateCharacter({...character,background:'../a.png'}))});
test('reject incompatible versions and damaged layer manifests',()=>{for(const patch of [{schemaVersion:2},{layout:{width:Infinity,height:1}},{layers:[]},{layers:[{id:'a',src:'a.svg'},{id:'a',src:'b.svg'}]},{animation:{breath:0,blink:2}}])assert.throws(()=>validateCharacter({...character,...patch}))});
test('late and foreign session events cannot replace authoritative snapshot',()=>{const s={sessionId:'a',sequence:5} as Snapshot;assert.equal(acceptSnapshot(s,{...s,sequence:4}),false);assert.equal(acceptSnapshot(s,{...s,sessionId:'b',sequence:9}),false);assert.equal(acceptSnapshot(s,{...s,sequence:6}),true)});

test('generated portrait manifest validates every pose path',()=>{const c=validateCharacter(JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8')));assert.ok(c.portrait);for(const file of [c.portrait.blink,c.portrait.speaking,c.portrait.thinking,c.portrait.listening])assert.ok(readFileSync(new URL(`../resources/characters/soul/${file}`,import.meta.url)).length>0);assert.throws(()=>validateCharacter({...c,portrait:{...c.portrait,eyes:[900,900,600,600]}}))});

test('continuous portrait animation bounds its files, memory and crop',()=>{
 const c=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8'));
 const idle={sheets:['idle-0.png','idle-1.png'],columns:8,rows:5,tileSize:512,frames:80,fps:10,region:[128,0,768,768]};
 assert.ok(validateCharacter({...c,portrait:{...c.portrait,idle}}));
 for(const patch of [{sheets:['https://x/motion.png']},{frames:81},{fps:0},{tileSize:1024},{region:[800,0,768,768]},{columns:1.5},{frames:NaN}])
  assert.throws(()=>validateCharacter({...c,portrait:{...c.portrait,idle:{...idle,...patch}}}));
});

test('optional native videos require safe paired normal and low-power paths',()=>{
 const c=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8'));
 const clip=c.portrait.body.clips[0];clip.video='motion.mov';clip.videoLowPower='motion-low.mov';
 assert.ok(validateCharacter(c));
 for(const path of ['../motion.mov','https://example.com/motion.mov','motion.mp4','motion.mov?x','/motion.mov']){
  clip.video=path;assert.throws(()=>validateCharacter(c),/透明视频/);
 }
 clip.video='motion.mov';delete clip.videoLowPower;assert.throws(()=>validateCharacter(c),/透明视频/);
});
