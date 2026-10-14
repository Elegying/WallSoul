"""Use reviewed closed-mouth or intact-expression portions; preserve every original frame."""
import argparse,os,json
from pathlib import Path
os.environ.setdefault('NUMBA_NUM_THREADS','2')
import cv2,numpy as np
from PIL import Image
from portrait_matting import matte
root=Path(__file__).resolve().parents[1];folder=root/'resources/characters/soul'
p=folder/'manifest.json';m=json.loads(p.read_text());b=m['portrait']['body'];anchor=(folder/m['layers'][0]['src']).read_bytes()
# Lip audit for quiet states; full-limb audit for joy and anger.
limits={'listening-soft':34,'listening-tilt':41,'listening-warm':40,'listening-nod':25,'joy':28,'anger':54,'resting-natural':24}
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--only',nargs='+',choices=list(limits));args=parser.parse_args()
if args.only:limits={k:v for k,v in limits.items() if k in args.only}
# Do not regress reviewed forward footage to the historical ping-pong repair.
for c in b['clips']:
 if c.get('timing')=='native':limits.pop(c['id'],None)
if not limits:raise SystemExit('所选片段已有原生正向素材，无需旧往返修复。')
rest=[]
if 'resting-natural' in limits:
 cap=cv2.VideoCapture(str(root/'assets-source/body-motion-experiment/resting-natural-pro-v2/sample.mp4'))
 for i in range(25):
  ok,f=cap.read();assert ok
  rgb,a=matte(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));name=f'rest-raw-{i:03}.png';Image.fromarray(np.rint(np.concatenate([rgb,a*255],2)).astype('uint8')).save(folder/name);rest.append(name)
 cap.release()
new_files=[]
for c in b['clips']:
 old=b['frameFiles'][c['start']:c['start']+c['frames']]
 if c['id'] in limits:
  count=limits[c['id']]+1
  prefix='pro-'+c['id'] if c['id'] in ['joy','anger'] else c['id']
  source=rest if c['id']=='resting-natural' else [f'{prefix}-{i:03}.png' for i in range(count)]
  sequence=source+source[-2::-1];names=[]
  for i,src in enumerate(sequence):
   name=f"quiet-{c['id']}-{i:03}.png";(folder/name).write_bytes(anchor if i in [0,len(sequence)-1] else (folder/src).read_bytes());names.append(name)
  old=names;c['frames']=len(names);c['duration']=3.5
  if c['id']=='listening-nod':c['label']='轻微回应'
 c['start']=len(new_files);new_files+=old
b['frameFiles']=new_files;b['frames']=len(new_files);p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print('Reviewed clips updated: '+', '.join(limits))
