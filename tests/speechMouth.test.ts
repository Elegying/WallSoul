import {test} from 'node:test';import assert from 'node:assert/strict';
import {SpeechMouth} from '../src/renderer/speechMouth';
import {validateCharacter} from '../src/renderer/character';import {readFileSync} from 'node:fs';
test('live amplitude selects discrete mouths, silence closes them, spectrum changes family',()=>{
 const m=new SpeechMouth();let frame=0;
 for(let n=0;n<20;n++)frame=m.sample(n/30,.8,.3,8,3);
 assert.ok(frame>0&&frame<8);
 frame=m.sample(1,.8,.9,8,3);assert.ok(frame>=16&&frame<24);
 for(let n=0;n<20;n++)frame=m.sample(2+n/30,0,.9,8,3);
 assert.equal(frame,0);assert.equal(m.sample(3,NaN,.3,8,3),0);
 m.reset();assert.equal(m.sample(4,0,.3,8,3),0);
});
test('mouth atlases cannot escape assets, exceed decode limits or cover outside the face canvas',()=>{
 const c=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8'));
 c.portrait.speech={sheets:['speech.png'],columns:8,rows:3,tileWidth:260,tileHeight:170,levels:8,shapes:3,region:[370,454,260,170]};assert.ok(validateCharacter(c));
 c.portrait.speech.sheets=['../speech.png'];assert.throws(()=>validateCharacter(c));
 c.portrait.speech.sheets=['speech.png'];c.portrait.speech.tileWidth=10000;assert.throws(()=>validateCharacter(c));
 c.portrait.speech.tileWidth=260;c.portrait.speech.region=[1000,450,260,170];assert.throws(()=>validateCharacter(c));
});
import {PortraitPainter} from '../src/renderer/portrait';
test('speech never composites moving head atlases or a translucent second mouth',()=>{
 const globals=globalThis as unknown as {document:unknown};const saved=globals.document;const canvases:any[]=[];
 globals.document={createElement:()=>{const calls:any[]=[];const context:any={globalAlpha:1,drawImage:(image:unknown,...args:unknown[])=>calls.push({image,args,alpha:context.globalAlpha}),clearRect:()=>{calls.length=0},save:()=>{},restore:()=>{},translate:()=>{},scale:()=>{},fillRect:()=>{},createRadialGradient:()=>({addColorStop:()=>{}})};const canvas={width:0,height:0,getContext:()=>context,calls};canvases.push(canvas);return canvas;}};
 try{
  const c=JSON.parse(readFileSync(new URL('../resources/characters/soul/manifest.json',import.meta.url),'utf8'));c.portrait.body=undefined;c.portrait.wholeFrame=true;c.portrait.videoSpeech=false;
  c.portrait.speech={sheets:['speech.png'],columns:8,rows:3,tileWidth:260,tileHeight:170,levels:8,shapes:3,region:[370,454,260,170]};
  const base={},speech={};const images=new Map<any,any>([[c.layers[0].src,base],[c.portrait.blink,{}],[c.portrait.speaking,{}],['speech.png',speech]]);
  const painter=new PortraitPainter(c,images);const output={drawImage:()=>{}} as any;
  for(const [time,level] of [[1,.9],[1.1,.2],[1.2,.8]]){
   painter.draw(output,time,'speaking',0,true,'happy',level,'auto',.6);
   const calls=canvases[0].calls;assert.equal(calls.length,2);assert.equal(calls[0].image,base);assert.equal(calls[1].image,speech);assert.equal(calls[1].alpha,1);
  }
  c.portrait.videoSpeech=true;
  painter.draw(output,2,'speaking',0,true,'neutral',.9,'auto',.6);
  assert.equal(canvases[0].calls.length,1);assert.equal(canvases[0].calls[0].image,base);
  painter.dispose();
  c.portrait.body={id:'listen',label:'聆听',sheets:['listen.png'],columns:3,rows:1,width:100,height:100,frames:3,duration:3.5,clips:[{id:'listening-soft',label:'聆听',start:0,frames:3,duration:3.5,playback:'listening'}]};
  const listenFrame={};images.set('listen.png',listenFrame);const canvasIndex=canvases.length;
  const listener=new PortraitPainter(c,images);
  listener.draw(output,0,'listening',0,false,'attentive',0,'auto');
  assert.equal(canvases[canvasIndex].calls.length,1);assert.equal(canvases[canvasIndex].calls[0].image,listenFrame);
  const firstX=canvases[canvasIndex].calls[0].args[0];
  listener.draw(output,1.8,'listening',0,false,'attentive',0,'auto');
  assert.equal(canvases[canvasIndex].calls.length,1);assert.notEqual(canvases[canvasIndex].calls[0].args[0],firstX);
  listener.dispose();
 }finally{globals.document=saved;}
});

test('conversational speech stays subtle even when the audio meter is high',()=>{
 const m=new SpeechMouth();let frame=0;
 for(let n=0;n<30;n++)frame=m.sample(n/30,.65,.3,8,3);
 assert.ok(frame>=1&&frame<=3);
 for(let n=0;n<30;n++)frame=m.sample(1+n/30,1,.3,8,3);
 assert.ok(frame<=5);
});
