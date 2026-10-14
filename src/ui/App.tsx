import {useEffect,useRef,useState} from 'react';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import type {Character,Settings,Snapshot} from '../contracts';
import {acceptSnapshot} from '../contracts';
import {validateCharacter} from '../renderer/character';
import {Scene} from '../renderer/Scene';
import {MotionControls} from './MotionControls';
import {AudioPanel} from './AudioPanel';
import {BrowserPreview} from './BrowserPreview';
import {SettingsQueue} from './settingsQueue';
const labels:Record<string,string>={preview:'窗口预览',running:'桌面陪伴中',paused:'画面已暂停',suspended:'系统休息中',error:'需要处理',unknown:'通话状态未知',needsManualAction:'请在豆包中确认',starting:'正在请求',active:'通话已确认',ending:'正在核验结束',ended:'通话已结束'};
export function App(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[catalog,setCatalog]=useState<Character[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[tab,setTab]=useState('home');const ref=useRef<Snapshot|null>(null);const desktop=new URLSearchParams(location.search).has('wallpaper');
 const [draft,setDraft]=useState<Settings|null>(null);const updates=useRef<SettingsQueue|null>(null);
 if(!updates.current)updates.current=new SettingsQueue(async value=>{await invoke('settings',{value});const saved=await invoke<Snapshot>('snapshot');accept(saved);return ref.current!.settings;},setDraft,e=>setError(`设置更新失败：${String(e)}`));
 const accept=(s:Snapshot)=>{if(acceptSnapshot(ref.current,s)){ref.current=s;updates.current!.receive(s.settings);setSnapshot(s)}};
 useEffect(()=>{let closed=false;let off:(()=>void)|undefined;
  if(!isTauri()){setError('正在加载人物预览…');fetch('/characters/catalog.json').then(r=>{if(!r.ok)throw Error('人物清单加载失败');return r.json()}).then(c=>{if(!closed)setCatalog(c.map(validateCharacter))}).catch(e=>{if(!closed)setError(String(e.message))});return()=>{closed=true};}
  void (async()=>{off=await listen<Snapshot>('session',e=>{if(!closed)accept(e.payload)});if(closed){off();return}const [s,c]=await Promise.all([invoke<Snapshot>('snapshot'),invoke<Character[]>('characters')]);if(!closed){setCatalog(c.map(validateCharacter));accept(s)}})().catch(e=>setError(String(e)));
  return()=>{closed=true;off?.()};
 },[]);
 async function command(name:string){setBusy(true);setError('');try{if((name==='quit'||name==='wallpaper')&&!await updates.current!.flush())return;await invoke('action',{name});}catch(e){setError(String(e))}finally{setBusy(false)}}
 function update(value:Partial<Settings>){setError('');updates.current!.update(value)}
 const character=catalog.find(c=>c.id===(draft??snapshot?.settings)?.character)??catalog[0];
 if(!isTauri()&&catalog.length)return <BrowserPreview catalog={catalog}/>;
 if(!snapshot||!character)return <main className="loading"><div className="brandmark">幕</div><h1>幕灵 <small>WallSoul</small></h1><p>{error||'正在准备你的桌面陪伴…'}</p>{!isTauri()&&<p>开发：npm run tauri dev</p>}</main>;
 if(desktop)return <Scene character={character} snapshot={snapshot} wallpaper/>;
 const s=draft??snapshot.settings;const preview={...snapshot,settings:s};const paused=snapshot.wallpaper==='paused';
 return <div className="shell"><aside><div className="wordmark"><span className="brandmark">幕</span><div>幕灵<small>WALLSOUL</small></div></div><p className="nav-label">你的桌面空间</p><nav><button className={tab==='home'?'selected':''} onClick={()=>setTab('home')}><span>◈</span> 桌面陪伴</button><button className={tab==='diagnostics'?'selected':''} onClick={()=>setTab('diagnostics')}><span>◎</span> 运行诊断</button></nav><div className="sidebar-bottom"><div className="local-dot"/>本地运行 · 无需幕灵账号<p>让桌面，多一点温度。</p><button className="text-button" onClick={()=>command('quit')}>退出幕灵 ↗</button><small>只跟随声音，不接管通话</small></div></aside><main>
 <header><div><div className="eyebrow">A LITTLE SOUL ON YOUR DESKTOP</div><h1>{tab==='home'?'让陪伴，自然发生。':'真实能力，清楚可见。'}</h1><p>{tab==='home'?'一处安静的风景，一个在你身边的小小存在。':'只呈现已获得的能力，不把请求当作结果。'}</p></div><span className="version">首版预览 <b>0.6.0</b></span></header>
 {error&&<div className="notice danger" role="alert">{error}</div>}
 {snapshot.recoveryWarning&&<div className="notice warning">上次未正常退出，音频采集已保持关闭。<button onClick={()=>command('dismissRecovery')}>我知道了</button></div>}
 {tab==='home'?<><section className={`hero ${(character.portrait||character.model)?'night':''}`}><Scene character={character} snapshot={preview}/><div className="scene-top"><span className="glass-tag">◉ {labels[snapshot.wallpaper]}</span><span className="glass-tag">{character.model?'实时 3D · 骨骼动画':character.portrait?.idle?'原形象 · 连续动作':character.portrait?'AI 生成形象 · 2.5D':'技术演示角色'}</span></div><div className="scene-copy"><span>{character.description}</span><h2>{(character.portrait||character.model)?'在这里，听你说。':'慢一点，也很好。'}</h2><p>{character.name}在这里，陪你度过日常。</p></div><div className="scene-bottom"><span>{character.name} <i>·</i> {snapshot.audio?.enabled?`音频跟随 · ${snapshot.audio.phase==='speaking'?(character.portrait?.videoSpeech?'说话视频轮换':'同步口型'):snapshot.audio.phase==='listening'?'注视前方':'已开启'}`:s.mode==='demo'?'演示动画 · 无真实通话':'自然待机 · 等你开口'}</span><span>{'本地动态陪伴'}</span></div></section>
 <div className="toolbar"><div><strong>{character.name}</strong><span>{character.description}</span></div><div className="toolbar-actions"><button className="secondary" disabled={busy} onClick={()=>command(paused?'resume':'pause')}>{paused?'▷ 恢复':'Ⅱ 暂停'}</button><button className="primary" disabled={busy} onClick={()=>command('wallpaper')}>{snapshot.wallpaper==='running'?'重新应用壁纸':'设为桌面壁纸'} <span>↗</span></button></div></div>
 <MotionControls character={character} value={s.motion} disabled={busy} onChange={motion=>update({motion})}/><AudioPanel snapshot={preview} onSettingsChange={update} videoSpeech={character.portrait?.videoSpeech}/><div className="cards"><section className="card"><div className="card-heading"><h2>人物与场景</h2><span>01</span></div><label>陪伴角色<select value={s.character} disabled={busy} onChange={e=>update({character:e.target.value})}>{catalog.map(c=><option key={c.id} value={c.id}>{c.name} · {c.model?'骨骼动画':c.portrait?'AI 生成形象':'技术演示角色'}</option>)}</select></label><label>目标屏幕<select disabled={busy} value={s.screen||snapshot.system.screens[0]?.id||0} onChange={e=>update({screen:Number(e.target.value)})}>{snapshot.system.screens.length?snapshot.system.screens.map(m=><option key={m.id} value={m.id}>{m.name} · {m.width} × {m.height}</option>):<option value={0}>没有可用屏幕</option>}</select></label><div className="sliders">{([['x','水平位置',.15,.85],['y','垂直位置',.35,.8],['size','人物大小',.4,1.4]] as const).map(([key,label,min,max])=><label key={key}>{label}<output>{Math.round(s[key]*100)}%</output><input type="range" min={min} max={max} step="0.01" value={s[key]} disabled={busy} onChange={e=>update({[key]:Number(e.target.value)})}/></label>)}</div><label className="switch-row"><span>低功耗模式<small>减少每秒绘制帧数，保持自然动作速度</small></span><input type="checkbox" checked={s.lowPower} disabled={busy} onChange={e=>update({lowPower:e.target.checked})}/></label><button className="text-button" disabled={busy} onClick={()=>command('stop')}>停止壁纸，露出原桌面</button></section>
 </div><footer>壁纸默认鼠标穿透 · 关闭面板后，可从菜单栏再次打开<span>幕灵 WALLSOUL</span></footer></>:<section className="card diagnostics"><h2>音频跟随</h2><p>无内置 AI，无豆包桌面控制。音频只用于说话、聆听动画及语气提示。</p><pre>{JSON.stringify(snapshot.audio,null,2)}</pre><h2>渲染与桌面</h2><pre>{JSON.stringify({render:snapshot.metrics,desktop:snapshot.system.desktop},null,2)}</pre><h2>本次运行日志</h2><pre>{snapshot.logs.join('\n')||'暂无状态变化'}</pre></section>}
 </main></div>
}
