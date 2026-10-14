"""Install the reviewed full-arm wave without reprocessing unrelated motion assets."""
import pathlib,json,hashlib,os
os.environ.setdefault('NUMBA_NUM_THREADS','2')
import cv2,numpy as np
from PIL import Image
from portrait_matting import matte
root=pathlib.Path(__file__).resolve().parents[1];folder=root/'resources/characters/soul'
source=root/'assets-source/body-motion-experiment/wave-pro-v1/sample.mp4'
review_path=root/'assets-source/body-motion-experiment/reviewed-set.json';review=json.loads(review_path.read_text())
assert hashlib.sha256((folder/'neutral.png').read_bytes()).hexdigest()==review['referenceSha256']
m=json.loads((folder/'manifest.json').read_text());b=m['portrait']['body'];clip=next(c for c in b['clips'] if c['id']=='wave');old_count=clip['frames'];start=clip['start']
cap=cv2.VideoCapture(str(source));fps=cap.get(cv2.CAP_PROP_FPS);names=[]
while True:
 ok,f=cap.read()
 if not ok:break
 assert f.shape[:2]==(832,560)
 rgb,alpha=matte(cv2.cvtColor(f,cv2.COLOR_BGR2RGB));name=f'wave-full-arm-{len(names):03}.png'
 Image.fromarray(np.rint(np.concatenate([rgb,alpha*255],2)).astype('uint8')).save(folder/name);names.append(name)
 if len(names)%25==0:print('wave',len(names),flush=True)
assert len(names)==113
b['frameFiles'][start:start+old_count]=names;clip.update(frames=len(names),duration=(len(names)-1)/fps)
for c in b['clips']:
 if c['start']>start:c['start']+=len(names)-old_count
b['frames']=len(b['frameFiles']);m['assetVersion']='1.6.2'
(folder/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
e=next(c for c in review['clips'] if c['id']=='wave');e.update(source=str(source.relative_to(root)),sha256=hashlib.sha256(source.read_bytes()).hexdigest(),frames=len(names),reviewMethod='检查七个全身关键帧，抬起的手掌、前臂和手肘均在画面内；保留原参考形象。非全帧身份认证。')
review_path.write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n')
print('Installed full-arm wave',flush=True)
