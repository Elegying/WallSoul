"""Offline same-identity mouth motion; the installed application never runs inference."""
import pathlib,sys,os,ast,json,hashlib
os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK','1')
root=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools/LivePortrait'))
import cv2,numpy as np,torch
from PIL import Image,ImageDraw
from src.live_portrait_wrapper import LivePortraitWrapper
from src.config.inference_config import InferenceConfig
load=torch.load
def safe_load(*a,**kw):kw['weights_only']=True;return load(*a,**kw)
torch.load=safe_load;torch.set_num_threads(2)
folder=root/'resources/characters/soul';out=root/'assets-source/speech-mouths-v3';out.mkdir(exist_ok=True)
source=cv2.cvtColor(cv2.imread(str(folder/'neutral.png')),cv2.COLOR_BGR2RGB)
ref=json.loads((root/'assets-source/body-motion-experiment/reviewed-set.json').read_text())
assert hashlib.sha256((folder/'neutral.png').read_bytes()).hexdigest()==ref['referenceSha256']
wrapper=LivePortraitWrapper(InferenceConfig(flag_use_half_precision=False))
prepared=wrapper.prepare_source(source[:768,128:896]);kp=wrapper.get_kp_info(prepared);features=wrapper.extract_feature_3d(prepared);origin=wrapper.transform_keypoint(kp)
# Original official lip controls, extracted as arithmetic only.
tree=ast.parse((root/'tools/LivePortrait/src/gradio_pipeline.py').read_text());names={'update_delta_new_lip_variation_one','update_delta_new_lip_variation_two','update_delta_new_lip_variation_three'}
methods=[n for c in tree.body if isinstance(c,ast.ClassDef) and c.name=='GradioPipeline' for n in c.body if isinstance(n,ast.FunctionDef) and n.name in names]
for n in methods:n.decorator_list=[]
scope={};exec(compile(ast.fix_missing_locations(ast.Module(body=[ast.ClassDef(name='Controls',bases=[],keywords=[],body=methods,decorator_list=[])],type_ignores=[])),'official-lip-controls','exec'),scope);controls=scope['Controls']()
with torch.no_grad():
 for shape in range(3):
  for level in range(8):
   amount=level/7;info={k:v.clone() for k,v in kp.items()};# Do not mix a smiling reference into speech.
   if shape==1:controls.update_delta_new_lip_variation_two(amount*1.5,info['exp'])
   if shape==2:controls.update_delta_new_lip_variation_one(amount*1.5,info['exp']);controls.update_delta_new_lip_variation_three(amount*.6,info['exp'])
   driving=wrapper.transform_keypoint(info)+wrapper.retarget_lip(origin,torch.tensor([[.02,.02+amount*.14]],device=origin.device))
   result=wrapper.warp_decode(features,origin,driving);rgb=wrapper.parse_output(result['out'])[0]
   Image.fromarray(rgb).save(out/f'mouth-{shape}-{level}.png')
  print('mouth family',shape,'done',flush=True)
 # Blink stays in the original pose and identity.
 blink=cv2.cvtColor(cv2.imread(str(folder/'blink.png')),cv2.COLOR_BGR2RGB)
 bk=wrapper.get_kp_info(wrapper.prepare_source(blink[:768,128:896]));eye_delta=bk['exp']-kp['exp']
 for i in range(eye_delta.shape[1]):
  if i not in [11,13,15,16,18]:eye_delta[:,i,:]=0
 info={k:v.clone() for k,v in kp.items()};info['exp']+=eye_delta
 Image.fromarray(wrapper.parse_output(wrapper.warp_decode(features,origin,wrapper.transform_keypoint(info))['out'])[0]).save(out/'blink.png')
print('24 mouth candidates generated',flush=True)
