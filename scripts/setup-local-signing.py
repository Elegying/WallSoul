"""Create one local code-signing identity, without changing system trust or privacy grants."""
import json, pathlib, secrets, subprocess, tempfile
root = pathlib.Path(__file__).resolve().parents[1]
record = root / '.local-signing.json'
name = 'WallSoul Local Development'
def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout
if record.exists():
    raise SystemExit('Signing record already exists; refusing to replace the identity.')
with tempfile.TemporaryDirectory(prefix='wallsoul-signing-') as temporary:
    folder = pathlib.Path(temporary)
    config = folder / 'certificate.cnf'
    config.write_text('[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=WallSoul Local Development\n[ext]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=critical,codeSigning\n')
    key, cert, bundle = (folder / n for n in ('private.pem','certificate.pem','identity.p12'))
    run(['/usr/bin/openssl','req','-new','-newkey','rsa:2048','-nodes','-x509','-days','3650','-config',str(config),'-keyout',str(key),'-out',str(cert)])
    key.chmod(0o600)
    password = secrets.token_urlsafe(32)
    password_file = folder / 'password'
    password_file.write_text(password); password_file.chmod(0o600)
    run(['/usr/bin/openssl','pkcs12','-export','-inkey',str(key),'-in',str(cert),'-name',name,'-out',str(bundle),'-passout','file:'+str(password_file)])
    fingerprint=run(['/usr/bin/openssl','x509','-in',str(cert),'-noout','-fingerprint','-sha1']).strip().split('=')[1].replace(':','')
    keychain = str(pathlib.Path.home() / 'Library/Keychains/login.keychain-db')
    run(['/usr/bin/security','import',str(bundle),'-k',keychain,'-P',password,'-T','/usr/bin/codesign'])
    record.write_text(json.dumps({'name':name,'sha1':fingerprint,'keychain':keychain},indent=2)+'\n')
    print('Created local signing identity; private key remains in the login keychain. No trust or TCC settings changed.')
