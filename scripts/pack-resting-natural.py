"""Dedicated rest from reviewed closed-lip micro-motion, discarding generated speech."""
import os,json,importlib.util
from pathlib import Path
os.environ.setdefault('NUMBA_NUM_THREADS','2')
import cv2,numpy as np
from PIL import Image
from portrait_matting import matte
root=Path(__file__).resolve().parents[1];folder=root/'resources/characters/soul'
spec=importlib.util.spec_from_file_location('loops',root/'scripts/smooth-speech-loops.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
p=folder/'manifest.json';m=json.loads(p.read_text());b=m['portrait']['body'];assert not any(c['id']=='resting-natural' for c in b['clips'])
cap=cv2.VideoCapture(str(root/'assets-source/body-motion-experiment/resting-natural-pro-v2/sample.mp4'));frames={}
for i in range(25):
 ok,f=cap.read();assert ok
 if i<8:continue
 rgb,a=matte(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));frames[i]=np.rint(np.concatenate([rgb,a*255],2)).astype('uint8')
 print('matte',i,flush=True)
anchor=np.array(Image.open(folder/m['layers'][0]['src']).convert('RGBA'))
ease=lambda n:(lambda t:t*t*(3-2*t))(np.linspace(0,1,n))
sequence=mod.interpolate(anchor,frames[8],ease(40))+[frames[i] for i in range(9,25)]+mod.interpolate(frames[24],frames[8],ease(8))+mod.interpolate(frames[8],anchor,ease(49))
names=[]
for i,f in enumerate(sequence):
 name=f'resting-natural-loop-{i:03}.png';Image.fromarray(f).save(folder/name);names.append(name)
b['clips'].append(dict(id='resting-natural',label='自然静息',start=len(b['frameFiles']),frames=len(names),duration=3.5,playback='idle',automatic=False));b['frameFiles']+=names;b['frames']=len(b['frameFiles']);m['assetVersion']='1.7.6';p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print('Dedicated resting loop installed',flush=True)
