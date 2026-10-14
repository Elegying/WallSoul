import {useState} from 'react';
import type {Character,Pose,Snapshot} from '../contracts';
import {MotionControls} from './MotionControls';
import {Scene} from '../renderer/Scene';
// This isolated visual preview never invokes desktop commands or claims a real session.
export function BrowserPreview({catalog}:{catalog:Character[]}){
 const [controls,setControls]=useState(true);
 const [pose,setPose]=useState<Pose>('idle');const [selected,setSelected]=useState('soul');const [motion,setMotion]=useState('auto');
 const character=catalog.find(c=>c.id===selected)??catalog[0];
 const videoSpeech=character.portrait?.videoSpeech===true;
 const demo:Snapshot={sessionId:'browser-visual-preview',sequence:0,wallpaper:'preview',settings:{character:character.id,screen:0,x:.65,y:.58,size:.9,lowPower:false,mode:'demo',demoPose:pose,application:'',motion},system:{suspended:false,screens:[]},message:'没有连接真实桌面会话',recoveryWarning:false,logs:[],metrics:{}};
 return <div style={{height:'100vh',background:'#050719'}}><Scene character={character} snapshot={demo}/><div className="browser-preview-controls"><button aria-expanded={controls} onClick={()=>setControls(!controls)}>{controls?'收起控制面板':'显示动作控制'}</button>{controls&&<><MotionControls character={character} value={videoSpeech&&pose!=='idle'?'':motion} onChange={value=>{setPose('idle');setMotion(value)}}/><strong>幕灵 · 动画预览</strong><p>音频跟随请使用幕灵桌面应用；此浏览器页面只用于检查人物动画。</p><span>{character.model?'实时 3D 骨骼 · 无真实通话':character.portrait?.idle?'原形象连续动作 · 无真实通话':'AI 生成素材 · 2.5D · 无真实通话'}</span><select aria-label="预览角色" value={selected} onChange={e=>{setSelected(e.target.value);setPose('idle');setMotion('auto')}}>{catalog.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>{videoSpeech?<details><summary>单项声音状态演示</summary><p>只展示人物动作，不采集声音，也不连接通话。</p>{([['listening','聆听演示'],['speaking','说话演示'],['idle','结束单项演示']] as [Pose,string][]).map(([id,name])=><button key={id} aria-pressed={pose===id} onClick={()=>{setPose(id);setMotion('auto')}}>{name}</button>)}</details>:((character.portrait?.body?[['idle','自然活动'],['speaking','口型演示']]:[['idle','待机'],['listening',character.model?'聆听演示':'整理头发姿态'],['thinking',character.model?'思考演示':'托腮姿态'],['speaking','口型演示']]) as [Pose,string][]).map(([id,name])=><button key={id} aria-pressed={pose===id} onClick={()=>setPose(id)}>{name}</button>)}</>}</div></div>
}
