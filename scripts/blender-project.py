"""Blender 4.5: import rigged VRM geometry and create editable skeletal Actions."""
import bpy,json,struct,pathlib,math
from mathutils import Euler,Quaternion,Vector
root=pathlib.Path(__file__).resolve().parents[1];folder=root/'assets-source/3d/prototype-character'
f=(folder/'character.vrm').open('rb');f.read(12);n,t=struct.unpack('<II',f.read(8));doc=json.loads(f.read(n))
mapping={name:doc['nodes'][bone['node']]['name'] for name,bone in doc['extensions']['VRMC_vrm']['humanoid']['humanBones'].items()}
bpy.ops.wm.read_factory_settings(use_empty=True)
temp=root/'assets-source/3d/import.glb';temp.write_bytes((folder/'character.vrm').read_bytes());bpy.ops.import_scene.gltf(filepath=str(temp));temp.unlink()
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.name='WallSoul_Rig';rig.animation_data_create()
clips=json.loads((folder/'motions.json').read_text())['clips'];basis=Quaternion((1,0,0),math.pi/2)
for clip in clips:
 action=bpy.data.actions.new('WallSoul_'+clip['id']);action.use_fake_user=True;rig.animation_data.action=action
 for bone in rig.pose.bones:bone.rotation_mode='QUATERNION';bone.rotation_quaternion=Quaternion();bone.location=Vector()
 names=set(name for frame in clip['frames'] for name in frame['bones'])
 for index in range(len(clip['frames'])-1):
  a,b=clip['frames'][index:index+2]
  for step in range(13):
   t=step/12;e=t*t*(3-2*t);frame=1+round((a['at']+(b['at']-a['at'])*t)*clip['duration']*30)
   for name in names:
    pb=rig.pose.bones.get(mapping.get(name,''))
    if not pb:continue
    qa=Euler(a['bones'].get(name,[0,0,0]),'XYZ').to_quaternion();qb=Euler(b['bones'].get(name,[0,0,0]),'XYZ').to_quaternion();q=basis@qa.slerp(qb,e)@basis.inverted();rest=pb.bone.matrix_local.to_quaternion();pb.rotation_quaternion=rest.inverted()@q@rest;pb.keyframe_insert('rotation_quaternion',frame=frame,group=name)
   hips=rig.pose.bones[mapping['hips']];height=a['height']+(b['height']-a['height'])*e;hips.location=hips.bone.matrix_local.to_quaternion().inverted()@Vector((0,0,height));hips.keyframe_insert('location',frame=frame,group='hips')
 action['motion_source']='assets-source/3d/prototype-character/motions.json';action['duration_seconds']=clip['duration']
rig.animation_data.action=bpy.data.actions['WallSoul_wave'];bpy.context.scene.render.fps=30;bpy.context.scene.frame_end=150;bpy.context.scene.frame_set(45)
for o in bpy.context.selected_objects:o.select_set(False)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.context.scene['source_credit']='Original rig/model (c) 2022 pixiv Inc.; VRM Public License 1.0. WallSoul palette and skeletal clips are modifications. See LICENSE-model.json.'
bpy.context.scene['runtime_note']='Runtime uses the attributed VRM and normalized-bone motions.json, including spring physics and expressions. Blender Actions are editable authoring equivalents; VRM extension data stays in source VRM.'
text=bpy.data.texts.new('使用说明');text.write('幕灵骨骼动画工程\n8组可编辑Action在动作编辑器中选择。\n原始授权见 assets-source/3d/prototype-character/LICENSE-model.json。\n运行时由VRM标准骨骼加载器保留表情和头发物理。\n当前外观为风格化改编角色，不等于参考视频的写实模型。')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets-source/3d/WallSoul-animation.blend'))
print('SAVED',len(bpy.data.actions),'ACTIONS',len(rig.pose.bones),'BONES')
