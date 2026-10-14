"""Preserve reviewed source pixels; export independent frames for bounded runtime decoding."""
import json,pathlib,sys,tempfile,shutil
import cv2,numpy as np
from PIL import Image
from portrait_matting import matte
root=pathlib.Path(__file__).resolve().parents[1]
folder=root/'resources/characters/soul'
manifest=json.loads((folder/'manifest.json').read_text());body=manifest['portrait']['body']
files={'hair-tuck':root/'assets-source/body-motion-experiment/wan/hair-tuck-sample.mp4','wave':root/'assets-source/body-motion-experiment/wave/sample.mp4'}
names=[];dimensions=None
with tempfile.TemporaryDirectory(prefix='wallsoul-native-frames-') as tmp:
 for clip in body['clips']:
  cap=cv2.VideoCapture(str(files[clip['id']]))
  count=0
  while True:
   ok,frame=cap.read()
   if not ok:break
   h,w=frame.shape[:2]
   if dimensions and dimensions!=(w,h):raise ValueError('Mixed source dimensions')
   dimensions=(w,h)
   if max(w,h)>1024:raise ValueError('Source exceeds frame budget')
   rgb,alpha=matte(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB))
   name=f'body-frame-{len(names):03}.png'
   Image.fromarray(np.rint(np.concatenate([rgb,alpha*255],2)).astype('uint8')).save(pathlib.Path(tmp)/name)
   names.append(name);count+=1
   if count%10==0:print(clip['id'],count,flush=True)
  cap.release()
  if count!=clip['frames']:raise ValueError('Source frame count changed')
 if len(names)!=body['frames']:raise ValueError('Frame count mismatch')
 for name in names:shutil.copy2(pathlib.Path(tmp)/name,folder/name)
 body.update(frameFiles=names,frameWidth=dimensions[0],frameHeight=dimensions[1])
 manifest['assetVersion']='1.4.1'
 (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print('Preserved',len(names),'frames at',dimensions,flush=True)
