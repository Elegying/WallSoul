import {useEffect,useRef,useState} from 'react';
import {invoke} from '@tauri-apps/api/core';
import type {Settings,Snapshot} from '../contracts';
const phases:Record<string,string>={idle:'音频跟随已停止',permission:'等待系统音频与麦克风授权',monitoring:'等待声音',listening:'你在说话 · 注视前方',speaking:'来源正在发声 · 跟随声音',error:'采集已停止 · 需要处理'};
type AudioSource={id:string;name:string};
export function selectAudioSource(current:string,sources:AudioSource[]):string {
 if(current) return sources.some(s=>s.id===current)?current:'';
 return sources.find(s=>/豆包|doubao/i.test(s.name))?.id??'';
}
export function audioPreferences(snapshot:Snapshot){return {source:snapshot.audio?.enabled?snapshot.audio.source:snapshot.settings.audioSource??'',threshold:snapshot.settings.micThresholdDb??-38}}
export function AudioPanel({snapshot,videoSpeech=false,onSettingsChange}:{snapshot:Snapshot;videoSpeech?:boolean;onSettingsChange:(value:Partial<Settings>)=>void}){
 const preferences=audioPreferences(snapshot);
 const preferredSource=useRef(preferences.source);preferredSource.current=preferences.source;
 const [sources,setSources]=useState<AudioSource[]>([]),[source,setSource]=useState(preferences.source),[error,setError]=useState(''),[busy,setBusy]=useState(false),[threshold,setThreshold]=useState(preferences.threshold);
 const a=snapshot.audio,active=a?.enabled||a?.phase==='permission';
 async function refresh(){setError('');try{const list=await invoke<AudioSource[]>('audio_sources');setSources(list);setSource(current=>selectAudioSource(preferredSource.current||current,list));}catch(e){setError(String(e))}}
 useEffect(()=>{void refresh()},[]);
 useEffect(()=>{setSource(preferences.source)},[preferences.source]);
 useEffect(()=>{setThreshold(preferences.threshold)},[preferences.threshold]);
 async function action(command:string){setError('');setBusy(true);try{await invoke('audio_action',{command,source,micThresholdDb:threshold})}catch(e){setError(String(e))}finally{setBusy(false)}}
 return <section className="card voice-card"><div className="card-title"><h2>跟随豆包的声音</h2><span>双路音频 · 本机处理</span></div><p className="explanation">在豆包里自行开始语音，然后选择它所在的应用。幕灵只分析声音，不生成回答，也不操作豆包。</p>
 <label>豆包声音来自<select value={source} disabled={!!active||busy} onChange={e=>{setSource(e.target.value);onSettingsChange({audioSource:e.target.value})}}><option value="">{sources.length?'请选择豆包或它所在的浏览器':'请先打开音频来源应用'}</option>{sources.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><p className="subtle">网页版请选择浏览器。同一应用中的其他标签页或音效也会被采集，请暂停其他播放；不会采集其他应用的输出。</p>
 <label>麦克风触发阈值 <output>{threshold} dB</output><input type="range" min={-60} max={-25} step={1} value={threshold} disabled={!!active||busy} onChange={e=>{const value=Number(e.target.value);setThreshold(value);onSettingsChange({micThresholdDb:value})}}/></label><p className="subtle">越低越灵敏。你说话时人物注视屏幕前方，不使用摄像头；来源发声期间抑制麦克风回声触发。</p>
 <div className="voice-status" role="status"><i className={a?.phase==='speaking'?'speaking':''}/>{videoSpeech&&a?.phase==='speaking'?'来源正在发声 · 说话视频轮换':phases[a?.phase??'idle']??'准备中'}</div>
 <label className="voice-meter">你的麦克风 <meter min={0} max={1} value={a?.inputLevel??0} aria-label="麦克风输入电平"/></label><label className="voice-meter">来源输出 <meter min={0} max={1} value={a?.outputLevel??0} aria-label="来源输出电平"/></label>
 <p className="subtle">表情：{a?.phase==='listening'?'专注倾听':a?.emotion==='happy'?'活跃语气':'平静'}。按声音强弱和节奏映射，不代表理解了语义情绪。{videoSpeech?'声音触发多段 AI 说话视频轮换；口部动作来自视频，不逐字匹配音素。':'嘴型按声音强弱与高频变化切换，支持多档开合，不解析文字音素。'}</p>
 {(error||a?.error)&&<p className="notice danger" role="alert">{error||a?.error}</p>}
 {a?.phase==='permission'&&<p className="notice">请在 macOS 弹窗允许麦克风和系统音频录制。停止后不会因迟到的授权而重新采集。</p>}
 <div className="button-row"><button disabled={!source||!!active||busy} onClick={()=>void action('start')}>开始跟随</button><button className="secondary" onClick={()=>void action('stop')}>停止音频跟随</button><button className="text-button" disabled={!!active||busy} onClick={()=>void refresh()}>刷新来源</button></div><small>不录制、不保存、不上传音频；不使用本地或云端 AI。锁屏、睡眠和退出会停止采集，恢复后需手动开启。佩戴耳机可以减少回声干扰。</small></section>
}
