"""Decode both endpoints through AVFoundation and preserve the alpha evidence."""
import argparse, json, subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--fps',type=int,choices=[16,32],default=32)
args = parser.parse_args()
folder = root / ('artifacts/alpha-library' if args.fps == 32 else 'artifacts/alpha-library-16')
results = []
for movie in sorted(folder.glob('*.mov')):
    row = {'clip': movie.stem}
    for label, time in [('first', '0'), ('last', str(3.5-1/args.fps))]:
        png = folder / (movie.stem + '-' + label + '.png')
        row[label] = json.loads(subprocess.check_output(['/tmp/wallsoul-inspect-alpha', str(movie), str(png), time]))
    results.append(row)
(folder / 'decoded-edges.json').write_text(json.dumps(results, indent=2) + '\n')
print('Decoded', len(results), 'clips, both endpoints')
