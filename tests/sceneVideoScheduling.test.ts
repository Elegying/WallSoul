import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as ts from 'typescript';
import {VideoSequence,videoSourceFrame} from '../src/renderer/videoSequence';

async function harness(){
 const timers=new Map<number,()=>void>(),listeners=new Map<string,()=>void>();
 const revoked:string[]=[],metrics:any[]=[],errors:string[]=[],requests:string[]=[];
 let nextId=0,refIndex=0,effectIndex=0;
 const video=()=>{
  const handlers=new Map<string,()=>void>();let callback:()=>void=()=>{};
  return {style:{visibility:'hidden'},dataset:{} as Record<string,string>,currentTime:0,ended:false,paused:true,src:'',error:null,plays:0,
   pause(){this.paused=true},play(){this.paused=false;this.plays++;return Promise.resolve()},load(){},removeAttribute(){this.src=''},
   requestVideoFrameCallback(fn:()=>void){callback=fn},present(){const fn=callback;callback=()=>{};fn()},
   addEventListener(n:string,fn:()=>void){handlers.set(n,fn)},removeEventListener(n:string){handlers.delete(n)},emit(n:string){handlers.get(n)?.()}};
 };
 const videos=[video(),video()],node={clientWidth:1000,clientHeight:800},holder={style:{}},poster={hidden:false};
 const refs:any[]=[],effects:{deps:any[];cleanup?:()=>void}[]=[],pending:(()=>void)[]=[];
 const objects=[node,holder,poster,...videos];
 const react={useRef:(value:any)=>{const i=refIndex++;return refs[i]??(refs[i]={current:i<5?objects[i]:value})},useEffect:(effect:()=>any,deps:any[])=>{const i=effectIndex++;if(!effects[i]||deps.some((v,j)=>v!==effects[i].deps[j]))pending.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:effect()}})}};
 const document={hidden:false,addEventListener:(n:string,f:()=>void)=>listeners.set(n,f),removeEventListener:(n:string)=>listeners.delete(n)};
 const modules:Record<string,any>={react,'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},'./videoSequence':{VideoSequence,videoSourceFrame},'./portraitPlacement':{portraitPlacement:()=>({x:0,y:0,scale:1})},'@tauri-apps/api/core':{isTauri:()=>true,invoke:async(_:string,args:any)=>metrics.push(args.value)}};
 const exports:any={};
 runInNewContext(ts.transpileModule(readFileSync(new URL('../src/renderer/SceneVideo.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
  exports,require:(name:string)=>{assert.ok(modules[name],name);return modules[name]},document,performance:{now:()=>100},AbortController,Blob,
  URL:{createObjectURL:()=>`blob:${++nextId}`,revokeObjectURL:(url:string)=>revoked.push(url)},
  fetch:async(url:string)=>{requests.push(url);return {ok:true,blob:async()=>new Blob(['movie'])}},
  window:{setTimeout:(fn:()=>void)=>{timers.set(++nextId,fn);return nextId}},clearTimeout:(id:number)=>timers.delete(id),
  ResizeObserver:class{observe(){}disconnect(){}},IntersectionObserver:class{observe(){}disconnect(){}},
 });
 const clips=['resting-natural','wave','listen'].map((id,i)=>({id,label:id,start:i*113,frames:113,duration:3.5,video:`${id}.mov`,videoLowPower:`${id}-low.mov`,...(i===2?{playback:'listening'}:{})}));
 const character={id:'soul',name:'test',portrait:{body:{clips}},layers:[{src:'base.png'}],layout:{width:560,height:832},background:'bg.png'};
 let snapshot:any={wallpaper:'preview',settings:{size:.9,x:.5,y:.58,lowPower:false,mode:'manual',motion:'wave'},system:{suspended:false}};
 const render=()=>{refIndex=effectIndex=0;exports.SceneVideo({character,snapshot,onFailure:(e:string)=>errors.push(e)});pending.splice(0).forEach(f=>f())};
 const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
 render();await flush();
 return {videos,poster,metrics,errors,requests,revoked,timers,flush,update(patch:any){snapshot={...snapshot,...patch};render()},hide(hidden:boolean){document.hidden=hidden;listeners.get('visibilitychange')?.()},dispose(){effects.forEach(e=>e.cleanup?.());assert.equal(listeners.size,0)}};
}

test('decoded video handover shows one character and never restarts the ended old video while loading',async()=>{
 const s=await harness(),[a,b]=s.videos;
 assert.equal(s.requests.length,1);assert.equal(s.poster.hidden,false);
 a.emit('loadeddata');a.present();assert.equal(a.style.visibility,'visible');assert.equal(s.poster.hidden,true);
 a.currentTime=1;s.update({audio:{enabled:true,phase:'listening',emotion:'attentive'}});
 assert.equal(s.requests.length,1,'voice waits for the gesture to finish');
 a.currentTime=3.5;a.ended=true;a.emit('ended');await s.flush();
 const plays=a.plays;
 s.update({audio:{enabled:true,phase:'listening',emotion:'attentive',level:.7}});
 assert.equal(a.plays,plays,'old ended video must stay still during decoding');
 assert.equal(a.style.visibility,'visible');assert.equal(b.style.visibility,'hidden');
 b.emit('loadeddata');assert.equal(a.style.visibility,'visible');
 b.present();assert.equal(a.style.visibility,'hidden');assert.equal(b.style.visibility,'visible');
 assert.match(s.requests.at(-1)!,/listen.mov$/);assert.deepEqual(s.errors,[]);
 s.dispose();assert.equal(s.timers.size,0);assert.equal(s.metrics.at(-1).playback,undefined);assert.equal(s.revoked.length,2);
});

test('pause and hidden preview keep media position and own no periodic frame timers',async()=>{
 const s=await harness(),a=s.videos[0];a.emit('loadeddata');a.present();a.currentTime=1.25;
 s.update({wallpaper:'paused'});assert.ok(a.paused);assert.equal(a.currentTime,1.25);assert.equal(s.timers.size,0);
 s.update({wallpaper:'preview'});assert.equal(a.paused,false);assert.equal(a.currentTime,1.25);
 s.hide(true);assert.ok(a.paused);assert.equal(s.timers.size,0);
 s.hide(false);assert.equal(a.paused,false);assert.equal(a.currentTime,1.25);
 s.dispose();assert.equal(s.timers.size,0);assert.equal(a.src,'');assert.equal(s.metrics.at(-1).fps,0);
});

test('a decoded first frame waits through suspension and energy mode changes at a clip boundary',async()=>{
 const s=await harness(),[a,b]=s.videos;
 s.update({system:{suspended:true}});a.emit('loadeddata');
 assert.equal(a.plays,0);assert.equal(s.poster.hidden,false);assert.equal(s.timers.size,0);
 s.update({system:{suspended:false}});a.present();a.currentTime=1;
 s.update({settings:{size:.9,x:.5,y:.58,lowPower:true,mode:'manual',motion:'wave'}});
 assert.equal(a.currentTime,1);assert.equal(s.requests.length,1);
 a.currentTime=3.5;a.ended=true;a.emit('ended');await s.flush();
 assert.match(s.requests.at(-1)!,/-low.mov$/);
 b.emit('loadeddata');b.present();assert.equal(b.dataset.rendition,'low');
 s.dispose();assert.equal(s.timers.size,0);
});

test('decoder errors are reported for the compatibility renderer rather than left as silent frozen video',async()=>{
 const s=await harness();s.videos[0].emit('error');
 assert.deepEqual(s.errors,['人物视频解码失败。']);assert.ok(s.videos.every(v=>v.paused));
 s.dispose();assert.equal(s.timers.size,0);
});
