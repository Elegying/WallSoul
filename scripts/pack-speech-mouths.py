"""Pack aligned opaque lip replacements; feather skin only, never blend lip silhouettes."""
import pathlib,json,hashlib
import numpy as np
from PIL import Image,ImageDraw
root=pathlib.Path(__file__).resolve().parents[1];folder=root/'resources/characters/soul';out=root/'assets-source/speech-mouths-v3'
manifest=json.loads((folder/'manifest.json').read_text());p=manifest['portrait'];base=Image.open(folder/'neutral-clean.png').convert('RGBA');raw=Image.open(folder/'neutral.png').convert('RGB')
region=(370,454,260,170);x,y,w,h=region
reference=np.array(raw.crop((x,y,x+w,y+h))).astype(float)
zero=np.array(Image.open(out/'mouth-0-0.png').resize((768,768),Image.Resampling.LANCZOS).crop((x-128,y,x-128+w,y+h))).astype(float)
yy,xx=np.mgrid[:h,:w];radius=np.sqrt(((xx-w/2)/(w/2))**2+((yy-h/2)/(h/2))**2);fade=np.clip((1-radius)/.13,0,1);fade=fade*fade*(3-2*fade)
# Skin-ring colour alignment, without transferring an old lip into a new shape.
ring=(radius>.88)&(radius<.97);offset=np.median((reference-zero)[ring],axis=0)
atlas=Image.new('RGBA',(w*8,h*3));comparison=Image.new('RGB',(260*8,220*3),(9,11,28));draw=ImageDraw.Draw(comparison)
for shape in range(3):
 for level in range(8):
  image=Image.open(out/f'mouth-{shape}-{level}.png').resize((768,768),Image.Resampling.LANCZOS)
  rgb=np.clip(np.array(image.crop((x-128,y,x-128+w,y+h))).astype(float)+offset,0,255)
  if level==0:rgb=reference
  patch=Image.fromarray(np.rint(np.dstack((rgb,fade*255))).astype('uint8'));atlas.paste(patch,(level*w,shape*h))
  canvas=base.copy();canvas.alpha_composite(patch,(x,y));crop=canvas.crop((350,425,650,650)).resize((260,195));background=Image.new('RGBA',crop.size,(9,11,28,255));background.alpha_composite(crop);comparison.paste(background.convert('RGB'),(level*260,shape*220+25));draw.text((level*260+5,shape*220+5),f'{shape}:{level}',fill='white')
  assert np.min(np.array(patch)[65:110,70:175,3])==255
atlas.save(folder/'speech-mouths.png');comparison.save(root/'artifacts/WallSoul-mouths-check.jpg',quality=95)
# Replace eye expression in source coordinates, leaving the surrounding face intact.
blink=Image.open(out/'blink.png').resize((768,768),Image.Resampling.LANCZOS)
bx,by,bw,bh=p['eyes'];base.paste(blink.crop((bx-128,by,bx-128+bw,by+bh)),(bx,by));base.save(folder/'blink-aligned.png')
p['wholeFrame']=True;p['speech']=dict(sheets=['speech-mouths.png'],columns=8,rows=3,tileWidth=w,tileHeight=h,levels=8,shapes=3,region=list(region));p['blink']='blink-aligned.png';p['thinking']='thinking-clean.png';manifest['layers'][0]['src']='neutral-clean.png';manifest['assetVersion']='1.6.1'
for c in p['body']['clips']:
 if c['id'] in ['happiness','joy','shy','eye-play']:c['automatic']=True;c['emotions']=['neutral','happy','curious']
(folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Packed 24 aligned mouth states; original reference hash',hashlib.sha256((folder/'neutral.png').read_bytes()).hexdigest())
