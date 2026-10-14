"""Offline endpoint alignment. Runtime still plays one complete, unmodified frame at a time."""
import json,hashlib
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1];folder=root/'resources/characters/soul'

def interpolate(a,b,steps):
 # Align both images before mixing premultiplied RGBA; transparent colour must not bleed.
 aa=a.astype(np.float32)/255;bb=b.astype(np.float32)/255
 aa[:,:,:3]*=aa[:,:,3:];bb[:,:,:3]*=bb[:,:,3:]
 ga=cv2.cvtColor(np.uint8(aa[:,:,:3]*255),cv2.COLOR_RGB2GRAY)
 gb=cv2.cvtColor(np.uint8(bb[:,:,:3]*255),cv2.COLOR_RGB2GRAY)
 ab=cv2.calcOpticalFlowFarneback(ga,gb,None,.5,5,41,7,7,1.5,0)
 ba=cv2.calcOpticalFlowFarneback(gb,ga,None,.5,5,41,7,7,1.5,0)
 y,x=np.mgrid[:a.shape[0],:a.shape[1]].astype(np.float32)
 result=[]
 for t in steps:
  if t==0:result.append(a.copy());continue
  if t==1:result.append(b.copy());continue
  wa=cv2.remap(aa,x+ba[:,:,0]*t,y+ba[:,:,1]*t,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
  wb=cv2.remap(bb,x+ab[:,:,0]*(1-t),y+ab[:,:,1]*(1-t),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
  frame=wa*(1-t)+wb*t;frame[:,:,:3]/=np.maximum(frame[:,:,3:],1/255)
  result.append(np.uint8(np.rint(np.clip(frame,0,1)*255)))
 return result

def main():
 m=json.loads((folder/'manifest.json').read_text());body=m['portrait']['body'];clips=body['clips'];assert len(clips)>=2
 anchor=np.array(Image.open(folder/body['frameFiles'][next(c for c in clips if c.get('playback')=='speaking')['start']]).convert('RGBA'));k=8;report=[]
 for c in clips:
  names=body['frameFiles'][c['start']:c['start']+c['frames']]
  if any('loop-' in n for n in names):
   report.append(dict(id=c['id'],firstSha256=hashlib.sha256((folder/names[0]).read_bytes()).hexdigest(),lastSha256=hashlib.sha256((folder/names[-1]).read_bytes()).hexdigest()));continue
  first=np.array(Image.open(folder/names[k]).convert('RGBA'));last=np.array(Image.open(folder/names[-1-k]).convert('RGBA'))
  t=np.linspace(0,1,k+1);intro=interpolate(anchor,first,t*t*(2-t));outro=interpolate(last,anchor,t+t*t-t*t*t)
  for i,frame in list(enumerate(intro))+[(len(names)-1-k+i,f) for i,f in enumerate(outro)]:
   name=f"{c['id']}-loop-{i:03}.png";Image.fromarray(frame).save(folder/name);body['frameFiles'][c['start']+i]=name
  report.append(dict(id=c['id'],firstSha256=hashlib.sha256((folder/body['frameFiles'][c['start']]).read_bytes()).hexdigest(),lastSha256=hashlib.sha256((folder/body['frameFiles'][c['start']+c['frames']-1]).read_bytes()).hexdigest()))
 assert len({r[key] for r in report for key in ['firstSha256','lastSha256']})==1
 m['assetVersion']='1.7.4';temp=folder/'manifest.next.json';temp.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');temp.replace(folder/'manifest.json')
 (root/'artifacts/speech-loop-boundaries.json').write_text(json.dumps(dict(transitionFrames=k,method='offline bidirectional flow; common RGBA endpoint; eased entry and exit',clips=report),indent=2))
 print(f'All {len(clips)**2} end/start pairs share an identical frame. Visual motion review still required.')
if __name__=='__main__':main()
