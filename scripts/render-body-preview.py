"""Preview the exact shipped matte frames without changing source footage."""
import argparse, json, pathlib, subprocess
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]
folder=root/'resources/characters/soul'
a=json.loads((folder/'manifest.json').read_text())['portrait']['body']
sheets=[] if a.get('frameFiles') else [Image.open(folder/name).convert('RGBA') for name in a['sheets']]
parser=argparse.ArgumentParser();parser.add_argument('clip',nargs='?',default='wave');chosen=parser.parse_args().clip
clip=next(c for c in a['clips'] if c['id']==chosen)
out=root/f'artifacts/WallSoul-{chosen}-preview.mp4'
p=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pixel_format','rgb24','-video_size','560x832','-framerate',str((clip['frames']-1)/clip['duration']),'-i','-','-an','-vf','fps=30','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
for n in range(clip['start'],clip['start']+clip['frames']):
 slot=n%(a['columns']*a['rows']);x=slot%a['columns']*a['width'];y=slot//a['columns']*a['height']
 frame=Image.open(folder/a['frameFiles'][n]).convert('RGBA') if a.get('frameFiles') else sheets[n//(a['columns']*a['rows'])].crop((x,y,x+a['width'],y+a['height']))
 canvas=Image.new('RGBA',frame.size,(7,9,27,255));canvas.alpha_composite(frame)
 p.stdin.write(canvas.convert('RGB').resize((560,832),Image.Resampling.LANCZOS).tobytes())
p.stdin.close()
if p.wait():raise RuntimeError('Preview encoding failed')
print(out)
