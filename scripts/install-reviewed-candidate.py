"""Install the already-reviewed local candidate, retaining a rollback bundle."""
import datetime
import hashlib
import json
import os
import plistlib
import subprocess
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
candidate = root / 'artifacts/WallSoul-0.6.0-Candidate.app'
installed = Path('/Applications/幕灵.app')
binary = Path('Contents/MacOS/wallsoul')
processes = subprocess.check_output(['ps', '-axww', '-o', 'command='], text=True).splitlines()
for app in [candidate, installed]:
    assert not any(line.strip().startswith(str(app / binary)) for line in processes), 'Exit the current app normally before installation'
info = plistlib.loads((candidate / 'Contents/Info.plist').read_bytes())
assert info['CFBundleIdentifier'] == 'app.wallsoul.desktop'
assert info['CFBundleShortVersionString'] == '0.6.0'
subprocess.run(['codesign', '--verify', '--deep', '--strict', str(candidate)], check=True)
identity = json.loads((root / '.local-signing.json').read_text())
requirement = 'identifier "app.wallsoul.desktop" and certificate leaf = H"' + identity['sha1'] + '"'
subprocess.run(['codesign', '--verify', '-R', '=' + requirement, str(candidate)], check=True)
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
expected = digest(candidate / binary)
stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
backup = root / ('artifacts/WallSoul-before-0.6.0-' + stamp + '.app')
assert not backup.exists()
with tempfile.TemporaryDirectory(prefix='.wallsoul-install-', dir=installed.parent) as temporary:
    staged = Path(temporary) / '幕灵.app'
    subprocess.run(['ditto', str(candidate), str(staged)], check=True)
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(staged)], check=True)
    assert digest(staged / binary) == expected
    if installed.exists():
        os.rename(installed, backup)
    try:
        os.rename(staged, installed)
    except BaseException:
        if backup.exists() and not installed.exists():
            os.rename(backup, installed)
        raise
assert digest(installed / binary) == expected
record = {'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'candidate': str(candidate), 'installed': str(installed), 'backup': str(backup),
          'version': info['CFBundleShortVersionString'], 'binarySha256': expected,
          'launchAndRuntimeVerification': 'pending'}
(root / 'artifacts/installation-0.6.0.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(record, ensure_ascii=False, indent=2))
