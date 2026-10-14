"""Read-only A/B process sampling for the isolated native video prototype."""
import argparse, csv, datetime, json, subprocess, time
from pathlib import Path
parser = argparse.ArgumentParser()
parser.add_argument('--duration', type=float, default=300)
parser.add_argument('--output', default='video-probe-ab.csv')
args = parser.parse_args()
assert args.duration > 0
root = Path(__file__).resolve().parents[1]
cohort = json.loads((root / 'artifacts/video-probe-cohort.json').read_text())
assert len(cohort) == 4 and sum('/video-probe' in p['command'] for p in cohort) == 1
pids = ','.join(str(p['pid']) for p in cohort)
start = time.monotonic()
with (root / 'artifacts' / args.output).open('w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(['utc', 'elapsed', 'phase', 'pid', 'cpu', 'rssKiB'])
    while True:
        elapsed = time.monotonic() - start
        phase = (root / 'artifacts/video-probe-phase.txt').read_text().strip()
        rows = subprocess.check_output(['ps', '-p', pids, '-o', 'pid=,%cpu=,rss='], text=True).splitlines()
        assert len(rows) == len(cohort), 'Probe process cohort changed'
        for row in rows:
            writer.writerow([datetime.datetime.now(datetime.timezone.utc).isoformat(), round(elapsed, 3), phase, *row.split()])
        file.flush()
        if elapsed >= args.duration:
            break
        time.sleep(min(5, args.duration - elapsed))
