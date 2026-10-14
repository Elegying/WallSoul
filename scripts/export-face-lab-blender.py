"""Editable facial depth mesh with a jaw bone and separate dental rows. Research prototype."""
import bpy,json,pathlib,math
root=pathlib.Path(__file__).resolve().parents[1];d=json.loads((root/'resources/face-lab/face.json').read_text());p=d['points'];w,h=d['width'],d['height'];S=.001
bpy.ops.wm.read_factory_settings(use_empty=True)
vertices=[((v[0]-w/2)*S,v[2]*S,(480-v[1])*S) for v in p];faces=[tuple(d['triangles'][i:i+3]) for i in range(0,len(d['triangles']),3)]
mesh=bpy.data.meshes.new('OriginalFace_468');mesh.from_pydata(vertices,[],faces);mesh.update();face=bpy.data.objects.new('原形象_面部深度网格',mesh);bpy.context.collection.objects.link(face)
uv=mesh.uv_layers.new(name='OriginalProjection')
for poly in mesh.polygons:
 for loop_id in poly.loop_indices:
  q=p[mesh.loops[loop_id].vertex_index];uv.data[loop_id].uv=(q[0]/w,1-q[1]/h)
mat=bpy.data.materials.new('原形象投影纹理');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear();out=nodes.new('ShaderNodeOutputMaterial');em=nodes.new('ShaderNodeEmission');tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(root/'resources/characters/soul/neutral-clean.png'));tex.image.pack();mat.node_tree.links.new(tex.outputs['Color'],em.inputs['Color']);mat.node_tree.links.new(em.outputs[0],out.inputs[0]);mesh.materials.append(mat)
arm=bpy.data.armatures.new('JawRig');rig=bpy.data.objects.new('下颌控制',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT');head=arm.edit_bones.new('Head');head.head=(0,0,.15);head.tail=(0,0,.25);jaw=arm.edit_bones.new('Jaw');jaw.head=(0,-.04,.02);jaw.tail=(0,0,-.10);jaw.parent=head;bpy.ops.object.mode_set(mode='OBJECT')
vg=face.vertex_groups.new(name='Jaw');headg=face.vertex_groups.new(name='Head');cy=(p[61][1]+p[291][1])/2;chin=p[152][1];lower={146,91,181,84,17,314,405,321,375,140,171,175,148,176,149,150,136,172,58,132,152,14,87,178,88,95,317,402,318,324}
for i,q in enumerate(p):
 weight=max(0,min(1,(q[1]-cy)/(chin-cy)))*.8
 if i in lower:weight=max(.7,weight)
 vg.add([i],weight,'REPLACE');headg.add([i],1-weight,'REPLACE')
mod=face.modifiers.new('Jaw skinning','ARMATURE');mod.object=rig
mx=(p[61][0]+p[291][0])/2-w/2;my=(p[13][1]+p[14][1])/2;mw=math.dist(p[61][:2],p[291][:2]);mz=(p[13][2]+p[14][2])/2
ref=json.loads((root/'resources/face-lab/dental-reference.json').read_text());dp=ref['points']
dentalmat=mat.copy();dentalmat.name='原角色口腔参考纹理'
for n in dentalmat.node_tree.nodes:
 if n.type=='TEX_IMAGE':n.image=bpy.data.images.load(str(root/'resources/characters/soul/speaking.png'));n.image.pack()
topids=[78,191,80,81,82,13,312,311,310,415,308];bottomids=[78,95,88,178,87,14,317,402,318,324,308]
def curve(ids,x):
 ps=sorted([dp[i] for i in ids])
 for a,b in zip(ps,ps[1:]):
  if x<=b[0]:return a[1]+(b[1]-a[1])*max(0,min(1,(x-a[0])/(b[0]-a[0])))
 return ps[-1][1]
for lower in [False,True]:
 vs=[];uvs=[];faces=[]
 for i in range(33):
  u=i/32;x=dp[78][0]+(dp[308][0]-dp[78][0])*u;top=curve(topids,x);bottom=curve(bottomids,x)
  for j in range(2):
   v=(.60 if j==0 else .93) if lower else (.06 if j==0 else .55)
   vs.append(((mx+(u-.5)*mw*.91)*S,(mz-5-((u-.5)*2)**2*7)*S,(480-my+(-3-j*5 if lower else 2-j*9))*S));uvs.append((x/ref['width'],1-(top+(bottom-top)*v)/ref['height']))
  if i<32:k=i*2;faces.extend([(k,k+1,k+2),(k+1,k+3,k+2)])
 g=bpy.data.meshes.new('牙弓纹理网格');g.from_pydata(vs,[],faces);g.update();layer=g.uv_layers.new()
 for poly in g.polygons:
  for l in poly.loop_indices:layer.data[l].uv=uvs[g.loops[l].vertex_index]
 o=bpy.data.objects.new('下牙弓' if lower else '上牙弓',g);bpy.context.collection.objects.link(o);g.materials.append(dentalmat)
 if lower:
  v=o.vertex_groups.new(name='Jaw');v.add(list(range(len(vs))),1,'REPLACE');m=o.modifiers.new('Lower arch follows jaw','ARMATURE');m.object=rig
pb=rig.pose.bones['Jaw'];pb.rotation_mode='XYZ'
for f,angle in [(1,0),(10,.025),(20,0),(30,.045),(40,.01),(50,.035),(60,0)]:pb.rotation_euler.x=angle;pb.keyframe_insert('rotation_euler',frame=f)
scene=bpy.context.scene;scene.frame_end=60;scene.render.fps=30;scene.frame_set(1)
text=bpy.data.texts.new('READ_ME');text.write('幕灵拟真路线验证。468点深度网格保留原图投影；独立下颌骨骼和上下牙列。不是完整写实角色。浏览器小样采用口腔轮廓遮挡；本工程供继续雕刻、补口腔和优化权重，尚未达到成品标准。原图不改。MediaPipe topology: Apache-2.0。')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets-source/face-lab/WallSoul-face-study.blend'))
print('Saved editable original-face jaw study')
