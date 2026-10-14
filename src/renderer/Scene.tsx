import {portraitPlacement} from './portraitPlacement';
import {lazy,Suspense} from 'react';
const Scene3D=lazy(()=>import('./Scene3D').then(m=>({default:m.Scene3D})));
const SceneVideo=lazy(()=>import('./SceneVideo').then(m=>({default:m.SceneVideo})));
import {useEffect,useRef,useState} from 'react';
import type {Character,Snapshot} from '../contracts';
import {imageAsset,validateCharacter} from './character';
import {PortraitPainter,preparePortrait,type Surface} from './portrait';
import {invoke,isTauri} from '@tauri-apps/api/core';
export function Scene(props:{character:Character;snapshot:Snapshot;wallpaper?:boolean}) {return props.character.model?<Suspense fallback={<div>正在加载 3D…</div>}><Scene3D {...props}/></Suspense>:<PortraitScene key={`${props.character.id}:${props.character.assetVersion}`} {...props}/>;}
function PortraitScene(props:{character:Character;snapshot:Snapshot;wallpaper?:boolean}){
 const [failure,setFailure]=useState('');
 const clips=props.character.portrait?.body?.clips;
 const video=isTauri()&&props.character.portrait?.wholeFrame&&clips?.length&&clips.every(c=>c.video&&c.videoLowPower)&&!failure;
 return video?<Suspense fallback={<div className="scene"/>}><SceneVideo {...props} onFailure={setFailure}/></Suspense>:<><Scene2D {...props}/>{failure&&<span role="status" title={failure} style={{position:'absolute',bottom:8,left:8,fontSize:11,color:'#eee',background:'#0009',padding:'6px 10px',borderRadius:8}}>已启用兼容播放，人物仍可互动。</span>}</>;
}
function Scene2D({character,snapshot,wallpaper=false}:{character:Character;snapshot:Snapshot;wallpaper?:boolean}) {
 const canvas=useRef<HTMLCanvasElement>(null);const wake=useRef<()=>void>(()=>{});const latest=useRef(snapshot);latest.current=snapshot;const [error,setError]=useState('');
 useEffect(()=>{
  const node=canvas.current!;const ctx=node.getContext('2d',{alpha:false})!;let disposed=false,ready=false,timer=0,visible=!document.hidden,inViewport=true,elapsed=0,last=0,frames=0,metricsAt=performance.now();const images=new Map<string,Surface>();let portrait:PortraitPainter|undefined;
  const resize=()=>{const rect=node.getBoundingClientRect();const ratio=Math.min(devicePixelRatio||1,1.5,1920/Math.max(rect.width,rect.height));node.width=Math.max(1,Math.round(rect.width*ratio));node.height=Math.max(1,Math.round(rect.height*ratio));};
  const observer=new ResizeObserver(resize);observer.observe(node);resize();
  const intersection=new IntersectionObserver(([entry])=>{if(inViewport!==entry.isIntersecting){inViewport=entry.isIntersecting;restart()}});intersection.observe(node);
  const visibility=()=>{visible=!document.hidden;restart()};document.addEventListener('visibilitychange',visibility);
  function frameRate(){const s=latest.current;return ['paused','suspended'].includes(s.wallpaper)||s.system.suspended||(wallpaper&&s.system.desktop?.occluded===true)?1:s.settings.lowPower||(!wallpaper&&s.wallpaper==='running')?15:30;}
  function restart(){
   if(disposed)return;
   clearTimeout(timer);timer=0;last=0;frames=0;metricsAt=performance.now();
   if(!wallpaper&&(!visible||!inViewport)&&isTauri())void invoke('metrics',{value:{fps:0,width:node.width,height:node.height}}).catch(()=>{});
   if(ready&&!disposed)draw(metricsAt);
  }
  wake.current=restart;
  function draw(now:number){
   if(disposed||!ready)return;
   // Hidden previews own no timer or RAF. Visibility and state events restart them.
   if(!wallpaper&&(!visible||!inViewport)){last=0;return;}
   const s=latest.current,fps=frameRate(),paused=fps===1;
   timer=window.setTimeout(()=>{timer=0;draw(performance.now())},1000/fps);
   if(now-last<1000/fps-2&&last)return;const delta=last?Math.min((now-last)/1000,.1):0;last=now;if(!paused)elapsed+=delta;
   const w=node.width,h=node.height;ctx.fillStyle='#dce5dc';ctx.fillRect(0,0,w,h);const bg=images.get(character.background);if(bg){const ratio=Math.max(w/bg.width,h/bg.height);ctx.drawImage(bg,(w-bg.width*ratio)/2,(h-bg.height*ratio)/2,bg.width*ratio,bg.height*ratio)}
   const desiredScale=(character.portrait?h/character.layout.height*1.07:Math.min(h/character.layout.height,w/character.layout.width)*.78)*s.settings.size;
   const placement=portraitPlacement(w,h,character.layout.width,character.layout.height,s.settings.size,s.settings.x,s.settings.y,wallpaper&&character.portrait?.wholeFrame===true);
   const scale=character.portrait?placement.scale:desiredScale;
   const t=elapsed;const voice=s.audio?.enabled?s.audio:undefined;const pose=voice?.phase==='speaking'?'speaking':voice?.phase==='listening'?'listening':s.settings.mode==='demo'?s.settings.demoPose:'idle';
   const breath=Math.sin(t*Math.PI*2/character.animation.breath);const blink=t%character.animation.blink<.14;
   if(portrait){ctx.save();ctx.translate(placement.x,placement.y);if(!character.portrait?.wholeFrame)ctx.translate(0,Math.sin(t*1.1)*1.2);ctx.scale(scale,character.portrait?.wholeFrame?scale:scale*(1+breath*.0018));portrait.draw(ctx,t,pose,pose==='listening'?0:s.system.pointer?Math.max(-1,Math.min(1,(s.system.pointer.x-s.settings.x)*2)):0,pose!=='listening'&&(character.portrait?.videoSpeech||s.settings.motion!=='still'),voice?.phase==='listening'?'attentive':voice?.emotion??'neutral',voice?voice.level:undefined,s.settings.motion==='still'?(character.portrait?.videoSpeech?'resting-natural':'auto'):s.settings.motion,voice?.brightness??.3);ctx.restore();}else{
   ctx.save();ctx.translate(w*s.settings.x,h*s.settings.y);ctx.rotate(pose==='listening'?.035:pose==='thinking'?-.025:0);ctx.scale(scale*(1+breath*.002),scale*(1+breath*.006));ctx.translate(-character.layout.width/2,-character.layout.height/2+breath*2);
   for(const layer of character.layers){const file=blink&&layer.blink?layer.blink:pose==='speaking'&&layer.speaking&&Math.sin(t*13)>.1?layer.speaking:layer.src;const img=images.get(file);if(img)ctx.drawImage(img,0,0,character.layout.width,character.layout.height)}ctx.restore();
   if(pose!=='idle'){ctx.fillStyle='rgba(255,250,234,.85)';ctx.beginPath();ctx.arc(w*s.settings.x+100*scale,h*s.settings.y-155*scale,24*scale,0,Math.PI*2);ctx.fill();ctx.fillStyle='#587469';ctx.font=`${20*scale}px sans-serif`;ctx.textAlign='center';ctx.fillText(pose==='thinking'?'…':pose==='listening'?'♪':'·',w*s.settings.x+100*scale,h*s.settings.y-148*scale)}
   }
   frames++;if(now-metricsAt>5000){if(isTauri())void invoke('metrics',{value:{fps:Math.round(frames*10000/(now-metricsAt))/10,width:w,height:h,playback:portrait?.playbackDiagnostics}}).catch(()=>{});frames=0;metricsAt=now;}
  }
  try{validateCharacter(character);const paths=new Set([character.background,...character.layers.flatMap(l=>[l.src,l.blink,l.speaking].filter((p):p is string=>!!p)),...(character.portrait&&!character.portrait.videoSpeech?[character.portrait.blink,character.portrait.speaking,character.portrait.thinking,character.portrait.listening,...(character.portrait.wholeFrame?[]:character.portrait.idle?.sheets??[]),...(character.portrait.speech?.sheets??[]),...(character.portrait.body?.frameFiles?[]:character.portrait.body?.sheets??[])]:[])]);Promise.all([...paths].map(async p=>{const image=await imageAsset(character,p);images.set(p,character.portrait&&!character.portrait.videoSpeech&&p!==character.background&&!character.portrait.idle?.sheets.includes(p)&&!character.portrait.body?.sheets.includes(p)&&!character.portrait.speech?.sheets.includes(p)?preparePortrait(image):image)})).then(()=>{if(!disposed){setError('');if(character.portrait)portrait=new PortraitPainter(character,images,e=>setError(String(e)));ready=true;restart()}}).catch(e=>{if(!disposed)setError(String(e.message))});}catch(e){setError(String(e))}
  return()=>{disposed=true;wake.current=()=>{};clearTimeout(timer);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);portrait?.dispose();images.clear();if(isTauri())void invoke('metrics',{value:{fps:0,width:node.width,height:node.height}}).catch(()=>{})};
 },[character,wallpaper]);
 useEffect(()=>{wake.current()},[snapshot.wallpaper,snapshot.system.suspended,snapshot.system.desktop?.occluded,snapshot.settings.lowPower]);
 return <div className={`scene ${wallpaper?'desktop-scene':''}`}><canvas ref={canvas} aria-label={`${character.name}动态场景`}/>{error&&<div className="scene-error" role="alert">{error}<br/>请在面板重新选择角色；当前为静态背景。</div>}</div>
}
