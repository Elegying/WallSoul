"""Pack the same portrait, with offline hair matting and bounded expression clips."""
import json,pathlib
import numpy as np
from PIL import Image
from portrait_matting import matte
root=pathlib.Path(__file__).resolve().parents[1];folder=root/'resources/characters/soul'
original=root/'assets-source/original-motion';expressions=root/'assets-source/expression-motion'
meta=json.loads((original/'motion.json').read_text());extra=json.loads((expressions/'clips.json').read_text())
files=[original/f'{i:04d}.png' for i in range(0,80,2)]
clips=[dict(id='neutral',start=0,frames=40,duration=8)]
for clip in extra:
 clips.append(dict(id=clip['id'],start=len(files),frames=clip['frames'],duration=3.5 if clip['id']=='wink' else 5))
 files.extend(expressions/f"{clip['id']}-{i:02d}.png" for i in range(clip['frames']))
tile=512;columns=8;rows=4
x,y,w,h=meta['crop'];base=np.array(Image.open(folder/'neutral.png').convert('RGB').crop((x,y,x+w,y+h)).resize((tile,tile),Image.Resampling.LANCZOS));base,ba=matte(base)
# Keep hair intact. Restore only the last shoulder rows at the source crop boundary.
factor=np.clip((np.arange(tile)/(tile-1)-.94)/.06,0,1);factor=(factor*factor*(3-2*factor))[:,None,None]
sheets=[]
for first in range(0,len(files),columns*rows):
 sheet=Image.new('RGBA',(tile*columns,tile*rows))
 for n in range(first,min(first+columns*rows,len(files))):
  rgb,a=matte(np.array(Image.open(files[n]).convert('RGB')))
  weight=a*(1-factor)+ba*factor;color=(rgb*a*(1-factor)+base*ba*factor)/np.maximum(weight,1e-8)
  patch=Image.fromarray(np.rint(np.concatenate([color,weight*255],2)).clip(0,255).astype('uint8'))
  k=n-first;sheet.paste(patch,((k%columns)*tile,(k//columns)*tile))
 name=f'activity-{len(sheets)}.png';sheet.save(folder/name,optimize=True);sheets.append(name);print(name,flush=True)
manifest=json.loads((folder/'manifest.json').read_text());manifest['assetVersion']='1.2.0';manifest['description']='原生成形象 · 发丝柔化 · 随机表情与对话情绪'
manifest['portrait']['idle']=dict(sheets=sheets,columns=columns,rows=rows,tileSize=tile,frames=len(files),fps=5,region=meta['crop'],clips=clips)
(folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('DONE',flush=True)
