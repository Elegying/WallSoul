"""Matte an approved body gesture offline into a bounded rectangular atlas."""
import json
import pathlib
import cv2
import numpy as np
from PIL import Image
from portrait_matting import matte

root = pathlib.Path(__file__).resolve().parents[1]
folder = root / 'resources/characters/soul'
capture = cv2.VideoCapture(str(root / 'assets-source/body-motion-experiment/wan/hair-tuck-sample.mp4'))
sheets = []
count = 0
while True:
    ok, frame = capture.read()
    if not ok:
        break
    if count % 32 == 0:
        sheets.append(Image.new('RGBA', (384 * 8, 576 * 4)))
    frame = cv2.cvtColor(cv2.resize(frame, (384, 576), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)
    rgb, alpha = matte(frame)
    tile = Image.fromarray(np.rint(np.concatenate([rgb, alpha * 255], 2)).astype('uint8'))
    slot = count % 32
    sheets[-1].paste(tile, ((slot % 8) * 384, (slot // 8) * 576))
    count += 1
capture.release()
names = []
for index, sheet in enumerate(sheets):
    name = f'body-hair-{index}.png'
    sheet.save(folder / name, optimize=True)
    names.append(name)
manifest = json.loads((folder / 'manifest.json').read_text())
manifest['portrait']['body'] = dict(id='hair-tuck', label='整理头发', sheets=names, columns=8, rows=4, width=384, height=576, frames=count, duration=(count-1)/16)
a=manifest['portrait']['body']
a['clips']=[dict(id=a['id'],label=a['label'],start=0,frames=count,duration=a['duration'],emotions=['neutral','happy','curious'])]
manifest['assetVersion'] = '1.3.0'
(folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
print(f'Packed {count} frames into {len(sheets)} sheets.', flush=True)
