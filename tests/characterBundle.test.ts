import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,readFileSync,rmSync,symlinkSync,truncateSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stageCharacters} from '../scripts/stage-characters';
import {characterBundleLimits,inspectCharacters} from '../scripts/check-characters';

function fixture(){
 const root=mkdtempSync(join(tmpdir(),'wallsoul-bundle-')),source=join(root,'source'),destination=join(root,'bundle');
 mkdirSync(join(source,'demo'),{recursive:true});
 const character={id:'demo',name:'测试人物',schemaVersion:1,assetVersion:'1.0.0',description:'',demo:true,preview:'portrait.svg',background:'background.svg',layout:{width:480,height:640},animation:{breath:5,blink:4},layers:[{id:'body',src:'portrait.svg'}]};
 writeFileSync(join(source,'demo','manifest.json'),JSON.stringify(character));
 writeFileSync(join(source,'demo','portrait.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
 writeFileSync(join(source,'demo','background.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
 return {root,source,destination,character};
}
test('staging preserves every referenced byte and excludes historical source files',()=>{
 const f=fixture();try{
  const old=join(f.source,'demo','old-frame.png');writeFileSync(old,'historical source');
  const result=stageCharacters(f.source,f.destination),source=inspectCharacters(f.source),staged=inspectCharacters(f.destination);
  assert.equal(result.files,4);assert.deepEqual(staged.files,source.files);
  assert.deepEqual(JSON.parse(readFileSync(join(f.destination,'catalog.json'),'utf8')),[f.character]);
  assert.equal(existsSync(join(f.destination,'demo','old-frame.png')),false);
  assert.equal(readFileSync(old,'utf8'),'historical source');
  writeFileSync(join(f.destination,'stale.png'),'regenerable');stageCharacters(f.source,f.destination);
  assert.equal(existsSync(join(f.destination,'stale.png')),false);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
test('embedded model and motions JSON are included in the dependency closure',()=>{
 const f=fixture();try{
  const character={...f.character,model:{src:'person.vrm',motions:'motions.json'}};
  writeFileSync(join(f.source,'demo','manifest.json'),JSON.stringify(character));
  const json=Buffer.from(JSON.stringify({extensions:{VRMC_vrm:{}},buffers:[],images:[]})),header=Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+json.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  writeFileSync(join(f.source,'demo','person.vrm'),Buffer.concat([header,json]));
  writeFileSync(join(f.source,'demo','motions.json'),JSON.stringify({version:1,clips:[{id:'wave',label:'挥手',duration:2,frames:[{at:0,bones:{},height:0},{at:1,bones:{},height:0}]}]}));
  const result=stageCharacters(f.source,f.destination);assert.equal(result.files,6);
  for(const file of ['person.vrm','motions.json'])assert.deepEqual(readFileSync(join(f.destination,'demo',file)),readFileSync(join(f.source,'demo',file)));
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
test('unsafe references and oversized files fail before replacing the previous staging',()=>{
 const f=fixture();try{
  stageCharacters(f.source,f.destination);const previous=readFileSync(join(f.destination,'catalog.json'),'utf8');
  assert.throws(()=>stageCharacters(f.source,join(f.source,'bundle')),/源素材目录/);
  assert.throws(()=>stageCharacters(f.source,join(f.source,'..nested')),/源素材目录/);
  const file=join(f.source,'demo','portrait.svg');rmSync(file);symlinkSync(join(f.source,'demo','background.svg'),file);
  assert.throws(()=>stageCharacters(f.source,f.destination),/普通文件/);
  rmSync(file);writeFileSync(file,'');truncateSync(file,characterBundleLimits.fileBytes+1);
  assert.throws(()=>stageCharacters(f.source,f.destination),/普通文件/);
  assert.equal(readFileSync(join(f.destination,'catalog.json'),'utf8'),previous);
  writeFileSync(join(f.source,'demo','manifest.json'),JSON.stringify({...f.character,preview:'../outside.svg'}));
  assert.throws(()=>stageCharacters(f.source,f.destination),/路径无效/);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
test('the generated catalog obeys the same per-file limit as runtime assets',()=>{
 const f=fixture(),original=characterBundleLimits.fileBytes;try{
  const inspected=inspectCharacters(f.source),largest=Math.max(...Array.from(inspected.files.values(),v=>v.bytes));
  assert.ok(Buffer.byteLength(inspected.catalogText)>largest);
  characterBundleLimits.fileBytes=largest;
  assert.throws(()=>stageCharacters(f.source,f.destination),/清单容量/);
  assert.equal(existsSync(f.destination),false);
 }finally{characterBundleLimits.fileBytes=original;rmSync(f.root,{recursive:true,force:true});}
});
