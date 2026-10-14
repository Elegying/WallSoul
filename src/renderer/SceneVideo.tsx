import {useEffect,useRef} from 'react';
import {invoke,isTauri} from '@tauri-apps/api/core';
import type {Character,Snapshot} from '../contracts';
import type {BodyMotionClip} from './bodyBehavior';
import {portraitPlacement} from './portraitPlacement';
import {VideoSequence,videoSourceFrame} from './videoSequence';

/** Complete video layers preserve the generated face; no mouth patch or canvas redraw. */
export function SceneVideo({character,snapshot,wallpaper=false,onFailure,videoBase}:{character:Character;snapshot:Snapshot;wallpaper?:boolean;onFailure:(error:string)=>void;videoBase?:string}){
 const root=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),poster=useRef<HTMLImageElement>(null);
 const first=useRef<HTMLVideoElement>(null),second=useRef<HTMLVideoElement>(null);
 const latest=useRef(snapshot);latest.current=snapshot;
 const refresh=useRef<()=>void>(()=>{});
 const failure=useRef(onFailure);failure.current=onFailure;
 useEffect(()=>{
  const node=root.current!,holder=stage.current!,videos=[first.current!,second.current!];
  const clips=character.portrait!.body!.clips!,sequence=new VideoSequence(clips);
  const urls=['',''],abort=new AbortController();
  let disposed=false,visible=!document.hidden,inViewport=true,active=-1,prepared=-1,loading=false;
  let clip:BodyMotionClip|undefined,pendingClip:BodyMotionClip|undefined,totalFrames=0,intervalFrames=0,metricsAt=performance.now(),metricsTimer=0,loadTimer=0;
  let lastMetrics='';
  const source=(path:string)=>`/characters/${character.id}/${path}`;
  const publish=(fps:number,clear=false)=>{
   const value={fps,width:Math.round(node.clientWidth),height:Math.round(node.clientHeight),playback:clip&&!clear?{clip:clip.label,displayedIndex:videoSourceFrame(clip,active<0?0:videos[active].currentTime,active>=0&&videos[active].dataset.rendition==='low'?16:32),renderedFrames:totalFrames,waitingFrames:0,cachedFrames:0}:undefined};
   const encoded=JSON.stringify(value);if(encoded===lastMetrics)return;lastMetrics=encoded;
   if(isTauri())void invoke('metrics',{value}).catch(()=>{});
  };
  const runnable=()=>{const s=latest.current;return !disposed&&!s.system.suspended&&!['paused','suspended'].includes(s.wallpaper)&&(wallpaper?s.system.desktop?.occluded!==true:visible&&inViewport)};
  const fail=(message:string)=>{if(!disposed){videos.forEach(v=>v.pause());failure.current(message)}};
  function layout(){const s=latest.current,p=portraitPlacement(node.clientWidth,node.clientHeight,character.layout.width,character.layout.height,s.settings.size,s.settings.x,s.settings.y,wallpaper);Object.assign(holder.style,{left:`${p.x}px`,top:`${p.y}px`,width:`${character.layout.width*p.scale}px`,height:`${character.layout.height*p.scale}px`})}
  function play(index:number){if(runnable())void videos[index].play().catch(e=>fail(`视频播放失败：${String(e)}`))}
  function measure(){clearTimeout(metricsTimer);if(!runnable()){publish(0);return}const now=performance.now();publish(Math.round(intervalFrames*10000/Math.max(1,now-metricsAt))/10);intervalFrames=0;metricsAt=now;metricsTimer=window.setTimeout(measure,5000)}
  function frame(index:number){
   if(disposed)return;
   if(prepared===index&&runnable()){
    // Both endpoints are complete neutral frames. Swap once the next decoder presents.
    if(active>=0&&active!==index){videos[active].style.visibility='hidden';videos[active].pause()}
    active=index;clip=pendingClip;prepared=-1;loading=false;clearTimeout(loadTimer);loadTimer=0;
    videos[index].style.visibility='visible';poster.current!.hidden=true;
   }
   if(active===index){totalFrames++;intervalFrames++}
   videos[index].requestVideoFrameCallback(()=>frame(index));
  }
  async function load(next:BodyMotionClip){
   if(disposed||loading)return;
   pendingClip=next;
   const lowPower=latest.current.settings.lowPower;
   const rendition=lowPower?'low':'normal';
   if(active>=0&&videos[active].dataset.clip===next.id&&videos[active].dataset.rendition===rendition){
    videos[active].currentTime=0;play(active);return;
   }
   loading=true;const index=active===0?1:0,video=videos[index];
   loadTimer=window.setTimeout(()=>fail('人物视频加载超时，已切回兼容播放。'),15000);
   try{
    const response=await fetch(videoBase?`${videoBase}${lowPower?'-16':''}/${next.id}.mov`:source(lowPower?next.videoLowPower!:next.video!),{signal:abort.signal});
    if(!response.ok)throw Error(`素材读取失败 (${response.status})`);
    const data=await response.blob();if(disposed)return;
    if(urls[index])URL.revokeObjectURL(urls[index]);
    urls[index]=URL.createObjectURL(new Blob([data],{type:'video/quicktime'}));
    video.dataset.clip=next.id;video.dataset.rendition=rendition;video.src=urls[index];video.load();
   }catch(error){if(!disposed)fail(String(error))}
  }
  const cleanups:(()=>void)[]=[];
  videos.forEach((video,index)=>{
   const ready=()=>{if(disposed)return;prepared=index;if(!runnable()){clearTimeout(loadTimer);loadTimer=0}play(index)};
   const ended=()=>{if(index!==active||disposed)return;const next=sequence.complete(latest.current);if(next)void load(next);else fail('没有可播放的人物片段。')};
   const error=()=>fail(video.error?.message||'人物视频解码失败。');
   video.addEventListener('loadeddata',ready);video.addEventListener('ended',ended);video.addEventListener('error',error);
   video.requestVideoFrameCallback(()=>frame(index));
   cleanups.push(()=>{video.removeEventListener('loadeddata',ready);video.removeEventListener('ended',ended);video.removeEventListener('error',error)});
  });
  function update(){
   layout();sequence.update(latest.current,active<0?0:videos[active].currentTime);
   if(runnable()){if(prepared>=0){if(!loadTimer)loadTimer=window.setTimeout(()=>fail('人物首帧未能呈现，已切回兼容播放。'),15000);play(prepared)}else if(active>=0&&!loading&&!videos[active].ended)play(active);if(!metricsTimer){metricsAt=performance.now();intervalFrames=0;metricsTimer=window.setTimeout(measure,5000)}}
   else{videos.forEach(v=>v.pause());if(prepared>=0){clearTimeout(loadTimer);loadTimer=0}clearTimeout(metricsTimer);metricsTimer=0;publish(0)}
  }
  refresh.current=update;
  const resize=new ResizeObserver(layout);resize.observe(node);
  const intersection=new IntersectionObserver(([entry])=>{inViewport=entry.isIntersecting;update()});intersection.observe(node);
  const visibility=()=>{visible=!document.hidden;update()};document.addEventListener('visibilitychange',visibility);
  layout();const initial=sequence.update(latest.current);if(initial)void load(initial);else fail('人物缺少自然静息素材。');update();
  return()=>{disposed=true;refresh.current=()=>{};abort.abort();clearTimeout(metricsTimer);clearTimeout(loadTimer);resize.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);cleanups.forEach(f=>f());videos.forEach(v=>{v.pause();v.removeAttribute('src');v.load()});urls.forEach(url=>{if(url)URL.revokeObjectURL(url)});publish(0,true)};
 },[character,wallpaper,videoBase]);
 useEffect(()=>{refresh.current()},[snapshot]);
 const style={position:'absolute' as const,inset:0,width:'100%',height:'100%',objectFit:'fill' as const};
 return <div ref={root} className={`scene ${wallpaper?'desktop-scene':''}`} aria-label={`${character.name}动态场景`}>
  <img alt="" src={`/characters/${character.id}/${character.background}`} style={{...style,objectFit:'cover'}}/>
  <div ref={stage} style={{position:'absolute'}}>
   <img ref={poster} alt="" src={`/characters/${character.id}/${character.layers[0].src}`} style={style}/>
   <video ref={first} muted playsInline preload="auto" style={{...style,visibility:'hidden'}}/>
   <video ref={second} muted playsInline preload="auto" style={{...style,visibility:'hidden'}}/>
  </div>
 </div>;
}
