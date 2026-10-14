"""Read-only mouth-opening inspection of the referenced speaking clips, not phoneme alignment."""
import hashlib, json
from pathlib import Path
import cv2, mediapipe as mp, numpy as np
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
folder = root / 'resources/characters/soul'
manifest = folder / 'manifest.json'
digest = hashlib.sha256(manifest.read_bytes()).hexdigest()
m = json.loads(manifest.read_text())
b = m['portrait']['body']
result = []
sheet = Image.new('RGB', (560 * 5, 832), '#0b102d')
for column, clip in enumerate(c for c in b['clips'] if c.get('playback') == 'speaking'):
    rows, missing, biggest = [], [], (-1, None)
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, refine_landmarks=True) as detector:
        for i, name in enumerate(b['frameFiles'][clip['start']:clip['start'] + clip['frames']]):
            rgba = np.array(Image.open(folder / name).convert('RGBA'))
            alpha = rgba[:, :, 3:] / 255
            rgb = np.uint8(rgba[:, :, :3] * alpha + np.array([11, 16, 45]) * (1 - alpha))
            face = detector.process(rgb)
            if not face.multi_face_landmarks:
                missing.append(i)
                continue
            xy = np.array([[p.x * rgb.shape[1], p.y * rgb.shape[0]] for p in face.multi_face_landmarks[0].landmark])
            gap = float(np.linalg.norm(xy[13] - xy[14]) / np.linalg.norm(xy[61] - xy[291]))
            rows.append({'frame': i, 'mouthGap': gap})
            if gap > biggest[0]:
                biggest = gap, rgb.copy()
    values = [r['mouthGap'] for r in rows]
    entry = {'id': clip['id'], 'frames': clip['frames'], 'missing': missing, 'maxMouthGap': max(values), 'p95MouthGap': float(np.percentile(values, 95)), 'rows': rows}
    result.append(entry)
    sheet.paste(Image.fromarray(biggest[1]), (column * 560, 0))
    ImageDraw.Draw(sheet).text((column * 560 + 12, 12), clip['id'], fill='white')
    print({k: v for k, v in entry.items() if k != 'rows'}, flush=True)
assert hashlib.sha256(manifest.read_bytes()).hexdigest() == digest
(root / 'artifacts/speaking-frames-0.5.1.json').write_text(json.dumps({'manifestSha256': digest, 'note': 'Landmark-derived opening ratio. No phoneme or identity accuracy score.', 'clips': result}, indent=2) + '\n')
sheet.save(root / 'artifacts/speaking-maximums-0.5.1.jpg')
