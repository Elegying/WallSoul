"""Download the author's public checkpoint and verify the published SHA-256."""
import json,pathlib,urllib.request,urllib.parse,hashlib
root=pathlib.Path(__file__).resolve().parents[1];out=root/'tools/TPSMotion/checkpoints';out.mkdir(exist_ok=True)
expected='b067b374bf9bd11dcc1a00261c323264ccefaded449690aa4c3f6f16ac0ea0ed'
params=urllib.parse.urlencode({'public_key':'https://disk.yandex.com/d/bWopgbGj1ZUV1w','path':'/ted.pth.tar'})
with urllib.request.urlopen('https://cloud-api.yandex.net/v1/disk/public/resources/download?'+params,timeout=30) as r:link=json.load(r)['href']
path=out/'ted.pth.tar';partial=out/'ted.pth.tar.part'
with urllib.request.urlopen(link,timeout=60) as response,open(partial,'wb') as f:
 while chunk:=response.read(1024*1024):f.write(chunk)
actual=hashlib.sha256(partial.read_bytes()).hexdigest()
if actual!=expected:raise RuntimeError('Model checksum mismatch')
partial.rename(path)
(root/'docs/third-party/tps-model.json').write_text(json.dumps({'source':'https://github.com/yoyo-nb/Thin-Plate-Spline-Motion-Model','checkpoint':'ted.pth.tar','sha256':actual,'size':path.stat().st_size},indent=2)+'\n')
print('Verified',path.stat().st_size,actual,flush=True)
