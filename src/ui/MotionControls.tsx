import {useEffect,useState} from 'react';
import type {Character} from '../contracts';
import {validateMotions,type MotionClip} from '../renderer/motions';
export function MotionControls({character,value='auto',onChange,disabled=false}:{character:Character;value?:string;onChange:(id:string)=>void;disabled?:boolean}){
 const [clips,setClips]=useState<MotionClip[]>([]),[error,setError]=useState('');
 useEffect(()=>{const abort=new AbortController();setError('');setClips([]);if(character.model)fetch(`/characters/${character.id}/${character.model.motions}`,{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('动作库未找到');return r.json()}).then(v=>setClips(validateMotions(v).clips)).catch(e=>{if(!abort.signal.aborted)setError(String(e.message))});return()=>abort.abort();},[character]);
 if(character.portrait?.idle){
  const videoSpeech=character.portrait.videoSpeech===true,selected=videoSpeech&&value==='still'?'resting-natural':value;
  const body=character.portrait.body,bodyClips=(body?.clips??(body?[body]:[])).filter(c=>!('playback' in c)||!['speaking','listening'].includes(String(c.playback)));
  const expressions=bodyClips.filter(c=>'kind' in c&&c.kind==='expression');
  const gestures=bodyClips.filter(c=>(!('kind' in c)||c.kind!=='expression')&&(!videoSpeech||c.id!=='resting-natural'));
  const button=(c:{id:string;label:string})=><button key={c.id} disabled={disabled} aria-pressed={selected===c.id} onClick={()=>onChange(c.id)}>{c.label}</button>;
  return <div className="motion-controls"><strong>人物活动</strong><small>{videoSpeech?'安静陪伴，偶尔活动；说话和聆听跟随声音。':'自然静息过渡 · 全动作随机轮换 · 真实声音优先'}</small><div className="motion-buttons">{button({id:'auto',label:'自然随机'})}{videoSpeech&&button({id:'resting-natural',label:'自然静息'})}{gestures.map(button)}{!videoSpeech&&button({id:'still',label:'安静待机'})}</div>
   {expressions.length>0&&<><strong>表情 · {expressions.length} 组</strong><small>手动选择表情；声音跟随仅按音量与节奏映射语气</small><div className="motion-buttons">{expressions.map(button)}</div></>}
   {videoSpeech&&<details><summary>动画演示</summary><small>轮流展示全部动作、说话与聆听，仅供预览，不代表真实通话。</small><div className="motion-buttons">{button({id:'all-states',label:'全部状态演示'})}</div></details>}
   {!character.portrait.wholeFrame&&<details><summary>轻微头部动作</summary><div className="motion-buttons">{(character.portrait.idle.clips??[]).filter(c=>c.id!=='neutral').map(c=>button({id:c.id,label:{happy:'微笑',curious:'好奇',concerned:'关切',wink:'眨单眼','look-away':'移开视线',nod:'点头'}[c.id]??c.id}))}</div></details>}</div>;
 }
 if(!character.model)return null;
 return <div className="motion-controls"><strong>人物动作</strong><small>独立的陪伴动作，不代表豆包正在说话</small><div className="motion-buttons">{[{id:'auto',label:'自然活动'},...clips].map(c=><button key={c.id} disabled={disabled} aria-pressed={value===c.id} onClick={()=>onChange(c.id)}>{c.label}</button>)}</div>{error&&<p role="alert">{error}</p>}</div>;
}
