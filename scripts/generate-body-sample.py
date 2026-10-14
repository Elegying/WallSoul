"""User-authorized PRO image-to-video candidates. Never replace accepted assets automatically."""
import argparse
import hashlib
import json
import os
import math
import shutil
from pathlib import Path

os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN'] = '1'
from gradio_client import Client, handle_file

root = Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('action', choices=['resting-natural','wave','warm-smile','attentive','hair-tuck-hq','joy','anger','sadness','delight','excitement','happiness','eye-play','blush','shy','annoyed','speaking-soft-a','speaking-soft-b','speaking-soft-c','speaking-soft-d','speaking-soft-e','listening-soft','listening-tilt','listening-nod','listening-warm','smile-teeth'])
parser.add_argument('--pro',action='store_true',help='Use explicitly configured local PRO credential')
parser.add_argument('--revision', type=int, default=1)
parser.add_argument('--seed', type=int, default=271828)
parser.add_argument('--guidance', type=float, default=1)
parser.add_argument('--steps', type=int, default=8)
parser.add_argument('--duration', type=float, default=3.5)
options=parser.parse_args();action=options.action
if not math.isfinite(options.guidance) or not 0<=options.guidance<=10 or not 1<=options.steps<=30 or not math.isfinite(options.duration) or not .5<=options.duration<=10:
    parser.error('Generation parameters exceed the verified service limits.')
if not options.pro:raise SystemExit('Use --pro to explicitly authorize the configured account.')
from huggingface_hub import HfApi
credential=root/'.local-hf/token'
if not credential.is_file():raise SystemExit('Local Hugging Face credential is missing.')
token=credential.read_text().strip()
try: account=HfApi().whoami(token=token)
except Exception:raise SystemExit('Hugging Face authentication failed; credential was not logged.')
if not account.get('isPro'):raise SystemExit('The configured account is not PRO; no generation submitted.')
actions={
 'resting-natural':'She rests quietly with a neutral relaxed face and softly closed lips. Only barely perceptible slow breathing in her upper chest and shoulders, a single ordinary blink and tiny involuntary postural adjustments. Head stays upright and almost completely still, eyes calmly forward. No nodding, no tilting, no acknowledgement, no smiling, no emotion change, no hand gestures. This is a candid person at rest, not performing or actively listening.',
 'speaking-soft-a':'She speaks very softly with tiny subtle lip articulations, lips staying almost together. Never show teeth or tongue, never open her mouth wide. Very small natural lower-lip and chin motion, calm direct eye contact, almost still head. Quiet conversational delivery, no smiling while speaking.',
 'speaking-soft-b':'She softly responds with a short calm phrase, making gentle tiny lip movements with the lips almost together, without any visible teeth or tongue. A tiny relaxed eyebrow lift and barely perceptible nod, direct eye contact. Keep the mouth opening extremely small throughout.',
 'speaking-soft-c':'She calmly explains a short thought with tiny soft lip movements, lips almost touching at all times, no visible teeth or tongue. Her eyes stay on the viewer, a slight gentle eyebrow movement and natural breathing. No broad smile or large head motion.',
 'listening-tilt':'She silently listens with steady direct eye contact and closed relaxed lips. Slowly tilt her head a few degrees toward her right shoulder with a subtly curious eyebrow lift, blink naturally, then gently return upright. No speaking or mouth articulation.',
 'listening-nod':'She silently listens with steady direct eye contact and closed relaxed lips. Make two tiny slow acknowledging nods with a relaxed neck and shoulders, then settle upright. No speaking or mouth articulation.',
 'listening-warm':'She silently listens with steady direct eye contact and closed relaxed lips. Her cheeks and eyes soften into a restrained warm closed-mouth smile, a relaxed breath and subtle shoulder settling, then return to neutral. No speech, laughter or visible teeth.',
 'listening-soft':'She quietly listens to the viewer with steady warm direct eye contact, lips softly closed, one very slight acknowledgement nod and a natural blink. No speech, no teeth, no side glance, no large head movement.',
 'smile-teeth':'She gently develops a warm natural smile, briefly revealing a small amount of clean neatly aligned white upper teeth only while smiling, cheeks and eyes soften, then the smile slowly relaxes and lips close. No talking, no large mouth opening.',
 'joy':'Her eyes brighten and she forms a small pleased smile, a subtle eyebrow lift, then relaxes. Quiet pleasant joy.',
 'anger':'Her eyebrows draw together into a distinct serious angry frown, lips press gently together, gaze stays steady at the camera, then she relaxes. No shouting or aggressive gesture.',
 'sadness':'Her inner eyebrows lift slightly, eyes soften and turn downcast, lips form a subtle sad expression, then she slowly returns her gaze to the camera. No tears.',
 'delight':'She smiles with clear amusement, cheeks lift and eyes narrow gently in a cheerful almost-laugh, shoulders make one tiny relaxed bounce, then she settles.',
 'excitement':'She opens her eyes a little wider with an enthusiastic bright smile and a slight eager forward lean, eyebrows rise, then she calmly settles back.',
 'happiness':'She gives a soft contented smile, eyelids relax, head tilts very slightly as if enjoying a peaceful happy moment, then returns upright.',
 'eye-play':'She makes gentle playful eye contact, gives one brief natural wink, then opens both eyes and returns to a relaxed smile. Keep head almost still.',
 'blush':'A subtle natural rosy blush slowly appears on her cheeks as she gives a small warm smile, then softly fades back to the original skin tone. No exaggerated makeup or painted marks.',
 'shy':'She smiles shyly, briefly lowers her eyes and chin, then slowly looks back toward the camera with a small reserved smile.',
 'annoyed':'She gives a mild sulky pout, eyebrows tighten slightly with a brief sideways glance, then she returns to the camera and relaxes. Gentle annoyed expression, distinct from strong anger.',

 'hair-tuck-hq':'She slowly raises her right hand, gently tucks a small strand of hair behind her right ear, then lowers her hand completely back to the original resting position. One continuous relaxed movement with natural finger articulation. Keep her face sharp and stable, with a subtle closed-mouth smile.',
 'wave':'She keeps her elbow close to her torso and raises her right hand just in front of her shoulder, gives one very small friendly wave with relaxed fingers, then slowly lowers her hand to the original resting position. The entire elbow, forearm, hand and all fingers must remain fully inside the frame with generous clear green margins on both sides at all times. No extended sideways arm. A subtle closed-mouth smile and natural shoulder movement.',
 'warm-smile':'She gives a warm closed-mouth smile, briefly lowers her gaze with a gentle relaxed shoulder movement, then looks back toward the camera and returns to her original relaxed expression and posture. Both hands stay down, mouth closed throughout.',
 'attentive':'She leans forward very slightly with an attentive head tilt, gently nods once, then smoothly returns to the original upright posture. Both hands remain relaxed and down. Her expression is calm and engaged, mouth closed throughout.'}
