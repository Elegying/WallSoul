"""Keep actual video entrances; correct only the small outgoing pose residual.
No dual-frame optical-flow morph across the face. Originals remain untouched.
"""
import argparse,json
from pathlib import Path
import cv2,numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1];folder=root/'resources/characters/soul'
def raw_names(clip):
 prefix='wave-full-arm' if clip['id']=='wave' else 'pro-'+clip['id'] if clip.get('playback') is None else clip['id']
 return [f'{prefix}-{i:03}.png' for i in range(113)]
def rgba(name):return np.array(Image.open(folder/name).convert('RGBA'))
def premul(a):
 a=a.astype(np.float32)/255;a[:,:,:3]*=a[:,:,3:];return a

def corrected_exit(images,anchor):
 a=premul(anchor);gray=lambda f:cv2.cvtColor(np.uint8(np.clip(f[:,:,:3],0,1)*255),cv2.COLOR_RGB2GRAY);reference=gray(a)
 y,x=np.mgrid[:anchor.shape[0],:anchor.shape[1]].astype(np.float32)
 result=[]
 for i,im in enumerate(images):
  if i==0:result.append(im.copy());continue
  if i==len(images)-1:result.append(anchor.copy());continue
  source=premul(im)
  # The tail is still moving. Register each source frame in the anchor's
  # coordinates; reusing the last frame's flow leaves a jump before the dissolve.
  flow=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM).calc(reference,gray(source),None)
  # Bound residual registration, preserving real motion outside this small correction.
  norm=np.linalg.norm(flow,axis=2);flow*=np.minimum(1,12/np.maximum(norm,1e-4))[:,:,None]
  t=i/(len(images)-1);gain=t*t*(3-2*t)
  f=cv2.remap(source,x+flow[:,:,0]*gain,y+flow[:,:,1]*gain,cv2.INTER_CUBIC,borderMode=cv2.BORDER_CONSTANT)
  # Four already aligned frames avoid the two-frame detail snap without
  # reintroducing the extended blur found with six- or eight-frame dissolves.
  dissolve=min(4,len(images)-1);mix=max(0,(i-(len(images)-1-dissolve))/dissolve);mix=mix*mix*(3-2*mix)
  f=f*(1-mix)+a*mix;f[:,:,:3]/=np.maximum(f[:,:,3:],1/255)
  result.append(np.uint8(np.rint(np.clip(f,0,1)*255)))
 result[-1]=anchor.copy();return result

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
 p=folder/'manifest.json';m=json.loads(p.read_text());body=m['portrait']['body'];anchor=rgba(m['layers'][0]['src']);candidates=[]
 for c in body['clips']:
  if c['id'] in ['joy','anger','resting-natural'] or c.get('playback')=='listening':continue
  names=raw_names(c);assert all((folder/n).is_file() for n in names)
  suffix=corrected_exit([rgba(n) for n in names[-17:]],anchor)
  if args.apply:
   entry=f"native-{c['id']}-000.png";Image.fromarray(anchor).save(folder/entry);names[0]=entry
   for j,frame in enumerate(suffix):
    idx=96+j;name=f"native-{c['id']}-{idx:03}.png";Image.fromarray(frame).save(folder/name);names[idx]=name
   assert c['frames']==113;body['frameFiles'][c['start']:c['start']+113]=names
  if c['id']=='hair-tuck':
   out=Image.new('RGB',(280*6,416*2),(12,15,40))
   for j,idx in enumerate([0,4,8,104,108,112]):
    old=rgba(body['frameFiles'][c['start']+idx]) if not args.apply else rgba(f'hair-tuck-loop-{idx:03}.png')
    new=anchor if idx==0 else rgba(names[idx]) if idx<96 else suffix[idx-96]
    for row,img in enumerate([old,new]):
     im=Image.fromarray(img).resize((280,416));out.paste(im,(j*280,row*416),im.getchannel('A'))
   out.save(root/'artifacts/quality-native-boundary-candidate.jpg')
 if args.apply:m['assetVersion']='1.8.0';p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':main()
