/** Fit the complete source rectangle, including room for gaze and breathing offsets. */
export function portraitPlacement(w:number,h:number,lw:number,lh:number,size:number,x:number,y:number,bottomFlush=false){
 const px=w*.03,py=Math.max(2,h*.03);
 const bottom=bottomFlush?0:py,breathing=bottomFlush?1:1.002;
 const scale=Math.max(0,Math.min(h/lh*1.07*size,(w-2*px)/lw,(h-py-bottom)/(lh*breathing)));
 return {scale,x:Math.max(px,Math.min(w-px-lw*scale,w*x-lw*scale/2)),y:Math.max(py,Math.min(h-bottom-lh*scale*breathing,h*(y+.42)-lh*scale))};
}
