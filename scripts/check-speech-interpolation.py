import importlib.util
import numpy as np
from pathlib import Path
spec=importlib.util.spec_from_file_location('loops',Path(__file__).with_name('smooth-speech-loops.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
a=np.zeros((96,96,4),np.uint8);a[25:65,22:52]=[230,160,110,255];b=np.roll(a,8,axis=1)
frames=module.interpolate(a,b,[0,.5,1]);assert np.array_equal(frames[0],a) and np.array_equal(frames[-1],b)
yy,xx=np.where(frames[1][:,:,3]>127);assert abs(xx.mean()-40.5)<1;assert xx.max()-xx.min()<34
print('Offline interpolation endpoints and translation check passed.')
