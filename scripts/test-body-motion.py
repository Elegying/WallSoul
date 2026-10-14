"""Bounded local-only TED motion transfer experiment; output is not a release asset."""
import os,sys,pathlib,gc,time
os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK','1')
root=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools/TPSMotion'))
import torch,numpy as np,cv2,yaml
from scipy.spatial import ConvexHull
from modules.inpainting_network import InpaintingNetwork
from modules.keypoint_detector import KPDetector
from modules.dense_motion import DenseMotionNetwork
torch.set_num_threads(2);device=torch.device('cpu') # Upstream uses tensor type strings unsupported by Metal.
config=yaml.safe_load((root/'tools/TPSMotion/config/ted-384.yaml').read_text())['model_params']
checkpoint=torch.load(root/'tools/TPSMotion/checkpoints/ted.pth.tar',map_location='cpu',weights_only=True)
models=[InpaintingNetwork(**config['generator_params'],**config['common_params']),KPDetector(**config['common_params']),DenseMotionNetwork(**config['common_params'],**config['dense_motion_params'])]
for model,key in zip(models,['inpainting_network','kp_detector','dense_motion_network']):model.load_state_dict(checkpoint[key]);model.eval();model.to(device)
del checkpoint;gc.collect();inpaint,kpnet,dense=models
out=root/'assets-source/body-motion-experiment';out.mkdir(exist_ok=True)
source=cv2.cvtColor(cv2.imread(str(root/'resources/characters/soul/neutral.png')),cv2.COLOR_BGR2RGB)[:1280]
def tensor(rgb):return torch.from_numpy(cv2.resize(rgb,(384,384)).astype('float32')/255).permute(2,0,1)[None].to(device)
cap=cv2.VideoCapture('/Users/jared/Downloads/2026-09-09 20_46_42.mp4');start=time.monotonic()
with torch.no_grad():
 src=tensor(source);ks=kpnet(src)
 for n,seconds in enumerate(range(15,23)):
  cap.set(cv2.CAP_PROP_POS_MSEC,seconds*1000);ok,bgr=cap.read()
  if not ok:raise RuntimeError('Reference frame unavailable')
  drive=tensor(cv2.cvtColor(bgr[:532,400:950],cv2.COLOR_BGR2RGB));kd=kpnet(drive)
  if n==0:
   initial=kd['fg_kp'].clone();scale=(ConvexHull(ks['fg_kp'][0].cpu().numpy()).volume/ConvexHull(initial[0].cpu().numpy()).volume)**.5
  normalized={'fg_kp':ks['fg_kp']+(kd['fg_kp']-initial)*scale}
  motion=dense(src,kp_driving=normalized,kp_source=ks,bg_param=None,dropout_flag=False)
  prediction=inpaint(src,motion)['prediction'][0].permute(1,2,0).cpu().numpy()
  cv2.imwrite(str(out/f'ted-{n:02d}.png'),cv2.cvtColor(np.clip(prediction*255,0,255).astype('uint8'),cv2.COLOR_RGB2BGR))
  print(n,round(time.monotonic()-start,1),flush=True)
cap.release();print('DONE',flush=True)
