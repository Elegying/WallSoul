import {PortraitPainter,type Surface} from '../renderer/portrait';
import {imageAsset,validateCharacter} from '../renderer/character';
import type {Pose} from '../contracts';
import './style.css';
import './speech.css';
document.querySelector('#app')!.innerHTML=`<main><header><span>WALLSOUL · MOTION REVIEW</span><h1>安静陪伴，连续表达。</h1><p>原生完整帧 · 闭嘴聆听 · 自然静息 · 此页不采集音频</p></header><section><div id="stage"><canvas aria-label="AI人物连续播放" style="width:100%;height:100%;object-fit:contain"></canvas><div id="state">加载中</div></div><aside><h2>检查动作与过渡</h2><label>检查片段<select id="clip" disabled><option value="auto">自然陪伴</option><option value="all-states">全部状态演示</option></select></label><button id="play" disabled>播放说话片段</button><button id="listen" disabled>切换为聆听</button><button id="idle" disabled>自然待机</button><button id="sequence" disabled>连续检查：挥手 → 静息 → 整理头发 → 聆听</button><button id="all" disabled>连续检查全部动作与静息</button><label>录像时长<select id="duration"><option value="30">30 秒</option><option value="180">3 分钟</option></select></label><button id="record" disabled>录制验收画面</button><a id="download" hidden>下载验收录像</a><p>当前片段沿原方向完成收势，再进入下一状态。语音为手动演示；不代表豆包正在通话，也不逐字匹配音素。</p><pre id="metrics" aria-label="播放诊断"></pre><p id="error" role="alert"></p></aside></section></main>`;
const status=document.querySelector('#state')!,error=document.querySelector('#error')!,canvas=document.querySelector('canvas')!,ctx=canvas.getContext('2d')!,metrics=document.querySelector('#metrics')!;
let pose:Pose='idle',requested='auto',time=0,last=0,painter:PortraitPainter,recording:MediaRecorder|undefined;
let checks:string[]=[];
async function setup(){
 const c=validateCharacter(await fetch('/characters/soul/manifest.json').then(r=>r.json()));
 if(!c.portrait?.videoSpeech)throw Error('说话视频尚未打包完成');
 canvas.width=560;canvas.height=832;
 const images=new Map<string,Surface>(),p=c.portrait;
 for(const file of new Set([...c.layers.map(l=>l.src)]))images.set(file,await imageAsset(c,file));
 painter=new PortraitPainter(c,images,e=>{error.textContent=String(e)});
 const select=document.querySelector<HTMLSelectElement>('#clip')!;select.disabled=false;
 for(const clip of p.body!.clips!){const option=document.createElement('option');option.value=clip.id;option.textContent=clip.label;select.append(option)}
 select.onchange=()=>{checks=[];pose='idle';requested=select.value};
 for(const [id,value] of [['play','speaking'],['listen','listening'],['idle','idle']] as const){const button=document.querySelector<HTMLButtonElement>('#'+id)!;button.disabled=false;button.onclick=()=>{checks=[];pose=value;requested='auto';select.value='auto'}}
 const sequence=document.querySelector<HTMLButtonElement>('#sequence')!;sequence.disabled=false;sequence.onclick=()=>{checks=['wave','resting-natural','hair-tuck','resting-natural','listening-soft','listening-tilt','listening-warm','listening-nod','resting-natural'];pose='idle';requested=checks[0];select.value=requested};
 const all=document.querySelector<HTMLButtonElement>('#all')!;all.disabled=false;all.onclick=()=>{checks=p.body!.clips!.filter(c=>c.playback!=='idle').flatMap(c=>[c.id,'resting-natural']);pose='idle';requested=checks[0];select.value=requested};
 const record=document.querySelector<HTMLButtonElement>('#record')!,download=document.querySelector<HTMLAnchorElement>('#download')!;
 record.disabled=!('MediaRecorder' in window);record.onclick=()=>{
  try{const mime=['video/webm;codecs=vp9','video/webm','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m));if(!mime)throw Error('当前浏览器不支持录制');
   const chunks:Blob[]=[];const stream=canvas.captureStream(30);recording=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});
   recording.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recording.onstop=()=>{stream.getTracks().forEach(t=>t.stop());if(download.href.startsWith('blob:'))URL.revokeObjectURL(download.href);download.href=URL.createObjectURL(new Blob(chunks,{type:mime}));download.download='WallSoul-transition-review.'+(mime.includes('mp4')?'mp4':'webm');download.hidden=false;record.disabled=false;record.textContent='录制验收画面'};
   recording.start();record.disabled=true;record.textContent='正在录制，请保持页面可见…';const duration=Number(document.querySelector<HTMLSelectElement>('#duration')!.value);window.setTimeout(()=>{if(recording?.state==='recording')recording.stop()},duration*1000);
  }catch(e){error.textContent=String(e)}
 };
 status.textContent='准备完成';let metricsAt=0;
 function tick(now:number){requestAnimationFrame(tick);if(document.hidden){last=now;return}if(now-last<1000/30-1)return;time+=last?Math.min(.1,(now-last)/1000):0;last=now;ctx.fillStyle='#0b102d';ctx.fillRect(0,0,560,832);ctx.save();ctx.scale(560/c.layout.width,832/c.layout.height);painter.draw(ctx,time,pose,0,true,'neutral',.35,requested);ctx.restore();const d=painter.playbackDiagnostics;if(d.clip&&status.textContent!==d.clip)status.textContent=d.clip;
  if(now-metricsAt>400){metrics.textContent=JSON.stringify(d,null,2);metricsAt=now}
  const active=p.body!.clips!.find(c=>c.id===checks[0]);if(active&&d.displayedIndex>=active.start+active.frames-2&&d.displayedIndex<active.start+active.frames){checks.shift();if(checks.length){requested=checks[0];select.value=requested}}
 }
 requestAnimationFrame(tick);
 window.addEventListener('pagehide',()=>{painter.dispose();if(recording?.state==='recording')recording.stop()},{once:true});
}
setup().catch(e=>{error.textContent=String(e)});
