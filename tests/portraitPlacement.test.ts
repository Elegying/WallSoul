import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portraitPlacement} from '../src/renderer/portraitPlacement';
test('full portrait and raised arm remain inside every supported size and position',()=>{
 for(const [w,h] of [[840,310],[1440,900],[2560,1600],[400,900]])for(const size of [.4,.9,1.4])for(const x of [.15,.65,.85])for(const y of [.35,.58,.8]){
  const p=portraitPlacement(w,h,1024,1536,size,x,y);
  assert.ok(p.x-10*p.scale>=0);assert.ok(p.x+1034*p.scale<=w);
  assert.ok(p.y-1.2>=0);assert.ok(p.y+1536*p.scale*1.002+1.2<=h);
 }
});
test('whole-frame desktop portraits meet the bottom edge without losing head or arm room',()=>{
 for(const [w,h] of [[1440,900],[2560,1600],[400,900]])for(const size of [.4,.9,1.4])for(const x of [.15,.65,.85]){
  const p=portraitPlacement(w,h,1024,1536,size,x,.58,true);
  assert.ok(Math.abs(p.y+1536*p.scale-h)<.00001);
  assert.ok(p.y>=h*.03-.00001);
  assert.ok(p.x>=w*.03-.00001&&p.x+1024*p.scale<=w*.97+.00001);
 }
});
