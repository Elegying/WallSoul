import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils,type VRM,type VRMHumanBoneName} from '@pixiv/three-vrm';
import {invoke,isTauri} from '@tauri-apps/api/core';
import type {Character,Snapshot} from '../contracts';
import {validateMotions,validateEmbeddedVRM,type MotionLibrary} from './motions';

function makeClips(vrm:VRM,library:MotionLibrary):THREE.AnimationClip[]{
 const names=[...new Set(library.clips.flatMap(c=>c.frames.flatMap(f=>Object.keys(f.bones))))];
 const hips=vrm.humanoid.getNormalizedBoneNode('hips')!;const rest=hips.position.clone();
 return library.clips.map(c=>{
  const tracks:THREE.KeyframeTrack[]=[];const times:number[]=[];const heights:number[]=[];
  const values=new Map(names.map(n=>[n,[] as number[]]));
  for(let i=0;i<c.frames.length-1;i++){
   const a=c.frames[i],b=c.frames[i+1];
   for(let step=0;step<12;step++){
    const t=step/12,e=t*t*(3-2*t);times.push((a.at+(b.at-a.at)*t)*c.duration);heights.push(rest.x,rest.y+a.height+(b.height-a.height)*e,rest.z);
    for(const name of names){const ar=a.bones[name]??[0,0,0],br=b.bones[name]??[0,0,0];const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...ar)).slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(...br)),e);values.get(name)!.push(q.x,q.y,q.z,q.w);}
   }
  }
  times.push(c.duration);heights.push(rest.x,rest.y,rest.z);
  for(const name of names){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...(c.frames.at(-1)!.bones[name]??[0,0,0])));values.get(name)!.push(q.x,q.y,q.z,q.w);const bone=vrm.humanoid.getNormalizedBoneNode(name as VRMHumanBoneName);if(bone)tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.uuid}.quaternion`,times,values.get(name)!));}
  tracks.push(new THREE.VectorKeyframeTrack(`${hips.uuid}.position`,times,heights));return new THREE.AnimationClip(c.id,c.duration,tracks);
 });
}
export function Scene3D({character,snapshot,wallpaper=false}:{character:Character;snapshot:Snapshot;wallpaper?:boolean}){
 const mount=useRef<HTMLDivElement>(null),latest=useRef(snapshot);latest.current=snapshot;
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{
  const node=mount.current!;let disposed=false,lost=false,timer=0,last=performance.now(),elapsed=0,frames=0,metricsAt=last,renderer:THREE.WebGLRenderer|undefined,vrm:VRM|undefined,mixer:THREE.AnimationMixer|undefined;
  const abort=new AbortController(),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-2,2,1,-1,.01,20);let current:THREE.AnimationAction|undefined,selected='',clipTime=0,cycle=0,gazeX=0,gazeY=0;
  setError('');setLoading(true);scene.background=new THREE.Color('#080d24');scene.add(new THREE.HemisphereLight('#e5eaff','#555070',2.0));
  const key=new THREE.DirectionalLight('#fff0e9',2.6);key.position.set(-2,3,4);scene.add(key);const rim=new THREE.DirectionalLight('#9d70ff',1.6);rim.position.set(2,2,-2);scene.add(rim);
  camera.position.set(0,.83,4);camera.lookAt(0,.83,0);
  const resize=()=>{if(!renderer)return;const r=node.getBoundingClientRect();renderer.setPixelRatio(Math.min(devicePixelRatio,1.25,1600/Math.max(r.width,r.height)));renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);};
  const observer=new ResizeObserver(resize);observer.observe(node);
  const onLost=(e:Event)=>{e.preventDefault();lost=true;clearTimeout(timer);setError('3D 显示暂时中断，正在等待图形设备恢复。');};
  const onRestored=()=>{if(!disposed)setRevision(v=>v+1);};
  function draw(now:number,clips:THREE.AnimationClip[]){
   if(disposed||lost||!renderer||!vrm||!mixer)return;
   const s=latest.current;const paused=['paused','suspended'].includes(s.wallpaper)||s.system.suspended||(wallpaper?s.system.desktop?.occluded===true:document.hidden);
   const fps=paused?1:s.settings.lowPower?15:30;timer=window.setTimeout(()=>draw(performance.now(),clips),1000/fps);
   const delta=paused?0:Math.min(.08,(now-last)/1000);last=now;elapsed+=delta;clipTime+=delta;
   const listening=s.audio?.phase==='listening',speaking=s.audio?.phase==='speaking';
   const motion=listening?'idle':s.settings.motion??'auto';const requested=motion==='auto'&&s.settings.mode==='demo'?(s.settings.demoPose==='listening'?'nod':s.settings.demoPose==='thinking'?'look':'auto'):motion;
   if(selected!==requested||!current||clipTime>current.getClip().duration+1.8){
    selected=requested;const order=[0,1,4,0,6,2,0,3,1,7,0,5];const clip=requested==='auto'?clips[order[cycle++%order.length]%clips.length]:clips.find(c=>c.name===requested)??clips[0];
    const next=mixer.clipAction(clip);next.reset().setLoop(THREE.LoopOnce,1);next.clampWhenFinished=true;next.enabled=true;next.setEffectiveWeight(1).play();if(current&&current!==next){current.fadeOut(.65);next.fadeIn(.65);}current=next;clipTime=0;
   }
   mixer.update(delta);
   const pointer=s.system.pointer;const targetX=listening?0:pointer?THREE.MathUtils.clamp((pointer.x-s.settings.x)*.45,-.18,.18):Math.sin(elapsed*.22)*.07;const targetY=listening?0:pointer?THREE.MathUtils.clamp((pointer.y-.4)*.2,-.08,.08):0;
   const smoothing=1-Math.exp(-delta*4);gazeX+=(targetX-gazeX)*smoothing;gazeY+=(targetY-gazeY)*smoothing;
   const head=vrm.humanoid.getNormalizedBoneNode('head');const headPose=head?.quaternion.clone();if(head){head.rotateY(gazeX);head.rotateX(gazeY);}
   const chest=vrm.humanoid.getNormalizedBoneNode('chest');const chestPose=chest?.quaternion.clone();if(chest)chest.rotateX(Math.sin(elapsed*1.2)*.008);
   const em=vrm.expressionManager;const phase=elapsed%4.7;em?.setValue('blink',phase<.18?Math.sin(phase/.18*Math.PI):0);em?.setValue('happy',.12+.06*Math.sin(elapsed*.3));
   // Actual selected-source amplitude takes priority over an explicit visual demo.
   em?.setValue('aa',speaking?(s.audio?.level??0)*.6:s.settings.mode==='demo'&&s.settings.demoPose==='speaking'?Math.max(0,Math.sin(elapsed*10))*.45:0);
   const r=node.getBoundingClientRect(),h=1.95/s.settings.size,w=h*r.width/Math.max(1,r.height);camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();vrm.scene.position.set((s.settings.x-.5)*w,(.58-s.settings.y)*h,0);
   vrm.update(delta);renderer.render(scene,camera);if(head&&headPose)head.quaternion.copy(headPose);if(chest&&chestPose)chest.quaternion.copy(chestPose);frames++;
   if(now-metricsAt>5000){if(isTauri())void invoke('metrics',{value:{fps:Math.round(frames*10000/(now-metricsAt))/10,width:renderer.domElement.width,height:renderer.domElement.height}}).catch(()=>{});frames=0;metricsAt=now;}
  }
  void(async()=>{try{
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.domElement.setAttribute('aria-label',`${character.name}实时骨骼场景`);node.appendChild(renderer.domElement);renderer.domElement.addEventListener('webglcontextlost',onLost);renderer.domElement.addEventListener('webglcontextrestored',onRestored);resize();
   const base=`/characters/${character.id}/`;const [modelResponse,motionResponse]=await Promise.all([fetch(base+character.model!.src,{signal:abort.signal}),fetch(base+character.model!.motions,{signal:abort.signal})]);if(!modelResponse.ok||!motionResponse.ok)throw Error('3D 人物素材未找到');const data=await modelResponse.arrayBuffer();validateEmbeddedVRM(data);const motions=validateMotions(await motionResponse.json());
   const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));const gltf=await loader.parseAsync(data,'');const loaded=gltf.userData.vrm as VRM|undefined;if(!loaded)throw Error('模型缺少人形骨骼');if(disposed){VRMUtils.deepDispose(gltf.scene);return;}vrm=loaded;vrm.scene.traverse(o=>{o.frustumCulled=false;});scene.add(vrm.scene);mixer=new THREE.AnimationMixer(vrm.scene);const clips=makeClips(vrm,motions);setLoading(false);last=performance.now();draw(last,clips);
  }catch(e){if(!disposed){setLoading(false);setError(e instanceof Error?e.message:'3D 加载失败');}}})();
  return()=>{disposed=true;abort.abort();clearTimeout(timer);observer.disconnect();mixer?.stopAllAction();if(vrm){mixer?.uncacheRoot(vrm.scene);VRMUtils.deepDispose(vrm.scene);}if(renderer){renderer.domElement.removeEventListener('webglcontextlost',onLost);renderer.domElement.removeEventListener('webglcontextrestored',onRestored);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
 },[character,wallpaper,revision]);
 return <div className={`scene ${wallpaper?'desktop-scene':''}`}><div ref={mount} className="three-surface"/>{loading&&<div className="scene-error">正在加载骨骼人物…</div>}{error&&<div className="scene-error" role="alert">{error}<button onClick={()=>setRevision(v=>v+1)}>重新加载 3D</button><p>也可以在面板切回原来的半身形象。</p></div>}</div>;
}
