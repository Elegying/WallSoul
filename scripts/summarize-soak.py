"""Summarize an existing measurement; retain peaks and transition periods."""
import collections
import csv
import json
import pathlib
import statistics
import sys

path = pathlib.Path(sys.argv[1])
groups = collections.defaultdict(list)
with path.open() as stream:
    for row in csv.DictReader(stream):
        groups[(float(row['elapsed']), row['phase'])].append(row)
phases = collections.defaultdict(list)
for (elapsed, phase), rows in groups.items():
    phases[phase].append((elapsed, sum(float(r['cpu_percent']) for r in rows),
                          sum(int(r['rss_kib']) for r in rows) / 1024))
result = {'durationSeconds': max(t for t, _ in groups), 'samples': len(groups),
          'caveat': 'Process cohort CPU and RSS. Includes transitions. CPU 100% is one logical core. Not temperature, physical GPU or battery measurement.',
          'phases': {}}
for phase, rows in phases.items():
    cpu = [r[1] for r in rows]
    rss = [r[2] for r in rows]
    result['phases'][phase] = {'samples': len(rows), 'firstSecond': rows[0][0],
        'lastSecond': rows[-1][0], 'cpuMedianPercent': round(statistics.median(cpu), 2),
        'cpuMaxPercent': round(max(cpu), 2), 'rssMedianMiB': round(statistics.median(rss), 2),
        'rssMaxMiB': round(max(rss), 2), 'rssLastMiB': round(rows[-1][2], 2)}
output = path.with_name(path.stem + '-summary.json')
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(result, ensure_ascii=False, indent=2))
