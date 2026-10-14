import * as THREE from 'three';
import './style.css';
document.querySelector('#app')!.innerHTML=`<main><header><span>WALLSOUL · MOTION STUDY 01</span><h1>让说话，发生在整张脸上。</h1><p>原形象面部运动小样 · 轻声唇动，笑时露齿 · 未替换正式版</p></header><section><div id="stage"><div class="tag">修订 3 · 说话不露齿</div><div id="state">准备中</div><div class="stage-controls"><button id="stagePlay" disabled>播放小样</button><button id="stageListen" disabled>我来说话</button><button id="stageSmile" disabled>笑一下</button></div></div><aside><h2>先看运动，再看细节。</h2><p>说话时小幅唇动、不露牙齿；笑容单独控制，只有笑时才露齿。</p><button id="play" disabled>播放 20 秒小样</button><button id="listen" class="secondary" disabled>模拟我开始说话</button><button id="smile" class="secondary" disabled>预览笑容</button><label>手动唇动幅度 <input id="jaw" disabled type="range" min="0" max="0.14" step="0.01" value="0"></label><label><input id="mesh" disabled type="checkbox"> 显示面部网格</label><div class="metrics"><span>下颌 <b id="jawRead">0°</b></span><span>状态 <b id="phase">待机</b></span></div><p class="note">这是原图投影到深度网格的正面小样，头发和身体仍保留原图。尚不是完整写实3D角色；音频按声学特征驱动，尚未接入音素模型。</p><p id="error" role="alert"></p></aside></section><footer>本机运行 · 测试音频为系统合成语音 · 不读取摄像头或麦克风</footer></main>`;
const status=document.querySelector('#state')!,phase=document.querySelector('#phase')!,slider=document.querySelector<HTMLInputElement>('#jaw')!;
const stage=document.querySelector<HTMLDivElement>('#stage')!;
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,stencil:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;stage.prepend(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-340,340,480,-480,.1,2500);camera.position.z=1500;
const light=new THREE.HemisphereLight(0xfff2e9,0x4b405b,2);scene.add(light);const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(-200,400,1000);scene.add(key);
const audio=new Audio('/face-lab/speech.wav');let ac:AudioContext|undefined,analyser:AnalyserNode|undefined;
let smileUntil=0,smileStrength=0;
let running=false,start=0,listen=false,level=0,openness=0,previous=performance.now(),hidden=false;
async function setup(){
 const data=await fetch('/face-lab/face.json').then(r=>r.json());const p:number[][]=data.points;const w=data.width,h=data.height;
 const texture=await new THREE.TextureLoader().loadAsync('/characters/soul/neutral-clean.png');texture.colorSpace=THREE.SRGBColorSpace;
 // Keep the original portrait around a cut-out face; the mouth has real empty space behind it.
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const cx=canvas.getContext('2d')!;cx.drawImage(texture.image,0,0);cx.globalCompositeOperation='destination-out';cx.beginPath();data.oval.forEach((i:number,j:number)=>{const x=p[i][0]*.985+480*.015,y=p[i][1]*.985+420*.015;j?cx.lineTo(x,y):cx.moveTo(x,y)});cx.closePath();cx.fill();
 const outside=new THREE.CanvasTexture(canvas);outside.colorSpace=THREE.SRGBColorSpace;
 const group=new THREE.Group();scene.add(group);const cy=480;
 const plate=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:outside,transparent:true,depthWrite:false}));plate.position.set(0,cy-h/2,-250);group.add(plate);
 const position=new Float32Array(p.flatMap(q=>[q[0]-w/2,cy-q[1],q[2]]));const base=position.slice();const uv=new Float32Array(p.flatMap(q=>[q[0]/w,1-q[1]/h]));
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(position,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(data.triangles);geo.computeVertexNormals();
 const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});const face=new THREE.Mesh(geo,material);group.add(face);
 const wire=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:0x87e8b5,wireframe:true,transparent:true,opacity:.5,depthTest:false}));wire.visible=false;wire.renderOrder=5;group.add(wire);
 document.querySelector<HTMLInputElement>('#mesh')!.onchange=e=>{wire.visible=(e.target as HTMLInputElement).checked};
 const left=p[61],right=p[291],upper=p[13],lower=p[14];const mouthWidth=Math.hypot(right[0]-left[0],right[1]-left[1]);const mx=(left[0]+right[0])/2-w/2,my=cy-(upper[1]+lower[1])/2,mz=(upper[2]+lower[2])/2;
 const cavity=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),new THREE.MeshBasicMaterial({color:0x230d14}));cavity.position.set(mx,my,mz-16);cavity.scale.set(mouthWidth*.53,mouthWidth*.35,6);group.add(cavity);
 const upperTeeth=new THREE.Group(),lowerTeeth=new THREE.Group();upperTeeth.position.set(mx,my,mz-5);lowerTeeth.position.copy(upperTeeth.position);lowerTeeth.position.z-=3;group.add(upperTeeth,lowerTeeth);
 const apertureIndices=[78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95];
 const aperturePositions=new Float32Array(apertureIndices.length*3);const apertureGeo=new THREE.BufferGeometry();apertureGeo.setAttribute('position',new THREE.BufferAttribute(aperturePositions,3));apertureGeo.setIndex(Array.from({length:apertureIndices.length-2},(_,i)=>[0,i+1,i+2]).flat());
 const aperture=new THREE.Mesh(apertureGeo,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:false,side:THREE.DoubleSide,stencilWrite:true,stencilRef:1,stencilFunc:THREE.AlwaysStencilFunc,stencilZPass:THREE.ReplaceStencilOp}));aperture.renderOrder=1;group.add(aperture);
 const mouthMask={depthTest:false,depthWrite:false,stencilWrite:true,stencilRef:1,stencilFunc:THREE.EqualStencilFunc};
 Object.assign(cavity.material,mouthMask);cavity.renderOrder=2;
 // Original-identity oral texture projected onto separate curved upper/lower arches.
 const dental=await fetch('/face-lab/dental-reference.json').then(r=>r.json());
 const dentalTexture=await new THREE.TextureLoader().loadAsync(dental.source);dentalTexture.colorSpace=THREE.SRGBColorSpace;
 const dp:number[][]=dental.points,topIds=[78,191,80,81,82,13,312,311,310,415,308],bottomIds=[78,95,88,178,87,14,317,402,318,324,308];
 function curve(ids:number[],x:number){const points=ids.map(i=>dp[i]).sort((a,b)=>a[0]-b[0]);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(x<=b[0])return a[1]+(b[1]-a[1])*Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));}return points.at(-1)![1];}
 const angle=Math.atan2(left[1]-right[1],right[0]-left[0]);upperTeeth.rotation.z=angle;lowerTeeth.rotation.z=angle;
 function dentalArch(bottom:boolean){
  const positions:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let i=0;i<=32;i++){
   const u=i/32,sx=dp[78][0]+(dp[308][0]-dp[78][0])*u,top=curve(topIds,sx),baseY=curve(bottomIds,sx);
   for(let j=0;j<2;j++){
    const v=bottom?(j===0?.60:.93):(j===0?.06:.55);
    positions.push((u-.5)*mouthWidth*.91,bottom?(-3-j*5):(2-j*9),-Math.pow((u-.5)*2,2)*7);
    uvs.push(sx/dental.width,1-(top+(baseY-top)*v)/dental.height);
   }
   if(i<32){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
  const arch=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:dentalTexture,side:THREE.DoubleSide,...mouthMask}));arch.renderOrder=3;return arch;
 }
 upperTeeth.add(dentalArch(false));lowerTeeth.add(dentalArch(true));
 const lowerInner=new Set([146,91,181,84,17,314,405,321,375,140,171,175,148,176,149,150,136,172,58,132,152,14,87,178,88,95,317,402,318,324]);
 const cheekY=(left[1]+right[1])/2;const chinY=p[152][1];
 function deform(amount:number,smile:number){
  const drop=amount*mouthWidth*.20;
  for(let i=0;i<p.length;i++){
   const q=p[i],vertical=Math.max(0,Math.min(1,(q[1]-cheekY)/Math.max(1,chinY-cheekY)));
   const nearMouth=Math.exp(-Math.pow((q[0]-(mx+w/2))/(mouthWidth*.75),2));
   const weight=lowerInner.has(i)?Math.max(.7,vertical):vertical*.8;
   const corner=Math.exp(-Math.pow((q[1]-cheekY)/(mouthWidth*.22),2))*Math.min(1,Math.abs(q[0]-(mx+w/2))/(mouthWidth*.5));
   position[i*3]=base[i*3]+(q[0]-(mx+w/2))*smile*.025*corner;position[i*3+1]=base[i*3+1]-drop*weight+smile*mouthWidth*.032*corner;position[i*3+2]=base[i*3+2]-amount*weight*2;
   // Modest lip rounding independent of jaw; never stretch the teeth to mimic a lip.
   if(Math.abs(q[1]-cheekY)<mouthWidth*.23)position[i*3]-=(q[0]-(mx+w/2))*amount*.035*nearMouth;
  }
  upperTeeth.position.y=my-smile*1.5;lowerTeeth.position.y=my-drop*.92;lowerTeeth.rotation.x=amount*.14;geo.attributes.position.needsUpdate=true;
  apertureIndices.forEach((i,j)=>{aperturePositions[j*3]=position[i*3];aperturePositions[j*3+1]=position[i*3+1];aperturePositions[j*3+2]=position[i*3+2]});apertureGeo.attributes.position.needsUpdate=true;
 }
 function resize(){const width=stage.clientWidth,height=stage.clientHeight;renderer.setSize(width,height);const v=880;camera.left=-v*width/height/2;camera.right=v*width/height/2;camera.top=420;camera.bottom=420-v;camera.updateProjectionMatrix();}
 new ResizeObserver(resize).observe(stage);resize();
 document.querySelector<HTMLButtonElement>('#play')!.onclick=async()=>{
  try{smileUntil=0;ac??=new AudioContext();if(!analyser){analyser=ac.createAnalyser();analyser.fftSize=1024;ac.createMediaElementSource(audio).connect(analyser);analyser.connect(ac.destination);}await ac.resume();audio.currentTime=0;await audio.play();running=true;listen=false;start=performance.now();status.textContent='轻声说话';phase.textContent='说话';}catch(e){document.querySelector('#error')!.textContent=String(e);}
 };
 document.querySelector<HTMLButtonElement>('#listen')!.onclick=()=>{smileUntil=0;listen=true;running=false;slider.value='0';audio.pause();status.textContent='自然收口，进入聆听';phase.textContent='聆听';};
 document.querySelector<HTMLButtonElement>('#smile')!.onclick=()=>{audio.pause();running=false;listen=false;slider.value='0';smileUntil=performance.now()+2400;phase.textContent='微笑';status.textContent='笑时露齿';};
 slider.oninput=()=>{smileUntil=0;running=false;audio.pause();listen=false;phase.textContent='手动';};
 document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(hidden)audio.pause();});
 const samples=new Float32Array(1024);
 function tick(now:number){requestAnimationFrame(tick);if(hidden||now-previous<1000/30)return;const dt=Math.min(.08,(now-previous)/1000);previous=now;
  let target=Number(slider.value);
  if(running){let rms=0;if(analyser&&!audio.paused){analyser.getFloatTimeDomainData(samples);rms=Math.sqrt(samples.reduce((s,v)=>s+v*v,0)/samples.length);}target=listen?0:Math.min(.14,Math.pow(Math.max(0,rms-.003)*2.2,.9)*.45);if(now-start>20000){running=false;audio.pause();target=0;slider.value='0';status.textContent='小样结束';phase.textContent='待机';}}
  const smiling=now<smileUntil;smileStrength+=((smiling?1:0)-smileStrength)*(1-Math.exp(-dt*10));
  const showTeeth=!running&&!listen&&smileStrength>.10;upperTeeth.visible=showTeeth;lowerTeeth.visible=false;
  if(smileStrength>.01&&!running&&!listen)target=.46*smileStrength;
  if(!smiling&&smileStrength<.01&&phase.textContent==='微笑'){phase.textContent='待机';status.textContent='准备好了';}
  level+=(target-level)*(1-Math.exp(-dt*18));openness+=(level-openness)*(1-Math.exp(-dt*22));deform(Math.min(running?.14:.5,openness),running?0:smileStrength);
  group.position.y=Math.sin(now*.0012)*.6;renderer.render(scene,camera);document.querySelector('#jawRead')!.textContent=(openness*8).toFixed(1)+'°';
 }
 document.querySelector<HTMLButtonElement>('#stageSmile')!.onclick=()=>document.querySelector<HTMLButtonElement>('#smile')!.click();
 document.querySelector<HTMLButtonElement>('#stagePlay')!.onclick=()=>document.querySelector<HTMLButtonElement>('#play')!.click();
 document.querySelector<HTMLButtonElement>('#stageListen')!.onclick=()=>document.querySelector<HTMLButtonElement>('#listen')!.click();
 document.querySelectorAll<HTMLInputElement|HTMLButtonElement>('button,input').forEach(el=>el.disabled=false);status.textContent='准备好了';phase.textContent='待机';requestAnimationFrame(tick);
}
setup().catch(e=>document.querySelector('#error')!.textContent=String(e));
