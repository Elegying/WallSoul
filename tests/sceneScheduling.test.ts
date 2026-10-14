import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as ts from 'typescript';

// Exercise the real effect and drawing loop with controlled DOM events and timers.
async function scene(wallpaper=false,native=false){
 const metrics:any[]=[];
 let now=10,id=0,refIndex=0,effectIndex=0,intersection:(entries:any[])=>void=()=>{};
 const timers=new Map<number,{at:number;callback:()=>void}>(),listeners=new Map<string,()=>void>(),times:number[]=[],refs:any[]=[],effects:{deps:unknown[];cleanup?:()=>void}[]=[],pending:(()=>void)[]=[];
 const ctx=new Proxy({},{get:()=>()=>{}}),canvas={getContext:()=>ctx,getBoundingClientRect:()=>({width:560,height:832}),width:560,height:832};
 const react={lazy:()=>()=>null,Suspense:()=>null,useState:()=>['',()=>{}],useRef:(initial:any)=>{const index=refIndex++;return refs[index]??(refs[index]={current:index===0?canvas:initial})},useEffect:(effect:()=>any,deps:unknown[])=>{const index=effectIndex++;if(!effects[index]||deps.some((value,i)=>value!==effects[index].deps[i]))pending.push(()=>{effects[index]?.cleanup?.();effects[index]={deps,cleanup:effect()}})}};
 const document={hidden:false,addEventListener:(name:string,callback:()=>void)=>listeners.set(name,callback),removeEventListener:(name:string)=>listeners.delete(name)};
 const modules:Record<string,any>={react,'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},'./portraitPlacement':{portraitPlacement:()=>({x:0,y:0,scale:1})},'./character':{validateCharacter:()=>{},imageAsset:async()=>({width:560,height:832})},'./portrait':{PortraitPainter:class{draw(_ctx:unknown,time:number){times.push(time)}dispose(){}},preparePortrait:(image:unknown)=>image},'@tauri-apps/api/core':{isTauri:()=>native,invoke:async(_command:string,args:any)=>{metrics.push(args.value)}}};
 const exports:any={};
 const code=ts.transpileModule(readFileSync(new URL('../src/renderer/Scene.tsx',import.meta.url),'utf8')+'\nexport {Scene2D};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 runInNewContext(code,{exports,require:(name:string)=>{assert.ok(name in modules,name);return modules[name]},document,devicePixelRatio:1,performance:{now:()=>now},window:{setTimeout:(callback:()=>void,delay:number)=>{timers.set(++id,{at:now+delay,callback});return id}},clearTimeout:(id:number)=>timers.delete(id),requestAnimationFrame:()=>{throw Error('A throttled scene must not start a continuous RAF loop')},ResizeObserver:class{observe(){}disconnect(){}},IntersectionObserver:class{constructor(callback:typeof intersection){intersection=callback}observe(){}disconnect(){}}});
 const character={id:'test',portrait:{wholeFrame:true,videoSpeech:true},background:'bg.png',layers:[{src:'neutral.png'}],layout:{width:560,height:832},animation:{breath:4,blink:4}};
 let snapshot:any={wallpaper:'preview',settings:{size:.9,x:.65,y:.58,lowPower:false,mode:'manual',motion:'auto'},system:{suspended:false}};
 const render=()=>{refIndex=effectIndex=0;exports.Scene2D({character,snapshot,wallpaper});pending.splice(0).forEach(effect=>effect())};
 render();await new Promise(resolve=>setImmediate(resolve));
 return {times,timers,metrics,advance(ms:number){const target=now+ms;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>target)break;timers.delete(next[0]);now=next[1].at;next[1].callback()}now=target},hide(hidden:boolean){document.hidden=hidden;listeners.get('visibilitychange')!()},viewport(visible:boolean){intersection([{isIntersecting:visible}])},update(patch:any){snapshot={...snapshot,...patch};render()},dispose(){effects.forEach(effect=>effect.cleanup?.());assert.equal(listeners.size,0)}};
}

test('hidden and offscreen previews stop all frame scheduling and wake without time jumps',async()=>{
 const s=await scene();s.advance(1000);const before=s.times.at(-1)!;
 s.hide(true);assert.equal(s.timers.size,0);s.advance(10000);assert.equal(s.times.at(-1),before);
 s.hide(false);assert.equal(s.times.at(-1),before);assert.equal(s.timers.size,1);s.advance(100);assert.ok(s.times.at(-1)!-before<.11);
 const visible=s.times.at(-1);s.viewport(false);assert.equal(s.timers.size,0);s.advance(10000);s.viewport(true);assert.equal(s.times.at(-1),visible);
 s.dispose();assert.equal(s.timers.size,0);
});

test('paused previews wake at 1Hz and resume their existing animation time',async()=>{
 const s=await scene();s.advance(1000);s.update({wallpaper:'paused'});const before=s.times.at(-1),count=s.times.length;
 s.advance(3100);assert.equal(s.times.length-count,3);assert.equal(s.times.at(-1),before);
 s.update({wallpaper:'preview'});assert.equal(s.times.at(-1),before);s.advance(100);assert.ok(s.times.at(-1)!-before!<.11);
 s.update({system:{suspended:true}});const suspended=s.times.length;s.advance(2100);assert.equal(s.times.length-suspended,2);
 s.dispose();assert.equal(s.timers.size,0);
});

test('coexisting previews use 15fps while standalone previews and desktop use 30fps',async()=>{
 const panel=await scene(),desktop=await scene(true);
 const count=(s:typeof panel)=>{const before=s.times.length;s.advance(1000);return s.times.length-before};
 assert.ok(count(panel)>=29);panel.update({wallpaper:'running'});assert.ok(count(panel)<=16);
 desktop.update({wallpaper:'running'});assert.ok(count(desktop)>=29);
 desktop.update({settings:{size:.9,x:.65,y:.58,lowPower:true,mode:'manual',motion:'auto'}});assert.ok(count(desktop)<=16);
 panel.dispose();desktop.dispose();assert.equal(panel.timers.size,0);assert.equal(desktop.timers.size,0);
});


test('unmounting the native preview clears stale diagnostic playback and frame rate',async()=>{
 const s=await scene(false,true);s.advance(6000);assert.ok(s.metrics.at(-1).fps>0);
 s.dispose();assert.equal(s.metrics.at(-1).fps,0);assert.equal(s.metrics.at(-1).playback,undefined);
 const count=s.metrics.length;s.advance(10000);assert.equal(s.metrics.length,count);assert.equal(s.timers.size,0);
});
