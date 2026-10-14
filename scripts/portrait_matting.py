"""Offline strand-edge alpha estimation; never run matting in the desktop render loop."""
import numpy as np
from scipy.ndimage import binary_erosion
from pymatting import estimate_alpha_cf, estimate_foreground_ml
def matte(rgb):
 image=rgb.astype(np.float64)/255
 dominance=image[:,:,1]-np.maximum(image[:,:,0],image[:,:,2])
 trimap=np.full(dominance.shape,.5)
 trimap[binary_erosion(dominance>.45,iterations=1,border_value=1)]=0
 trimap[binary_erosion(dominance<.045,iterations=2,border_value=1)]=1
 alpha=estimate_alpha_cf(image,trimap,cg_kwargs={'maxiter':3000})
 foreground=estimate_foreground_ml(image,alpha)
 # Preserve the exact RGB away from uncertain edges, removing green contamination only there.
 foreground=np.where((alpha>.995)[:,:,None],image,foreground)
 # This character has no green clothing or hair. Remove key spill even from
 # near-opaque strands: alpha alone cannot remove reflected screen colour.
 foreground[:,:,1]=np.minimum(foreground[:,:,1],(foreground[:,:,0]+foreground[:,:,2])/2)
 return np.clip(foreground*255,0,255),np.clip(alpha,0,1)[:,:,None]
if __name__=='__main__':
 from PIL import Image
 import sys
 source=np.array(Image.open(sys.argv[1]).convert('RGB'));rgb,a=matte(source)
 Image.fromarray(np.rint(np.concatenate([rgb,a*255],2)).astype('uint8')).save(sys.argv[2])
