"""Read-only all-frame mouth and eye checks for an AI video candidate; not an identity score."""
import argparse,json,math,hashlib
from pathlib import Path
import cv2,mediapipe as mp,numpy as np
p=argparse.ArgumentParser();p.add_argument('video');p.add_argument('output');args=p.parse_args()
cap=cv2.VideoCapture(args.video);fps=cap.get(cv2.CAP_PROP_FPS);rows=[];missing=[];i=0
with mp.solutions.face_mesh.FaceMesh(static_image_mode=False,max_num_faces=1,refine_landmarks=True) as face:
 while True:
  ok,frame=cap.read()
  if not ok:break
  h,w=frame.shape[:2];r=face.process(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB))
  if not r.multi_face_landmarks:missing.append(i)
  else:
   xy=np.array([[a.x*w,a.y*h] for a in r.multi_face_landmarks[0].landmark]);d=lambda a,b:float(np.linalg.norm(xy[a]-xy[b]))
   rows.append(dict(frame=i,mouthGap=d(13,14)/d(61,291),leftEye=d(159,145)/d(33,133),rightEye=d(386,374)/d(362,263),nose=xy[1].tolist(),faceWidth=d(234,454),rollDegrees=math.degrees(math.atan2(*(xy[263]-xy[33])[::-1]))))
  i+=1
assert rows,'No detected faces'
gaps=[r['mouthGap'] for r in rows];result=dict(video=args.video,videoSha256=hashlib.sha256(Path(args.video).read_bytes()).hexdigest(),fps=fps,frames=i,missing=missing,maxMouthGap=max(gaps),p95MouthGap=float(np.percentile(gaps,95)),openFrames=sum(g>.04 for g in gaps),rows=rows)
Path(args.output).write_text(json.dumps(result,indent=2)+'\n');print({k:v for k,v in result.items() if k!='rows'})
