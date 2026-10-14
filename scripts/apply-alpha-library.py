"""Attach validated native movies to the source manifest, retaining all PNG fallbacks."""
import hashlib
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / 'resources/characters/soul'
manifest_path = folder / 'manifest.json'
original = manifest_path.read_bytes()
manifest = json.loads(original)
assert manifest['assetVersion'] == '1.8.1', 'Apply only to the reviewed source version'
source_hash = hashlib.sha256(original).hexdigest()
movies = []
for fps, field, suffix in [(32, 'video', ''), (16, 'videoLowPower', '-low')]:
    library = root / ('artifacts/alpha-library' if fps == 32 else 'artifacts/alpha-library-16')
    audit_file = library / 'decoded-edges.json'
    if not audit_file.exists() and fps == 32:
        audit_file = root / 'artifacts/alpha-library-decoded-edges.json'
    decoded = {r['clip']: r for r in json.loads(audit_file.read_text())}
    for clip in manifest['portrait']['body']['clips']:
        movie = library / (clip['id'] + '.mov')
        meta = json.loads(movie.with_suffix('.json').read_text())
        assert meta['manifestSha256'] == source_hash
        assert meta['sha256'] == hashlib.sha256(movie.read_bytes()).hexdigest()
        assert meta['fps'] == fps and meta['duration'] == clip['duration']
        for endpoint in ['first', 'last']:
            edge = decoded[clip['id']][endpoint]
            assert edge['cornerAlpha'] == 0 and edge['faceAlpha'] == 1
            assert edge['width'] == 560 and edge['height'] == 832
        target = 'native-v1-' + clip['id'] + suffix + '.mov'
        movies.append((movie, folder / target))
        clip[field] = target
backup = root / 'artifacts/manifest-before-native-video.json'
if backup.exists():
    assert backup.read_bytes() == original
else:
    backup.write_bytes(original)
for source, destination in movies:
    shutil.copyfile(source, destination)
    assert hashlib.sha256(destination.read_bytes()).digest() == hashlib.sha256(source.read_bytes()).digest()
manifest['assetVersion'] = '1.9.0'
temporary = folder / 'manifest-native-pending.json'
temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
temporary.replace(manifest_path)
print('Attached', len(movies), 'native movies; retained every source PNG')
