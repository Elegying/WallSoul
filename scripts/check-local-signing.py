"""Check certificate identity compatibility after changing signed resource contents."""
import json,pathlib,subprocess,tempfile
root=pathlib.Path(__file__).resolve().parents[1]
identity=json.loads((root/'.local-signing.json').read_text())
original=root/'artifacts/WallSoul-Development.app'
def run(args):return subprocess.run(args,check=True,capture_output=True,text=True)
def requirement(app):
 result=run(['codesign','-dr','-',str(app)])
 return (result.stdout+result.stderr).split('designated => ',1)[1].splitlines()[0].strip()
before=requirement(original)
with tempfile.TemporaryDirectory(prefix='wallsoul-identity-') as temp:
 copy=pathlib.Path(temp)/'WallSoul.app';run(['ditto',str(original),str(copy)])
 (copy/'Contents/Resources/signing-test.txt').write_text('Different content for signing identity verification.\n')
 run(['codesign','--force','--sign',identity['sha1'],'--keychain',identity['keychain'],'--identifier','app.wallsoul.desktop',str(copy)])
 run(['codesign','--verify','--deep','--strict',str(copy)])
 after=requirement(copy)
 assert before==after
 assert 'cdhash' not in before and 'certificate leaf' in before
 run(['codesign','--verify','-R','='+before,str(copy)])
 run(['codesign','--verify','-R','='+after,str(original)])
 print('通过：修改资源后签名身份相同，两个构建互相满足对方的身份要求。')
 (root/'artifacts/local-signing-check.json').write_text(json.dumps({'compatible':True,'requirement':before},indent=2)+'\n')
