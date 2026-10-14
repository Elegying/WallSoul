"""Pack only explicitly reviewed speech videos, preserving native resolution and other assets."""
import argparse, hashlib, json, os
from pathlib import Path
os.environ.setdefault('NUMBA_NUM_THREADS','2')
import cv2
import numpy as np
from PIL import Image
from portrait_matting import matte
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('review',type=Path);args=p.parse_args()
review=json.loads(args.review.read_text());folder=root/'resources/characters/soul'
assert hashlib.sha256((folder/'neutral.png').read_bytes()).hexdigest()==review['referenceSha256']
assert len(review['clips'])>=1
manifest=json.loads((folder/'manifest.json').read_text());body=manifest['portrait']['body']
existing={c['id'] for c in body['clips']}
review['clips']=[c for c in review['clips'] if c['id'] not in existing]
assert len(body['clips'])+len(review['clips'])<=24
assert len(body['frameFiles'])+113*len(review['clips'])<=3072
# Validate every input before writing frames or changing the manifest.
for entry in review['clips']:
 source=root/entry['source'];assert hashlib.sha256(source.read_bytes()).hexdigest()==entry['sha256']
 cap=cv2.VideoCapture(str(source));assert (int(cap.get(3)),int(cap.get(4)),int(cap.get(7)))==(560,832,113);cap.release()
for entry in review['clips']:
 cap=cv2.VideoCapture(str(root/entry['source']));fps=cap.get(cv2.CAP_PROP_FPS);names=[]
 while True:
  ok,f=cap.read()
  if not ok:break
  rgb,alpha=matte(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));name=f"{entry['id']}-{len(names):03}.png"
  Image.fromarray(np.rint(np.concatenate([rgb,alpha*255],2)).astype('uint8')).save(folder/name);names.append(name)
  if len(names)%25==0:print(entry['id'],len(names),flush=True)
 cap.release();assert len(names)==113
 body['clips'].append(dict(id=entry['id'],label=entry['label'],start=len(body['frameFiles']),frames=len(names),duration=(len(names)-1)/fps,playback=entry.get('playback','speaking')))
 body['frameFiles'].extend(names)
body['frames']=len(body['frameFiles']);assert body['frames']<=2448
manifest['portrait']['videoSpeech']=True;manifest['assetVersion']='1.7.0'
temp=folder/'manifest.next.json';temp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');temp.replace(folder/'manifest.json')
print('Reviewed speech video set installed.',flush=True)
