"""Prepare the reviewed forward-only rest. Apply only after inspecting its rendered loop."""
import argparse, importlib.util, json, os, hashlib
from pathlib import Path
os.environ.setdefault('NUMBA_NUM_THREADS', '2')
import cv2, numpy as np
from PIL import Image
from portrait_matting import matte

root = Path(__file__).resolve().parents[1]
folder = root / 'resources/characters/soul'
out = root / 'artifacts/forward-rest'
out.mkdir(exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
source = root / 'assets-source/body-motion-experiment/resting-natural-pro-v6/sample.mp4'
audit = json.loads((root / 'artifacts/rest-v6-landmarks.json').read_text())
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
assert audit['videoSha256'] == source_hash, 'Video changed since quiet-state review'
assert audit['frames'] == 113 and audit['openFrames'] == 0 and not audit['missing']
cache_record = out / 'source-sha256.txt'
if any(out.glob('raw-*.png')):
    assert cache_record.is_file() and cache_record.read_text().strip() == source_hash, 'Stale matting cache; use a fresh staging folder'
cache_record.write_text(source_hash + '\n')
manifest = folder / 'manifest.json'
m = json.loads(manifest.read_text())
b = m['portrait']['body']
anchor = np.array(Image.open(folder / m['layers'][0]['src']).convert('RGBA'))
cap = cv2.VideoCapture(str(source))
frames = []
for i in range(113):
    ok, frame = cap.read()
    assert ok and frame.shape[:2] == anchor.shape[:2]
    cache = out / f'raw-{i:03}.png'
    if not cache.exists():
        rgb, alpha = matte(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        Image.fromarray(np.rint(np.concatenate([rgb, alpha * 255], 2)).astype('uint8')).save(cache)
    frames.append(np.array(Image.open(cache).convert('RGBA')))
    print('matte', i, flush=True)
cap.release()
spec = importlib.util.spec_from_file_location('boundaries', root / 'scripts/restore-native-boundaries.py')
boundaries = importlib.util.module_from_spec(spec)
spec.loader.exec_module(boundaries)
frames[0] = anchor.copy()
frames[-17:] = boundaries.corrected_exit(frames[-17:], anchor)
names = []
for i, frame in enumerate(frames):
    name = f'rest-forward-v6-{i:03}.png'
    Image.fromarray(frame).save(out / name)
    names.append(name)
if args.apply:
    import shutil
    before = root / 'artifacts/manifest-before-forward-rest.json'
    if not before.exists():
        before.write_text(manifest.read_text())
    for name in names:
        shutil.copyfile(out / name, folder / name)
    rest = next(c for c in b['clips'] if c['id'] == 'resting-natural')
    start, old_count = rest['start'], rest['frames']
    b['frameFiles'][start:start + old_count] = names
    for clip in b['clips']:
        if clip['start'] > start:
            clip['start'] += len(names) - old_count
    rest['frames'] = len(names)
    rest['timing'] = 'native'
    b['frames'] = len(b['frameFiles'])
    m['assetVersion'] = '1.8.1'
    manifest.write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n')
print('Applied' if args.apply else 'Prepared for visual review', flush=True)
