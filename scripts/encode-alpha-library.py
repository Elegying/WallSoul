"""Encode reviewed complete PNG frames; never edits the manifest or source frames."""
import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def ease(progress):
    ramp = .18
    if progress < ramp:
        return progress * progress / (2 * ramp * (1 - ramp))
    if progress > 1 - ramp:
        return 1 - (1 - progress) ** 2 / (2 * ramp * (1 - ramp))
    return (progress - ramp / 2) / (1 - ramp)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--clip')
    parser.add_argument('--fps', type=int, choices=[16,32], default=32)
    args = parser.parse_args()
    source = ROOT / 'resources/characters/soul'
    manifest_bytes = (source / 'manifest.json').read_bytes()
    body = json.loads(manifest_bytes)['portrait']['body']
    output = ROOT / ('artifacts/alpha-library' if args.fps == 32 else 'artifacts/alpha-library-16')
    output.mkdir(exist_ok=True)
    clips = [c for c in body['clips'] if not args.clip or c['id'] == args.clip]
    assert clips, 'Unknown clip'
    for clip in clips:
        count = round(clip['duration'] * args.fps)
        indices = []
        for frame in range(count):
            progress = frame / (count - 1)
            if clip.get('timing') != 'native':
                progress = ease(progress)
            indices.append(clip['start'] + math.floor(progress * (clip['frames'] - 1) + .5))
        frames = [source / body['frameFiles'][index] for index in indices]
        fingerprint = hashlib.sha256()
        for frame in frames:
            fingerprint.update(frame.read_bytes())
        metadata = {
            'manifestSha256': hashlib.sha256(manifest_bytes).hexdigest(),
            'sourceSequenceSha256': fingerprint.hexdigest(),
            'frames': count, 'fps': args.fps, 'duration': count / args.fps,
            'indices': indices, 'alpha': 'premultiplied', 'bitrate': '8M' if args.fps == 32 else '4M',
        }
        movie = output / (clip['id'] + '.mov')
        audit = output / (clip['id'] + '.json')
        if movie.exists() and audit.exists():
            cached = json.loads(audit.read_text())
            if all(cached.get(k) == v for k, v in metadata.items()) and cached.get('sha256') == hashlib.sha256(movie.read_bytes()).hexdigest():
                print(clip['id'], 'verified cache', flush=True)
                continue
        temporary = output / (clip['id'] + '-encoding.mov')
        command = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'image2pipe',
                   '-framerate', str(args.fps), '-vcodec', 'png', '-i', '-',
                   '-vf', 'format=gbrap,premultiply=inplace=1,format=bgra',
                   '-c:v', 'hevc_videotoolbox', '-allow_sw', '1', '-alpha_quality', '1',
                   '-b:v', metadata['bitrate'], '-tag:v', 'hvc1', '-movflags', '+faststart', str(temporary)]
        with subprocess.Popen(command, stdin=subprocess.PIPE) as process:
            try:
                for frame in frames:
                    process.stdin.write(frame.read_bytes())
                process.stdin.close()
                if process.wait() != 0:
                    raise RuntimeError('VideoToolbox encoding failed')
            except BaseException:
                process.kill()
                raise
        probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(temporary)]))
        stream = probe['streams'][0]
        assert stream['codec_name'] == 'hevc' and int(stream['nb_frames']) == count
        assert (stream['width'], stream['height']) == (body['frameWidth'], body['frameHeight'])
        assert abs(float(probe['format']['duration']) - count / args.fps) < .001
        temporary.replace(movie)
        metadata['sha256'] = hashlib.sha256(movie.read_bytes()).hexdigest()
        metadata['bytes'] = movie.stat().st_size
        audit.write_text(json.dumps(metadata, indent=2) + '\n')
        print(clip['id'], count, metadata['bytes'], flush=True)


if __name__ == '__main__':
    main()
