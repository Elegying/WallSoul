"""Pack visually reviewed local body clips; no network or inference at runtime."""
import argparse,json,pathlib,shutil,tempfile
import cv2
import numpy as np
from PIL import Image
from portrait_matting import matte
root=pathlib.Path(__file__).resolve().parents[1]
folder=root/'resources/characters/soul'
experiment=root/'assets-source/body-motion-experiment'
entries=[('hair-tuck','整理头发',experiment/'wan/hair-tuck-sample.mp4',['neutral','happy','curious']),
 ('wave','轻轻挥手',experiment/'wave/sample.mp4',['happy']),
 ('warm-smile','舒展微笑',experiment/'warm-smile/sample.mp4',['neutral','happy']),
 ('attentive','认真倾听',experiment/'attentive/sample.mp4',['attentive','curious','thoughtful','concerned'])]
parser=argparse.ArgumentParser()
parser.add_argument('--include',nargs='+',choices=['wave','warm-smile','attentive'],default=['wave'])
include=parser.parse_args().include
entries=[entry for entry in entries if entry[0]=='hair-tuck' or entry[0] in include]
# Every expected clip must have passed visual review before this script is run.
for _,_,file,_ in entries:
 if not file.is_file():raise SystemExit('Missing reviewed clip: '+str(file))
sheets=[];clips=[];count=0
with tempfile.TemporaryDirectory(prefix='wallsoul-body-pack-') as tmp:
 for id,label,file,emotions in entries:
  capture=cv2.VideoCapture(str(file));fps=capture.get(cv2.CAP_PROP_FPS);frames=[]
  while True:
   ok,frame=capture.read()
   if not ok:break
   frames.append(frame)
  capture.release()
  if not 2<=len(frames)<=160 or not 1<=fps<=60:raise ValueError('Invalid clip duration')
  # Retain every source frame: sparse crossfades create doubled fingers during a wave.
  selected=list(range(len(frames)))
  if selected[-1]!=len(frames)-1:selected.append(len(frames)-1)
  start=count
  for i in selected:
   if count%32==0:sheets.append(Image.new('RGBA',(384*8,576*4)))
   rgb=cv2.cvtColor(cv2.resize(frames[i],(384,576),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2RGB)
   rgb,alpha=matte(rgb)
   tile=Image.fromarray(np.rint(np.concatenate([rgb,alpha*255],2)).astype('uint8'))
   slot=count%32;sheets[-1].paste(tile,((slot%8)*384,(slot//8)*576));count+=1
  clips.append(dict(id=id,label=label,start=start,frames=count-start,duration=(len(frames)-1)/fps,emotions=emotions))
  print('Prepared '+id,flush=True)
 if len(sheets)>4:raise ValueError('Decode memory budget exceeded')
 names=[]
 for index,sheet in enumerate(sheets):
  name=f'body-activity-{index}.png';sheet.save(pathlib.Path(tmp)/name,optimize=True);names.append(name)
 for name in names:shutil.copy2(pathlib.Path(tmp)/name,folder/name)
 manifest=json.loads((folder/'manifest.json').read_text())
 old=manifest['portrait']['body']['sheets']
 manifest['portrait']['body']=dict(id='body-library',label='身体活动',sheets=names,columns=8,rows=4,width=384,height=576,frames=count,duration=3.5,clips=clips)
 manifest['assetVersion']='1.4.0'
 manifest['description']='原生成形象 · 连续身体动作 · 随机表情与对话情绪'
 (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 archive=experiment/'legacy-atlas';archive.mkdir(exist_ok=True)
 for name in old:
  if name not in names and (folder/name).exists():shutil.move(str(folder/name),str(archive/name))
 print(f'Packed {len(clips)} clips, {count} frames, {len(sheets)} atlases.',flush=True)
