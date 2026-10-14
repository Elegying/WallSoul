"""Render the shipped atlas over the original body for visual review (no audio)."""
import json,pathlib,subprocess,numpy as np
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1];folder=root/'resources/characters/soul'
m=json.loads((folder/'manifest.json').read_text());a=m['portrait']['idle'];tile=a['tileSize'];x,y,w,h=a['region']
base=np.asarray(Image.open(folder/'neutral.png').convert('RGBA')).copy()
rgb=base[:,:,:3].astype(float);alpha=np.clip(1-(rgb[:,:,1]-np.maximum(rgb[:,:,0],rgb[:,:,2])-25)/85,0,1)
base[:,:,3]=np.rint(alpha*255);base[:,:,1]=np.where(alpha<1,np.minimum(rgb[:,:,1],np.maximum(rgb[:,:,0],rgb[:,:,2])+12),rgb[:,:,1]).astype('uint8')
base=Image.fromarray(base);sheets=[Image.open(folder/p).convert('RGBA') for p in a['sheets']]
out=root/'artifacts/WallSoul-original-motion.mp4';out.parent.mkdir(exist_ok=True)
process=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pixel_format','rgb24','-video_size','512x768','-framerate',str(a['fps']),'-i','-','-an','-vf','minterpolate=fps=30:mi_mode=blend','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
for n in range(a['frames']):
 k=n%(a['columns']*a['rows']);left=k%a['columns']*tile;top=k//a['columns']*tile
 patch=sheets[n//(a['columns']*a['rows'])].crop((left,top,left+tile,top+tile)).resize((w,h),Image.Resampling.BICUBIC)
 person=base.copy();person.paste((0,0,0,0),(x,y,x+w,y+h));person.alpha_composite(patch,(x,y))
 canvas=Image.new('RGBA',person.size,(7,9,27,255));canvas.alpha_composite(person)
 frame=canvas.convert('RGB').resize((512,768),Image.Resampling.LANCZOS)
 process.stdin.write(frame.tobytes())
process.stdin.close()
if process.wait():raise RuntimeError('Preview encoding failed')
print(out)
