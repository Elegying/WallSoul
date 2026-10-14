"""Read-only motion endpoint audit. Metrics identify review targets, not perceptual acceptance."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'resources/characters/soul'
OUT = ROOT / 'artifacts'
cv2.setNumThreads(2)


def load(name):
    return np.asarray(Image.open(FOLDER / name).convert('RGBA'))


def composite(rgba):
    alpha = rgba[:, :, 3:4].astype(np.float32) / 255
    return np.uint8(rgba[:, :, :3] * alpha + np.array([12, 16, 36]) * (1 - alpha))


def sharpness(rgb):
    # Fixed face and hair ROI covers the shared original framing.
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    return round(float(cv2.Laplacian(gray[85:335, 135:420], cv2.CV_32F).var()), 4)


def sheet(rows, output, crop=(120, 60, 445, 390), size=(228, 232)):
    canvas = Image.new('RGB', (size[0] * max(len(row[1]) for row in rows), (size[1] + 37) * len(rows)), '#0c1024')
    draw = ImageDraw.Draw(canvas)
    for y, (label, frames) in enumerate(rows):
        for x, (index, name) in enumerate(frames):
            img = Image.fromarray(composite(load(name))).crop(crop).resize(size)
            top = y * (size[1] + 37)
            canvas.paste(img, (x * size[0], top))
            draw.text((x * size[0] + 4, top + size[1] + 3), f'{label} frame {index}', fill='white')
    canvas.save(OUT / output, quality=92)


def main(prefix):
    manifest_bytes = (FOLDER / 'manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    body = manifest['portrait']['body']
    report = {'assetVersion': manifest['assetVersion'], 'manifestSha256': hashlib.sha256(manifest_bytes).hexdigest(), 'startedAtUTC': datetime.now(timezone.utc).isoformat(), 'note': 'Pixels are measured at source resolution; optical flow is sampled at half scale then rescaled. Fixed face ROI is a review aid, not a perceptual score. Edge checks exclude the bottom 85 pixels of the intentional half-body composition.', 'clips': []}
    rows = []
    for clip in body['clips']:
        names = body['frameFiles'][clip['start']:clip['start'] + clip['frames']]
        metrics, edges = [], []
        prev = None
        for i, name in enumerate(names):
            frame = load(name)
            rgb = composite(frame)
            mask = frame[:, :, 3] > 200
            yy, xx = np.nonzero(mask)
            opaque = frame[:, :, 3] > 220
            metric = {'index': i, 'file': name, 'sharpness': sharpness(rgb), 'alphaCenter': [round(float(xx.mean()), 3), round(float(yy.mean()), 3)], 'bbox': [int(xx.min()), int(yy.min()), int(xx.max()), int(yy.max())], 'opaqueEdgePixels': {'left': int(opaque[:-85, :2].sum()), 'right': int(opaque[:-85, -2:].sum()), 'top': int(opaque[:2].sum())}}
            metrics.append(metric)
            if prev is not None and (i < 21 or i >= len(names) - 20):
                a = cv2.resize(cv2.cvtColor(prev, cv2.COLOR_RGB2GRAY), (280, 416))
                b = cv2.resize(cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY), (280, 416))
                flow = cv2.calcOpticalFlowFarneback(a, b, None, .5, 3, 21, 3, 5, 1.2, 0)
                magnitude = np.linalg.norm(flow[45:190, 65:225], axis=2) * 2
                edges.append({'toFrame': i, 'faceFlowMeanPx': round(float(magnitude.mean()), 4), 'faceFlowP95Px': round(float(np.percentile(magnitude, 95)), 4), 'faceMeanAbsDelta': round(float(np.abs(rgb[85:335, 135:420].astype(float) - prev[85:335, 135:420]).mean()), 4), 'sharpnessRatio': round(metric['sharpness'] / max(metrics[-2]['sharpness'], .01), 4)})
            prev = rgb
        anchor = metrics[0]['sharpness']
        center = metrics[len(metrics)//5:max(len(metrics)//5+1, len(metrics)*4//5)]
        entry = {'id': clip['id'], 'label': clip['label'], 'playback': clip.get('playback', clip.get('kind')), 'frames': metrics, 'boundaryEdges': edges, 'worstFaceDelta': max(edges, key=lambda e: e['faceMeanAbsDelta']), 'worstFlow': max(edges, key=lambda e: e['faceFlowMeanPx']), 'bodySharpnessMedian': round(float(np.median([m['sharpness'] for m in center])), 4), 'anchorSharpness': anchor}
        report['clips'].append(entry)
        if clip.get('playback') in ['listening', 'idle']:
            indices = [round((len(names)-1)*p) for p in [0, .07, .21, .36, .5, .64, .79, .93, 1]]
            rows.append((clip['id'], [(i, names[i]) for i in indices]))
        print(clip['id'], 'worst', entry['worstFaceDelta'], 'anchor/body sharpness', anchor, entry['bodySharpnessMedian'], flush=True)
    report['manifestUnchangedDuringAudit'] = manifest_bytes == (FOLDER / 'manifest.json').read_bytes()
    report['finishedAtUTC'] = datetime.now(timezone.utc).isoformat()
    assert report['manifestUnchangedDuringAudit'], 'Manifest changed during audit; rerun against stable live references.'
    (OUT / f'{prefix}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    sheet(rows, f'{prefix}-listening-rest.jpg')
    worst = sorted(report['clips'], key=lambda c: c['worstFaceDelta']['faceMeanAbsDelta'], reverse=True)[:6]
    rows = []
    for c in worst:
        i = c['worstFaceDelta']['toFrame']
        indices = sorted({0, max(0, i-2), max(0, i-1), i, min(len(c['frames'])-1, i+1), len(c['frames'])//2, len(c['frames'])-1})
        rows.append((c['id'], [(j, c['frames'][j]['file']) for j in indices]))
    sheet(rows, f'{prefix}-worst-boundaries.jpg')
    assert len(report['clips']) == len(body['clips'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prefix', default='quality-motion-audit')
    main(parser.parse_args().prefix)
