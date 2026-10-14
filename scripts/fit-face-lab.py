"""Fit a depth face mesh to the accepted portrait. No camera or user audio is read."""
import pathlib,json,hashlib
import cv2,mediapipe as mp
root=pathlib.Path(__file__).resolve().parents[1];source=root/'resources/characters/soul/neutral.png'
img=cv2.cvtColor(cv2.imread(str(source)),cv2.COLOR_BGR2RGB);h,w=img.shape[:2]
with mp.solutions.face_mesh.FaceMesh(static_image_mode=True,max_num_faces=1,refine_landmarks=True) as detector:
 result=detector.process(img)
assert result.multi_face_landmarks,'Reference face not detected'
points=[[p.x*w,p.y*h,-p.z*w] for p in result.multi_face_landmarks[0].landmark[:468]]
triangles=[]
for line in (root/'assets-source/face-lab/canonical-face.obj').read_text().splitlines():
 if line.startswith('f '):triangles.extend([int(v.split('/')[0])-1 for v in line.split()[1:]])
assert max(triangles)<468 and len(triangles)%3==0
oval=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]
doc=dict(width=w,height=h,points=points,triangles=triangles,oval=oval,referenceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),scope='Projected original texture on a fitted depth mesh. Front-view prototype; not a full reconstructed character.',topologySource='https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj')
(root/'resources/face-lab/face.json').write_text(json.dumps(doc))
print('Fitted',len(points),'points',len(triangles)//3,'triangles; mouth landmarks',points[13],points[14])
