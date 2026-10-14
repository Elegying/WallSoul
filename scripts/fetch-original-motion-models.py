"""Download only the four official portrait networks, pinned by SHA-256."""
import concurrent.futures, hashlib, json, pathlib, urllib.request
root=pathlib.Path(__file__).resolve().parents[1]
rows=json.loads((root/'docs/third-party/liveportrait-models.json').read_text())
def download(row):
 target=root/'tools/LivePortrait/pretrained_weights'/row['path']
 target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==row['lfs']['oid']:return
 temporary=target.with_suffix('.download')
 urllib.request.urlretrieve('https://huggingface.co/KlingTeam/LivePortrait/resolve/main/'+row['path'],temporary)
 if hashlib.sha256(temporary.read_bytes()).hexdigest()!=row['lfs']['oid']:raise ValueError('Model hash mismatch')
 temporary.replace(target)
 print('Verified',row['path'],flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(download,rows))
