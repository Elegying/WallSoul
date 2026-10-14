import {SpeechMouth} from './speechMouth';
import {FrameCache,FramePlaybackClock} from './frameCache';
import {selectPortraitMotion} from './portraitMotion';
import {imageAsset} from './character';
import {BodyBehavior} from './bodyBehavior';
import {BehaviorDirector} from './behavior';
import type { Character, Pose } from '../contracts';
export type Surface = HTMLImageElement | HTMLCanvasElement;
export function keyGreen(r:number,g:number,b:number):number {
 // Only the vivid screen is removed; skin and black hair remain opaque.
 const dominance=g-Math.max(r,b);
 return Math.max(0,Math.min(1,1-(dominance-25)/85));
}
export function preparePortrait(image:HTMLImageElement):HTMLCanvasElement {
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 for(let i=0;i<pixels.data.length;i+=4){const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];const alpha=keyGreen(r,g,b);pixels.data[i+3]=Math.round(alpha*pixels.data[i+3]);pixels.data[i+1]=Math.min(g,(r+b)/2)}
 ctx.putImageData(pixels,0,0);return canvas;
}
function patch(image:Surface,box:[number,number,number,number]):HTMLCanvasElement {
 const [x,y,w,h]=box,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d')!;
 ctx.drawImage(image,x,y,w,h,0,0,w,h);ctx.globalCompositeOperation='destination-in';
 ctx.save();ctx.translate(w/2,h/2);ctx.scale(w/2,h/2);
 const fade=ctx.createRadialGradient(0,0,.72,0,0,1);fade.addColorStop(0,'#fff');fade.addColorStop(1,'#fff0');ctx.fillStyle=fade;ctx.fillRect(-1,-1,2,2);ctx.restore();return canvas;
}
export class PortraitPainter {
 private director=new BehaviorDirector();
 private frameCache?:FrameCache<HTMLImageElement>;
 private lastBodyFrame?:{clip:string;image:HTMLImageElement};
 private bodyDirector=new BodyBehavior();
 private buffer:HTMLCanvasElement;
 private context:CanvasRenderingContext2D;
 private eyes:HTMLCanvasElement;
 private mouth:HTMLCanvasElement;
 private motion:HTMLCanvasElement;
 private gaze=0;
 private gazeTime=-1;
 private mouthState=new SpeechMouth();
 constructor(private character:Character,private images:Map<string,Surface>,onError:(error:unknown)=>void=()=>{}){
  const body=character.portrait?.body;if(body?.frameFiles)this.frameCache=new FrameCache(async index=>{const image=await imageAsset(character,body.frameFiles![index]);if(image.width!==body.frameWidth||image.height!==body.frameHeight)throw Error("身体动作原始帧尺寸不匹配");return image;},onError);
  const c=character,p=c.portrait!;this.buffer=document.createElement('canvas');const direct=p.wholeFrame&&body?.frameFiles;this.buffer.width=direct?1:c.layout.width;this.buffer.height=direct?1:c.layout.height;this.context=this.buffer.getContext('2d')!;this.motion=document.createElement('canvas');this.motion.width=p.idle?.region[2]??1;this.motion.height=p.idle?.region[3]??1;this.eyes=direct?document.createElement('canvas'):patch(images.get(p.blink)!,p.eyes);this.mouth=direct?document.createElement('canvas'):patch(images.get(p.speaking)!,p.mouth);if(direct){this.eyes.width=this.eyes.height=this.mouth.width=this.mouth.height=1;}
 }
 get currentMotionLabel(){return this.character.portrait?.body?.clips?.find(c=>c.id===this.lastBodyFrame?.clip)?.label}
 private playbackClock=new FramePlaybackClock();
 private frameReady=true;
 private renderedFrames=0;
 private waitingFrames=0;
 private displayedIndex=-1;
 get playbackDiagnostics(){return {clip:this.currentMotionLabel??'加载中',displayedIndex:this.displayedIndex,renderedFrames:this.renderedFrames,waitingFrames:this.waitingFrames,cachedFrames:this.frameCache?.size??0}};
 private source(pose:Pose):Surface {const p=this.character.portrait!,base=this.character.layers[0].src;return this.images.get(pose==='thinking'?p.thinking:base)??this.images.get(base)!}
 draw(ctx:CanvasRenderingContext2D,time:number,pose:Pose,targetGaze:number,natural=true,emotion="neutral",audioLevel?:number,requested='auto',brightness=.3){
  const idle=this.character.portrait!.wholeFrame?undefined:this.character.portrait!.idle;
  const motion=idle?.clips?.length&&natural?this.director.sample(time,idle.clips,emotion,requested):undefined;
  const body=this.character.portrait!.body;
  const videoSpeech=this.character.portrait!.videoSpeech===true;
  const voiceMotion=videoSpeech&&(pose==='speaking'||(pose==='listening'&&body?.clips?.some(c=>c.playback==='listening')===true));
  const selection=videoSpeech?selectPortraitMotion(body?.clips??[],pose,requested):undefined;
  const pool=selection?.clips??body?.clips;
  const bodyRequested=selection?.requested??(this.character.portrait!.wholeFrame&&requested!=='auto'&&!body?.clips?.some(c=>c.id===requested)?'auto':requested);
  const bodyMotion=body?this.bodyDirector.sample(videoSpeech&&this.frameCache?this.playbackClock.sample(time,this.frameReady):time,pool??[{id:body.id,label:body.label,start:0,frames:body.frames,duration:body.duration}],bodyRequested,(natural&&pose==='idle')||voiceMotion,emotion,this.character.portrait!.wholeFrame):undefined;
  let bodyPosition=bodyMotion?.position;
  let bodyFrame:HTMLImageElement|undefined;
  if(this.frameCache&&bodyMotion){
   const index=Math.min(Math.round(bodyMotion.position),bodyMotion.clip.start+bodyMotion.clip.frames-1);
   bodyFrame=this.frameCache.get(index);
   this.frameReady=Boolean(bodyFrame);
   this.renderedFrames++;if(!bodyFrame)this.waitingFrames++;else this.displayedIndex=index;
   // Whole-frame gestures always move forward: give upcoming frames decoding priority.
   for(let i=1;i<=5;i++)this.frameCache.get(Math.min(index+i,bodyMotion.clip.start+bodyMotion.clip.frames-1));
   if(bodyFrame)this.lastBodyFrame={clip:bodyMotion.clip.id,image:bodyFrame};
   else if(this.lastBodyFrame&&(this.lastBodyFrame.clip===bodyMotion.clip.id||videoSpeech))bodyFrame=this.lastBodyFrame.image;
   if(!bodyFrame)bodyPosition=undefined;
  }
  if(!bodyMotion){this.lastBodyFrame=undefined;this.frameReady=true;}
  const c=this.character,p=c.portrait!,b=this.context,w=this.buffer.width,h=this.buffer.height;
  if(p.wholeFrame&&body?.frameFiles){
   // Draw native decoded pixels straight to the output; no 1024x1536 intermediate resampling.
   ctx.drawImage(bodyFrame??this.source(pose),0,0,c.layout.width,c.layout.height);return;
  }
  b.clearRect(0,0,w,h);
  b.globalAlpha=1;b.drawImage(this.source(pose),0,0,w,h);
  if(pose==='idle'&&!p.wholeFrame&&p.idle&&natural&&bodyPosition===undefined){
   const a=p.idle,[x,y,width,height]=a.region;const position=motion?.position??time*a.fps%a.frames;const index=Math.round(position);
   const m=this.motion.getContext('2d')!;m.clearRect(0,0,width,height);
   // Keep bilinear sampling inside this tile, rather than bleeding an adjacent frame.
   const frame=(i:number,alpha:number)=>{const tile=i%(a.columns*a.rows);m.globalAlpha=alpha;m.drawImage(this.images.get(a.sheets[Math.floor(i/(a.columns*a.rows))])!,tile%a.columns*a.tileSize+.5,Math.floor(tile/a.columns)*a.tileSize+.5,a.tileSize-1,a.tileSize-1,0,0,width,height);};
   frame(Math.min(index,a.frames-1),1);m.globalAlpha=1;
   // Fade the final shoulder pixels over the unchanged body, eliminating the crop edge.
   const fade=m.createLinearGradient(0,height*.94,0,height);fade.addColorStop(0,'#fff');fade.addColorStop(1,'#fff0');m.globalCompositeOperation='destination-in';m.fillStyle=fade;m.fillRect(0,0,width,height);m.globalCompositeOperation='source-over';
   b.clearRect(x,y,width,height*.94);b.drawImage(this.motion,x,y);
  }
  if(body&&bodyPosition!==undefined){
   // Preserve actual hand silhouettes; crossfading different fingers creates ghost hands.
   const index=Math.min(Math.round(bodyPosition),bodyMotion!.clip.start+bodyMotion!.clip.frames-1);
   const tile=index%(body.columns*body.rows);b.clearRect(0,0,w,h);b.globalAlpha=1;
   if(bodyFrame)b.drawImage(bodyFrame,0,0,w,h);
   else b.drawImage(this.images.get(body.sheets[Math.floor(index/(body.columns*body.rows))])!,tile%body.columns*body.width+.5,Math.floor(tile/body.columns)*body.height+.5,body.width-1,body.height-1,0,0,w,h);
  }
  if(pose!=='speaking')this.mouthState.reset();
  if(!videoSpeech&&bodyPosition===undefined&&((pose==='idle'&&(!p.idle||p.wholeFrame||!natural))||pose==='listening'||pose==='speaking')){
   const blink=time%c.animation.blink;const closure=blink<.09?blink/.09:blink<.18?1-(blink-.09)/.09:0;
   if(closure>.45){b.globalAlpha=1;b.drawImage(this.eyes,p.eyes[0],p.eyes[1]);b.globalAlpha=1}
   if(pose==='speaking'&&!videoSpeech){
    const a=p.speech;
    const index=this.mouthState.sample(time,audioLevel??Math.max(0,Math.sin(time*11)*.6+.3),brightness,a?.levels??2,a?.shapes??1);
    if(a){const tile=index%(a.columns*a.rows),[x,y,width,height]=a.region;b.globalAlpha=1;b.drawImage(this.images.get(a.sheets[Math.floor(index/(a.columns*a.rows))])!,tile%a.columns*a.tileWidth,Math.floor(tile/a.columns)*a.tileHeight,a.tileWidth,a.tileHeight,x,y,width,height);}
    else if(index>0){b.globalAlpha=1;b.drawImage(this.mouth,p.mouth[0],p.mouth[1]);}
   }else this.mouthState.reset();
  }
  if(time!==this.gazeTime){const dt=this.gazeTime<0?1/30:Math.max(0,Math.min(.1,time-this.gazeTime));this.gaze+=(targetGaze-this.gaze)*(1-Math.exp(-3.7*dt));this.gazeTime=time}
  // One continuous surface avoids sampling seams between scaled image strips.
  const offset=pose==='listening'?this.gaze*8:this.gaze*8+Math.sin(time*.75)*1.5;
  ctx.drawImage(this.buffer,offset,0,w,h);
 }
 dispose(){this.frameCache?.dispose();this.lastBodyFrame=undefined;this.buffer.width=0;this.buffer.height=0;this.motion.width=0;this.motion.height=0;this.eyes.width=0;this.mouth.width=0;}
}
