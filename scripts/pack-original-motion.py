"""Pack locally authored motion; preserve the original body's exact lower seam."""
import json, pathlib
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
root=pathlib.Path(__file__).resolve().parents[1]
frames=root/'assets-source/original-motion'
meta=json.loads((frames/'motion.json').read_text())
folder=root/'resources/characters/soul'
x,y,w,h=meta['crop'];tile=512;columns=8;rows=5
source=Image.open(folder/'neutral.png').convert('RGB')
base=np.asarray(source.crop((x,y,x+w,y+h)).resize((tile,tile),Image.Resampling.LANCZOS)).astype(float)
def keyed(rgb):
 alpha=np.clip(1-(rgb[:,:,1]-np.maximum(rgb[:,:,0],rgb[:,:,2])-25)/85,0,1)[:,:,None]
 rgb=rgb.copy();rgb[:,:,1]=np.where(alpha[:,:,0]<1,np.minimum(rgb[:,:,1],np.maximum(rgb[:,:,0],rgb[:,:,2])+12),rgb[:,:,1])
 return rgb,alpha
def distance(alpha):
 mask=alpha[:,:,0]>.5
 return (distance_transform_edt(mask)-distance_transform_edt(~mask))[:,:,None]
base,base_alpha=keyed(base);base_distance=distance(base_alpha)
# Smoothly restore the unchanged neckline and shoulders at the crop boundary.
factor=np.clip((np.arange(tile)/(tile-1)-.78)/.22,0,1)
factor=(factor*factor*(3-2*factor))[:,None,None]
sheets=[]
for first in range(0,meta['frames'],columns*rows):
 sheet=Image.new('RGBA',(tile*columns,tile*rows),(0,0,0,0))
 for n in range(first,min(first+columns*rows,meta['frames'])):
  frame=Image.open(frames/f'{n:04d}.png').convert('RGB')
  if frame.size!=(tile,tile):raise ValueError('Unexpected motion dimensions')
  rgb,alpha=keyed(np.asarray(frame).astype(float))
  weight=alpha*(1-factor)+base_alpha*factor
  color=(rgb*alpha*(1-factor)+base*base_alpha*factor)/np.maximum(weight,1e-6)
  # Interpolate the silhouette, avoiding two translucent neck outlines.
  silhouette=np.clip((distance(alpha)*(1-factor)+base_distance*factor)/1.5+.5,0,1)
  blend=4*factor*(1-factor)
  opacity=weight*(1-blend)+silhouette*blend
  patch=Image.fromarray(np.rint(np.concatenate([color,opacity*255],axis=2)).clip(0,255).astype('uint8'),'RGBA')
  k=n-first;sheet.paste(patch,((k%columns)*tile,(k//columns)*tile))
 name=f'idle-{len(sheets)}.png';sheet.save(folder/name,optimize=True);sheets.append(name)
manifest=json.loads((folder/'manifest.json').read_text())
manifest['assetVersion']='1.1.0'
manifest['description']='原生成形象 · 连续转头与表情'
manifest['portrait']['idle']={'sheets':sheets,'columns':columns,'rows':rows,'tileSize':tile,'frames':meta['frames'],'fps':meta['fps'],'region':meta['crop']}
(folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f"Packed {meta['frames']} frames in {len(sheets)} sheets")
