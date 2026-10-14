"""Offline same-identity expression clips using reviewed official LivePortrait controls."""
import pathlib,sys,os,ast,math,json,time
root=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools/LivePortrait'));os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK','1')
import cv2,numpy as np,torch
from src.live_portrait_wrapper import LivePortraitWrapper
from src.config.inference_config import InferenceConfig
original_load=torch.load
def safe_load(*args,**kwargs):kwargs['weights_only']=True;return original_load(*args,**kwargs)
torch.load=safe_load;torch.set_num_threads(3)
# Load only the four reviewed arithmetic control methods; no detector or Gradio runtime.
tree=ast.parse((root/'tools/LivePortrait/src/gradio_pipeline.py').read_text());names={'update_delta_new_smile','update_delta_new_wink','update_delta_new_eyebrow','update_delta_new_eyeball_direction'}
methods=[node for cls in tree.body if isinstance(cls,ast.ClassDef) and cls.name=='GradioPipeline' for node in cls.body if isinstance(node,ast.FunctionDef) and node.name in names]
for method in methods:method.decorator_list=[]
scope={};exec(compile(ast.fix_missing_locations(ast.Module(body=[ast.ClassDef(name='Controls',bases=[],keywords=[],body=methods,decorator_list=[])],type_ignores=[])),'official-expression-controls','exec'),scope);controls=scope['Controls']()
source=cv2.cvtColor(cv2.imread(str(root/'resources/characters/soul/neutral.png')),cv2.COLOR_BGR2RGB)
wrapper=LivePortraitWrapper(InferenceConfig(flag_use_half_precision=False,checkpoint_S=None));prepared=wrapper.prepare_source(source[0:768,128:896]);kp=wrapper.get_kp_info(prepared);features=wrapper.extract_feature_3d(prepared);source_kp=wrapper.transform_keypoint(kp)
clips=[('happy',.65,0,0,0,0),('curious',.12,4,0,3,0),('concerned',-.12,-3,0,-2,1),('wink',.3,0,10,0,0),('look-away',.05,0,0,-6,2),('nod',.15,0,0,0,0)]
out=root/'assets-source/expression-motion';out.mkdir(parents=True,exist_ok=True);count=10;meta=[];start=time.monotonic()
with torch.no_grad():
 for name,smile,brow,wink,eye_x,eye_y in clips:
  for n in range(count):
   amp=math.sin(math.pi*n/(count-1))**2;info={k:v.clone() for k,v in kp.items()};exp=info['exp']
   controls.update_delta_new_smile(smile*amp,exp);controls.update_delta_new_eyebrow(brow*amp,exp);controls.update_delta_new_wink(wink*amp,exp);controls.update_delta_new_eyeball_direction(eye_x*amp,eye_y*amp,exp)
   info['pitch']+=(-5 if name=='nod' else 1.5)*amp;info['roll']+=(3 if name=='curious' else -1)*amp
   result=wrapper.warp_decode(features,source_kp,wrapper.transform_keypoint(info));rgb=wrapper.parse_output(result['out'])[0];cv2.imwrite(str(out/f'{name}-{n:02d}.png'),cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR))
  meta.append({'id':name,'frames':count});print(name,f'{time.monotonic()-start:.1f}s',flush=True)
(out/'clips.json').write_text(json.dumps(meta));print('DONE',flush=True)