out = root / 'assets-source/body-motion-experiment' / (action+'-pro-v'+str(options.revision))
if (out / 'sample.mp4').exists(): raise SystemExit('Existing sample preserved; select another action.')
out.mkdir(parents=True, exist_ok=True)
source = root / 'resources/characters/soul/neutral.png'
source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
review_file=root/'assets-source/body-motion-experiment/reviewed-set.json'
if review_file.is_file() and json.loads(review_file.read_text())['referenceSha256']!=source_hash:
    raise SystemExit('Character reference changed; no generation submitted. Review the original identity first.')
if action=='listening-nod' and options.revision >= 2:
    actions[action]='Her lips remain pressed gently together continuously throughout the entire clip. She makes one slow shallow vertical head dip in acknowledgement, then gently returns upright, keeping her eyes oriented toward the camera. Completely silent, mouth stays shut, no lip articulation or smile. Natural breathing.'
if action=='resting-natural' and options.revision>=3:
    actions[action]='A silent candid portrait of a person resting between conversations. Her upper and lower lips remain gently touching, continuously sealed for every frame. Her jaw stays relaxed and still. Only one quiet slow breath subtly moves the upper chest and shoulders, with one ordinary spontaneous blink. Eyes rest on the viewer; head, hair and hands stay nearly still. Expression stays neutral and calm. No conversational performance, no acknowledgement or deliberate gesture. Finish the breath and settle softly without freezing.'
if action.startswith('speaking-') and options.revision >= 2:
    actions[action] = 'She murmurs quietly with tiny relaxed lip movements. Her lips part only a few millimeters, briefly revealing a subtle sliver of upper teeth, never a full row of lower teeth. Gentle natural conversational articulation, no jaw drop, no broad smile. Calm eye contact, natural blinking and gentle breathing. ' + {'speaking-soft-a':'Almost still head.', 'speaking-soft-b':'One barely perceptible eyebrow lift.', 'speaking-soft-c':'A tiny slow nod.', 'speaking-soft-d':'A very small gentle head tilt to her right as she responds thoughtfully, then smoothly return upright. Keep looking at the viewer.', 'speaking-soft-e':'Two tiny calm acknowledgement nods with a subtle eyebrow lift as she quietly explains, then settle back to the original posture.'}[action]
