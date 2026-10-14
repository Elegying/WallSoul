"""Export only hash-pinned, visually reviewed candidates at their native dimensions."""
import json, pathlib, hashlib, shutil, tempfile, os
os.environ.setdefault('NUMBA_NUM_THREADS','2')
os.environ.setdefault('OMP_NUM_THREADS','2')
import cv2, numpy as np
from PIL import Image
from portrait_matting import matte
root=pathlib.Path(__file__).resolve().parents[1]
folder=root/'resources/characters/soul'
review=json.loads((root/'assets-source/body-motion-experiment/reviewed-set.json').read_text())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
if digest(folder/'neutral.png')!=review['referenceSha256']:raise ValueError('Original character reference changed; review again before packing')
entries=review['clips']
for entry in entries:
 if entry['identityReview']!='accepted' or digest(root/entry['source'])!=entry['sha256']:raise ValueError('Unreviewed or changed candidate')
manifest=json.loads((folder/'manifest.json').read_text());body=manifest['portrait']['body']
names=[];clips=[]
# Unique names ensure the running renderer never sees a partially replaced frame set.
with tempfile.TemporaryDirectory(prefix='wallsoul-reviewed-') as tmp:
 for entry in entries:
  cap=cv2.VideoCapture(str(root/entry['source']));fps=cap.get(cv2.CAP_PROP_FPS);count=0;start=len(names)
  if (int(cap.get(3)),int(cap.get(4)))!=(560,832):raise ValueError('Native resolution mismatch')
  while True:
   ok,frame=cap.read()
   if not ok:break
   name=f"pro-{entry['id']}-{count:03}.png"
   rgb,alpha=matte(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB))
   Image.fromarray(np.rint(np.concatenate([rgb,alpha*255],2)).astype('uint8')).save(pathlib.Path(tmp)/name)
   names.append(name);count+=1
   if count%25==0:print(entry['id'],count,flush=True)
  cap.release()
  if count!=entry['frames']:raise ValueError('Frame count changed')
  clips.append(dict(id=entry['id'],label=entry['label'],start=start,frames=count,duration=(count-1)/fps,emotions=entry.get('emotions',[]),automatic=entry.get('automatic',False),kind=entry.get('kind','expression')))
 if len(names)>2048:raise ValueError('Frame count exceeds bounded library limit')
 for name in names:shutil.copy2(pathlib.Path(tmp)/name,folder/name)
 body.update(frameFiles=names,frameWidth=560,frameHeight=832,frames=len(names),clips=clips)
 manifest['assetVersion']='1.5.0'
 manifest['description']='原生成形象 · 十组表情 · 连续身体动作与声音跟随'
 staged=folder/'manifest.next.json';staged.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');staged.replace(folder/'manifest.json')
 print('Packed',len(clips),'clips /',len(names),'native frames',flush=True)
