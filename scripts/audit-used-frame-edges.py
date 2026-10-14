"""Check only referenced rendered frames; half-body bottom cropping is explicitly excluded."""
import hashlib, json
from pathlib import Path
import numpy as np
from PIL import Image
root = Path(__file__).resolve().parents[1]
folder = root / 'resources/characters/soul'
manifest = folder / 'manifest.json'
digest = hashlib.sha256(manifest.read_bytes()).hexdigest()
m = json.loads(manifest.read_text())
b = m['portrait']['body']
checks = []
for c in b['clips']:
    flags = []
    for i, name in enumerate(b['frameFiles'][c['start']:c['start'] + c['frames']]):
        rgba = np.array(Image.open(folder / name).convert('RGBA'))
        a = rgba[:, :, 3] > 224
        sides = {'top': int(a[:2].sum()), 'left': int(a[:-85, :2].sum()), 'right': int(a[:-85, -2:].sum())}
        for side, count in sides.items():
            if count > 4:
                flags.append({'frame': i, 'file': name, 'side': side, 'opaquePixels': count})
    checks.append({'id': c['id'], 'frames': c['frames'], 'flags': flags})
assert hashlib.sha256(manifest.read_bytes()).hexdigest() == digest
result = {'manifestSha256': digest, 'note': 'Two-pixel outer edge, alpha > 224; bottom 85 rows excluded for half-body framing. Does not prove finger anatomy or full-body availability.', 'clips': checks}
out = root / 'artifacts/used-frame-edges-0.5.1.json'
out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print({'frames': sum(c['frames'] for c in checks), 'flaggedFrames': sum(len(c['flags']) for c in checks)})
