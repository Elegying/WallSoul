"""Create an attributed VRM material variant and editable, data-driven motion clips."""
import json,struct,pathlib,hashlib
root=pathlib.Path(__file__).resolve().parents[1];src=root/'assets-source/3d/reference.vrm';out=root/'assets-source/3d/prototype-character'
f=src.open('rb');f.read(12);n,t=struct.unpack('<II',f.read(8));j=json.loads(f.read(n));n,t=struct.unpack('<II',f.read(8));binary=f.read(n)
meta=j['extensions']['VRMC_vrm']['meta'];(out/'LICENSE-model.json').write_text(json.dumps({'source':'https://github.com/pixiv/three-vrm/tree/dev/packages/three-vrm/examples/models','sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'originalMeta':meta,'modifications':'WallSoul: bob haircut, fitted torso and long sleeves, dark material palette; motion library authored locally. Not an official Doubao likeness.'},indent=2,ensure_ascii=False))
meta=dict(meta);meta['name']='WallSoul Night / modified VRM sample';meta['authors']=[*meta['authors'],'WallSoul material and motion adaptation'];j['extensions']['VRMC_vrm']['meta']=meta
for m in j['materials']:
 name=m.get('name','');color=None
 if 'HAIR' in name:color=[.025,.026,.035,1]
 if 'Tops' in name or 'Bottoms' in name:color=[.008,.009,.014,1]
 if 'Shoes' in name:color=[.08,.09,.12,1]
 if color:
  m.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=color
  toon=m.get('extensions',{}).get('VRMC_materials_mtoon',{});toon['shadeColorFactor']=[c*.7 for c in color[:3]]
# Shorten the silhouette to a bob without replacing the weighted rig.
binary=bytearray(binary)
hair=j['meshes'][2]['primitives'][0]['attributes']['POSITION'];access=j['accessors'][hair];view=j['bufferViews'][access['bufferView']];offset=view.get('byteOffset',0)+access.get('byteOffset',0);stride=view.get('byteStride',12)
for i in range(access['count']):
 x,y,z=struct.unpack_from('<fff',binary,offset+i*stride)
 if y<1.40:
  y=1.40+(y-1.40)*.13;x*=.7
 struct.pack_into('<fff',binary,offset+i*stride,x,y,z)
# Give the shortened tips the head influence so obsolete long-hair joints do not drag them outwards.
primitive=j['meshes'][2]['primitives'][0];skin_id=next(n['skin'] for n in j['nodes'] if n.get('mesh')==2);head=j['extensions']['VRMC_vrm']['humanoid']['humanBones']['head']['node'];head_index=j['skins'][skin_id]['joints'].index(head)
ja=j['accessors'][primitive['attributes']['JOINTS_0']];jv=j['bufferViews'][ja['bufferView']];jo=jv.get('byteOffset',0)+ja.get('byteOffset',0);jc='H' if ja['componentType']==5123 else 'B';jstride=jv.get('byteStride',struct.calcsize('<'+jc*4))
wa=j['accessors'][primitive['attributes']['WEIGHTS_0']];wv=j['bufferViews'][wa['bufferView']];wo=wv.get('byteOffset',0)+wa.get('byteOffset',0);wstride=wv.get('byteStride',16)
for i in range(access['count']):
 x,y,z=struct.unpack_from('<fff',binary,offset+i*stride)
 if y<1.40:
  struct.pack_into('<'+jc*4,binary,jo+i*jstride,head_index,0,0,0);struct.pack_into('<ffff',binary,wo+i*wstride,1,0,0,0)
access['min'][1]=1.40+(access['min'][1]-1.40)*.13
# Add long sleeves using the original weighted arm surface; preserve torso clearance.
skin=j['meshes'][0]['primitives'][0];pos=j['accessors'][skin['attributes']['POSITION']];pv=j['bufferViews'][pos['bufferView']];po=pv.get('byteOffset',0)+pos.get('byteOffset',0);ps=pv.get('byteStride',12)
ia=j['accessors'][skin['indices']];iv=j['bufferViews'][ia['bufferView']];io=iv.get('byteOffset',0)+ia.get('byteOffset',0);code='H' if ia['componentType']==5123 else 'I';indices=struct.unpack_from('<'+code*ia['count'],binary,io);sleeve=[];bare=[]
for i in range(0,len(indices),3):
 tri=indices[i:i+3];pts=[struct.unpack_from('<fff',binary,po+k*ps) for k in tri]
 is_sleeve=all(.215<abs(x)<.595 and 1.12<y<1.40 for x,y,z in pts)
 (sleeve if is_sleeve else bare).extend(tri)
def add_indices(values):
 while len(binary)%4:binary.append(0)
 offset=len(binary);data=struct.pack('<'+'I'*len(values),*values);binary.extend(data);j['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(data),'target':34963});j['accessors'].append({'bufferView':len(j['bufferViews'])-1,'componentType':5125,'count':len(values),'type':'SCALAR'});return len(j['accessors'])-1
if sleeve:
 skin['indices']=add_indices(bare);material={'name':'WallSoul_Sleeves','doubleSided':False,'pbrMetallicRoughness':{'baseColorFactor':[.035,.04,.06,1],'metallicFactor':0,'roughnessFactor':.94}};j['materials'].append(material);j['meshes'][0]['primitives'].append({'attributes':skin['attributes'],'indices':add_indices(sleeve),'material':len(j['materials'])-1})
j['buffers'][0]['byteLength']=len(binary)
js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary+=b'\0'*((-len(binary))%4)
(out/'character.vrm').write_bytes(struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary)
# Rotations in radians on the VRM normalized humanoid. Frames blend continuously.
base={'leftUpperArm':[0,0,-1.23],'rightUpperArm':[0,0,1.23],'leftLowerArm':[0,0,-.12],'rightLowerArm':[0,0,.12]}
clips=[]
def clip(id,label,duration,poses):
 frames=[{'at':0,'bones':base,'height':0}]
 for at,bones,height in poses:frames.append({'at':at,'bones':{**base,**bones},'height':height})
 frames.append({'at':1,'bones':base,'height':0});clips.append({'id':id,'label':label,'duration':duration,'frames':frames})
clip('sway','重心移动',6,[(.25,{'hips':[0,.08,.035],'spine':[0,-.06,-.025],'head':[.025,.06,.04]},-.01),(.7,{'hips':[0,-.08,-.035],'spine':[0,.06,.025],'head':[-.025,-.07,-.04]},-.01)])
clip('look','环顾四周',7,[(.25,{'chest':[0,.12,0],'neck':[0,.18,0],'head':[.03,.3,.04]},0),(.65,{'chest':[0,-.1,0],'neck':[0,-.15,0],'head':[-.02,-.3,-.04]},0)])
clip('wave','招手',5,[(.22,{'rightUpperArm':[.05,0,.05],'rightLowerArm':[0,0,-1.9],'rightHand':[.15,0,-.1],'head':[0,.04,.05]},0),(.38,{'rightUpperArm':[.05,0,.05],'rightLowerArm':[0,0,-1.9],'rightHand':[-.2,0,.2]},0),(.53,{'rightUpperArm':[.05,0,.05],'rightLowerArm':[0,0,-1.9],'rightHand':[.2,0,-.2]},0),(.7,{'rightUpperArm':[.05,0,.05],'rightLowerArm':[0,0,-1.9],'rightHand':[-.18,0,.15]},0)])
clip('stretch','伸展肩臂',7,[(.3,{'leftUpperArm':[0,0,1.18],'rightUpperArm':[0,0,-1.18],'leftLowerArm':[0,0,.3],'rightLowerArm':[0,0,-.3],'spine':[-.06,0,0],'head':[-.13,0,0]},.015),(.6,{'leftUpperArm':[0,0,1.25],'rightUpperArm':[0,0,-1.25],'leftLowerArm':[0,0,.28],'rightLowerArm':[0,0,-.28],'spine':[-.06,0,.05],'head':[-.08,0,-.05]},.015)])
clip('nod','点头微笑',4,[(.25,{'head':[.16,0,.015]},-.005),(.45,{'head':[-.05,0,0]},0),(.65,{'head':[.12,0,0]},-.005)])
clip('bow','欠身致意',5,[(.35,{'hips':[.13,0,0],'spine':[.18,0,0],'chest':[.1,0,0],'head':[-.05,0,0],'leftUpperArm':[-.08,0,-1.35],'rightUpperArm':[-.08,0,1.35]},-.025),(.6,{'hips':[.13,0,0],'spine':[.18,0,0],'chest':[.1,0,0],'head':[-.05,0,0]},-.025)])
clip('turn','侧身回眸',7,[(.35,{'hips':[0,.55,0],'spine':[0,.12,0],'head':[0,-.3,0],'leftUpperArm':[.08,0,-1.2],'rightUpperArm':[-.08,0,1.2]},0),(.65,{'hips':[0,-.45,0],'spine':[0,-.1,0],'head':[0,.25,0]},0)])
clip('squat','轻蹲起身',6,[(.35,{'hips':[-.08,0,0],'leftUpperLeg':[-.5,0,0],'rightUpperLeg':[-.5,0,0],'leftLowerLeg':[1,0,0],'rightLowerLeg':[1,0,0],'leftFoot':[-.42,0,0],'rightFoot':[-.42,0,0],'spine':[.22,0,0],'leftUpperArm':[0,-.18,-.9],'rightUpperArm':[0,.18,.9]},-.115),(.55,{'hips':[-.08,0,0],'leftUpperLeg':[-.5,0,0],'rightUpperLeg':[-.5,0,0],'leftLowerLeg':[1,0,0],'rightLowerLeg':[1,0,0],'leftFoot':[-.42,0,0],'rightFoot':[-.42,0,0],'spine':[.22,0,0]},-.115)])
(out/'motions.json').write_text(json.dumps({'version':1,'clips':clips},indent=2))
manifest={'id':'soul3d','name':'幕灵 · 3D','schemaVersion':1,'assetVersion':'1.1.0','description':'实时骨骼 · 风格化人物','demo':True,'preview':'preview.svg','background':'background.svg','layout':{'width':1024,'height':1536},'animation':{'breath':5.8,'blink':4.7},'layers':[{'id':'fallback','src':'preview.svg'}],'model':{'src':'character.vrm','motions':'motions.json'}}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
(out/'background.svg').write_text((root/'resources/characters/soul/background.svg').read_text())
(out/'preview.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536"><rect width="1024" height="1536" fill="#080d24"/><circle cx="512" cy="680" r="180" fill="#252a50"/><text x="512" y="710" text-anchor="middle" font-size="80" fill="#c8cff0">3D</text></svg>')
print('Prepared VRM material variant and',len(clips),'continuous skeletal clips')
