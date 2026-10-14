/// <reference types="vite/client" />
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SceneVideo} from '../renderer/SceneVideo';
import {validateCharacter} from '../renderer/character';
import type {Character,Snapshot} from '../contracts';
const initial={settings:{size:.9,x:.5,y:.58,mode:'manual',motion:'auto',lowPower:false},wallpaper:'preview',system:{suspended:false}} as Snapshot;
function Lab(){
 const [character,setCharacter]=useState<Character>(),[snapshot,setSnapshot]=useState(initial),[error,setError]=useState(''),[light,setLight]=useState(false),[review,setReview]=useState(false),[report,setReport]=useState('');
 useEffect(()=>{fetch('/characters/soul/manifest.json').then(r=>r.json()).then(validateCharacter).then(setCharacter).catch(e=>setError(String(e)))},[]);
 useEffect(()=>{
  if(!review||!character)return;
  const clips=character.portrait!.body!.clips!.filter(c=>c.id!=='resting-natural');let index=0;
  const seen=new Set<string>();let samples=0,overlap=0,blank=0,lastClip='',switches=0,maxHold=0,hold=0,lastTime=-1;
  const start=performance.now();
  const next=()=>setSnapshot(s=>({...s,audio:undefined,wallpaper:'preview',settings:{...s.settings,motion:index<clips.length?clips[index++].id:'resting-natural'}}));
  next();
  const sequence=window.setInterval(()=>{next();if(index>=clips.length){clearInterval(sequence)}},7500);
  const sampler=window.setInterval(()=>{
   const videos=Array.from(document.querySelectorAll('video')),visible=videos.filter(v=>v.style.visibility==='visible');
   const poster=document.querySelector('.scene>div>img') as HTMLImageElement|null;
   samples++;if(visible.length>1)overlap++;if(!visible.length&&poster?.hidden)blank++;
   if(visible.length===1){const v=visible[0],id=v.dataset.clip!;seen.add(id);if(lastClip&&lastClip!==id)switches++;lastClip=id;if(v.currentTime===lastTime)hold+=.25;else hold=0;lastTime=v.currentTime;maxHold=Math.max(maxHold,hold)}
   const elapsed=(performance.now()-start)/1000;
   setReport(JSON.stringify({elapsed:Math.round(elapsed),samples,seen:[...seen],switches,overlap,blank,maxObservedHoldSeconds:maxHold},null,2));
   if(elapsed>=175){clearInterval(sequence);clearInterval(sampler);setReview(false)}
  },250);
  return()=>{clearInterval(sequence);clearInterval(sampler)};
 },[review,character]);
 return <div style={{font:'14px system-ui',color:'#ddd',background:'#0b102d',minHeight:'100vh',padding:16}}>
  <style>{'.scene{position:relative;width:100%;height:100%}.light .scene>img{visibility:hidden}.light .scene{background:#eee9df}'}</style><h2>完整透明视频 · 原生播放验收</h2>
  <select aria-label="动作" value={snapshot.settings.motion} onChange={e=>setSnapshot(s=>({...s,settings:{...s.settings,motion:e.target.value}}))}><option value="auto">自然随机</option>{character?.portrait?.body?.clips?.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select>
  <button onClick={()=>setSnapshot(s=>({...s,audio:{enabled:true,phase:'listening',emotion:'attentive',source:'test',level:0,inputLevel:.5,outputLevel:0,error:''}}))}>模拟聆听</button>
  <button onClick={()=>setSnapshot(s=>({...s,audio:{enabled:true,phase:'speaking',emotion:'happy',source:'test',level:.5,inputLevel:0,outputLevel:.5,error:''}}))}>模拟说话</button>
  <button onClick={()=>setSnapshot(s=>({...s,audio:undefined}))}>结束模拟</button>
  <button onClick={()=>setSnapshot(s=>({...s,wallpaper:s.wallpaper==='paused'?'preview':'paused'}))}>{snapshot.wallpaper==='paused'?'继续':'暂停'}</button>
  <button onClick={()=>setLight(v=>!v)}>浅色边缘检查</button>
  <button onClick={()=>setSnapshot(s=>({...s,settings:{...s.settings,lowPower:!s.settings.lowPower}}))}>{snapshot.settings.lowPower?'标准模式':'节能模式'}</button>
  <button disabled={review} onClick={()=>setReview(true)}>{review?'正在检查全部动作…':'检查全部动作与静息'}</button>
  <p role="status">{error||`${snapshot.audio?.phase??'idle'} · ${snapshot.wallpaper}`}</p>
  <div className={light?'light':''} style={{height:580,width:'100%',position:'relative'}}>{character&&<SceneVideo character={character} snapshot={snapshot} onFailure={setError} videoBase="/artifacts/alpha-library"/>}</div>
  <pre aria-label="播放验收记录">{report}</pre>
 </div>;
}
const appRoot=createRoot(document.getElementById('root')!);
appRoot.render(<Lab/>);
if(import.meta.hot)import.meta.hot.dispose(()=>appRoot.unmount());
