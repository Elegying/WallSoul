"""Remove chroma spill from all shipped frames; retain opaque hair colour and alpha."""
import os,pathlib,json
os.environ.setdefault('NUMBA_NUM_THREADS','2')
import numpy as np
from PIL import Image
from portrait_matting import matte
root=pathlib.Path(__file__).resolve().parents[1];folder=root/'resources/characters/soul'
m=json.loads((folder/'manifest.json').read_text());body=m['portrait']['body']
for n,name in enumerate(body['frameFiles']):
 p=folder/name;im=np.array(Image.open(p).convert('RGBA'));im[:,:,1]=np.minimum(im[:,:,1],((im[:,:,0].astype(float)+im[:,:,2])/2).astype('uint8'));tmp=p.with_suffix('.next.png');Image.fromarray(im).save(tmp);tmp.replace(p)
 if n%200==0:print('despill',n,flush=True)
for name in ['neutral','thinking']:
 rgb,a=matte(np.array(Image.open(folder/(name+'.png')).convert('RGB')));Image.fromarray(np.rint(np.concatenate([rgb,a*255],2)).astype('uint8')).save(folder/(name+'-clean.png'))
print('all frame edges cleaned',flush=True)
