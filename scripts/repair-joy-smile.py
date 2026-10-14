"""Use the reviewed intact smile before the source hand leaves the frame; preserve originals."""
import json, shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'resources/characters/soul'
p=root/'manifest.json';m=json.loads(p.read_text());b=m['portrait']['body'];c=next(c for c in b['clips'] if c['id']=='joy')
# Reuse existing first 29 frames, including the common entry anchor.
source=b['frameFiles'][c['start']:c['start']+29]
images=[(root/name).read_bytes() for name in source]
sequence=images+images[-2::-1];names=[]
for i,data in enumerate(sequence):
 name=f'joy-smile-safe-{i:03}.png';(root/name).write_bytes(data);names.append(name)
old=c['frames'];b['frameFiles'][c['start']:c['start']+old]=names
for other in b['clips']:
 if other['start']>c['start']:other['start']+=len(names)-old
c.update(frames=len(names),duration=3.5);b['frames']=len(b['frameFiles'])
p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
