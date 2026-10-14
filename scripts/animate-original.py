"""Offline LivePortrait authoring for the original generated WallSoul identity.
No face detector, private account data, microphone, network inference, or replacement avatar.
"""
import sys,pathlib,os,math,json,time
root=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools/LivePortrait'))
os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK','1')
import cv2,numpy as np,torch
from src.live_portrait_wrapper import LivePortraitWrapper
from src.config.inference_config import InferenceConfig
from src.utils.camera import get_rotation_matrix
original_load=torch.load
def safe_load(*args,**kwargs):kwargs['weights_only']=True;return original_load(*args,**kwargs)
torch.load=safe_load;torch.set_num_threads(4)
folder=root/'resources/characters/soul';out=root/'assets-source/original-motion';out.mkdir(parents=True,exist_ok=True)
x,y,side=128,0,768
source=cv2.cvtColor(cv2.imread(str(folder/'neutral.png')),cv2.COLOR_BGR2RGB);blink=cv2.cvtColor(cv2.imread(str(folder/'blink.png')),cv2.COLOR_BGR2RGB)
wrapper=LivePortraitWrapper(InferenceConfig(flag_use_half_precision=False,checkpoint_S=None))
prepared=wrapper.prepare_source(source[y:y+side,x:x+side]);kp=wrapper.get_kp_info(prepared);features=wrapper.extract_feature_3d(prepared);source_kp=wrapper.transform_keypoint(kp)
blink_kp=wrapper.get_kp_info(wrapper.prepare_source(blink[y:y+side,x:x+side]));eye_delta=blink_kp['exp']-kp['exp']
# Restrict the blink delta to eye points, avoiding a mouth-expression transfer.
for i in range(eye_delta.shape[1]):
 if i not in [11,13,15,16,18]:eye_delta[:,i,:]=0
count=int(sys.argv[1]) if len(sys.argv)>1 else 120;start=time.monotonic()
with torch.no_grad():
 for frame in range(count):
  t=frame/count;phase=2*math.pi*t
  info={k:v.clone() for k,v in kp.items()}
  info['yaw']+=math.sin(phase)*7;info['pitch']+=(1-math.cos(phase*2))*1.8;info['roll']+=math.sin(phase)*2.0
  closure=max(0,1-abs(t-.3)/.018)+max(0,1-abs(t-.79)/.018);info['exp']+=eye_delta*closure
  driving=wrapper.transform_keypoint(info);result=wrapper.warp_decode(features,source_kp,driving);rgb=wrapper.parse_output(result['out'])[0]
  cv2.imwrite(str(out/f'{frame:04d}.png'),cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR))
  if frame%10==0 or count<10:print(f'{frame+1}/{count} frames {time.monotonic()-start:.1f}s',flush=True)
(out/'motion.json').write_text(json.dumps({'source':'resources/characters/soul/neutral.png','crop':[x,y,side,side],'frames':count,'fps':10,'authoring':'LivePortrait on local Apple Silicon; analytic head motion; no live speech signal'},indent=2))
print('DONE',flush=True)