prompt = ('Locked camera, seamless natural portrait animation of exactly the same young adult woman in the reference image. '
          'Preserve her exact face, short black bob haircut, black long-sleeved sweater, body proportions and lighting. '
          + actions[action] + ' Natural breathing, lifelike eyes. Waist-up framing. ' + ('' if action in ['hair-tuck-hq','wave'] else 'Both arms stay relaxed at the sides and both hands stay below the frame throughout. Facial expression only. ') + 'Return completely to the exact original neutral facial expression, head angle and resting posture before the final frame. '
          'Keep the flat bright green chroma-key background completely unchanged. ' + ('' if action.startswith('speaking-') else 'No talking. ') + 'No camera movement, no cuts.')
if action=='resting-natural' and options.revision>=4:
    prompt='固定镜头，参考图中完全相同的成年女性安静站立，保持相同的五官、短黑发、黑色长袖衣服、身体比例和光照。她的嘴唇始终轻轻合拢，保持平和的原有表情。头部保持原来的角度，仅肩胸随着缓慢呼吸极轻微起伏，自然眨眼一次。手臂一直放松垂下。纯绿色背景不变，镜头不移动。最后自然停留在开始时的姿态。'
if action=='resting-natural' and options.revision>=6:
    prompt=prompt.replace('自然眨眼一次','眼睛保持自然睁开，视线稳定')
if action=='resting-natural' and options.revision>=7:
    prompt='固定机位的安静肖像短片。参考图中完全相同的成年女性保持原来的头部角度和视线，嘴唇始终轻轻合拢。头部稳定不动，仅胸腔有极其轻微、缓慢的自然呼吸，肩膀放松，双臂自然垂下。眼睛自然睁开，表情平和。原有五官、发型、衣服、光照和纯绿色背景保持一致。整个过程中身体位置稳定，最后保持原来的姿态。'
args = dict(prompt=prompt, steps=options.steps, negative_prompt=('talking, speech, singing, lip articulation, open mouth, visible teeth, tongue, jaw movement, nodding, head tilting, broad smile, hand gesture, ' if action=='resting-natural' and options.revision>=3 else '')+('talking, speech, open mouth, teeth, lip articulation, ' if action.startswith('listening-') and options.revision>=2 else '')+('wide open mouth, exposed lower teeth, exaggerated articulation, jaw drop, laughing, broad smile, ' if action.startswith('speaking-') and options.revision >= 2 else '')+'blur, soft focus, loss of facial detail, motion blur, distorted face, identity change, extra fingers, fused fingers, deformed hands, flickering, jitter, camera motion, zoom, text, watermark, background changes',
            duration_seconds=options.duration, guidance_scale=options.guidance, guidance_scale_2=options.guidance, seed=options.seed,
            randomize_seed=False, quality=9, scheduler='UniPCMultistep', flow_shift=3,
            frame_multiplier=32, video_component=True, safe_mode=True)
if action=='resting-natural' and options.revision>=6:
    args['negative_prompt']='blinking, winking, closed eyes, repeated eye closures, '+args['negative_prompt']
if action=='resting-natural' and options.revision>=7:
    args['negative_prompt']='head turning, head rotation, head bobbing, tilting, swaying, leaning, looking around, posing, '+args['negative_prompt']
(out / 'request.json').write_text(json.dumps(dict(service='https://huggingface.co/spaces/kulkas2pintu/wan555', source=str(source.relative_to(root)), sourceSha256=source_hash, **args), ensure_ascii=False, indent=2))
client = Client('https://kulkas2pintu-wan555.hf.space/', token=token, verbose=False,
                analytics_enabled=False, download_files=str(out / 'downloads'))
job = client.submit(input_image=handle_file(str(source)), last_image=handle_file(str(source)), **args, api_name='/generate_video')
print('Submitted one PRO candidate; waiting up to 10 minutes.', flush=True)
try:
    result = job.result(timeout=600)
    (out / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    video = result[1] or result[0]['video']
    shutil.copy2(video, out / 'sample.mp4')
    print(str(out / 'sample.mp4'), flush=True)
except Exception as error:
    job.cancel()
    (out / 'error.txt').write_text(str(error).replace(token,'[REDACTED]'))
    raise SystemExit('Generation failed; see the redacted error record. No automatic retry.')
