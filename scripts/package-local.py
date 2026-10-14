"""Keep one certificate and one app path across local development builds."""
import json
import argparse
import datetime
import hashlib
import pathlib
import re
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--name', default='WallSoul-Development.app')
args = parser.parse_args()
if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]*\.app', args.name):
    raise SystemExit('候选名称必须是 artifacts 下的单个 .app 文件名。')
source = root / 'src-tauri/target/release/bundle/macos/WallSoul.app'
target = root / 'artifacts' / args.name
record = root / '.local-signing.json'
if not record.exists():
    raise SystemExit('请先运行 scripts/setup-local-signing.py 建立固定本地身份。')
identity = json.loads(record.read_text())
if not re.fullmatch(r'[0-9A-F]{40}', identity['sha1']):
    raise SystemExit('本地签名身份记录无效。')
processes = subprocess.run(['ps', '-axww', '-o', 'command='], check=True, capture_output=True, text=True).stdout
if any(line.strip().startswith(str(target / 'Contents/MacOS/wallsoul')) for line in processes.splitlines()):
    raise SystemExit('请先正常退出固定开发包，再运行打包；不会覆盖正在运行的应用。')
if not (source / 'Contents/MacOS/wallsoul').is_file():
    raise SystemExit('请先运行 npm run tauri build -- --bundles app。')
target.parent.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='.wallsoul-package-', dir=target.parent) as temporary:
    staged = pathlib.Path(temporary) / 'WallSoul-Development.app'
    subprocess.run(['ditto', str(source), str(staged)], check=True)
    provenance = {'builtAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'sourceBinarySha256': hashlib.sha256((source / 'Contents/MacOS/wallsoul').read_bytes()).hexdigest()}
    (staged / 'Contents/Resources/local-build.json').write_text(json.dumps(provenance, indent=2) + '\n')
    subprocess.run(['codesign', '--force', '--deep', '--sign', identity['sha1'], '--keychain', identity['keychain'], '--identifier', 'app.wallsoul.desktop', str(staged)], check=True)
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(staged)], check=True)
    result = subprocess.run(['codesign', '-dr', '-', str(staged)], check=True, capture_output=True, text=True)
    requirement = result.stdout + result.stderr
    if 'cdhash ' in requirement or not any(term in requirement for term in ('certificate', 'anchor')):
        raise SystemExit('签名未建立证书身份，拒绝替换已授权的开发包。')
    expected = 'identifier "app.wallsoul.desktop" and certificate leaf = H"' + identity['sha1'] + '"'
    subprocess.run(['codesign', '--verify', '-R', '=' + expected, str(staged)], check=True)
    # Preserve the previous app until the newly signed app has passed validation.
    previous = pathlib.Path(temporary) / 'previous.app'
    if target.exists():
        target.rename(previous)
    try:
        staged.rename(target)
    except OSError:
        if previous.exists():
            previous.rename(target)
        raise
    (root / 'artifacts/local-signing-requirement.txt').write_text(requirement)
print('已更新固定开发入口：' + str(target))
print('此本地签名用于保留开发身份，不等同于 Developer ID 公证。')
