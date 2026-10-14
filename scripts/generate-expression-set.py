"""Generate the ten explicitly requested candidates sequentially; stop at the first failure."""
import pathlib,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[1]
actions=['joy','anger','sadness','delight','excitement','happiness','eye-play','blush','shy','annoyed']
for index,action in enumerate(actions,1):
 path=root/'assets-source/body-motion-experiment'/(action+'-pro-v1')/'sample.mp4'
 if path.exists():print(f'{index}/10 {action}: existing candidate preserved',flush=True);continue
 print(f'{index}/10 {action}: generating',flush=True)
 result=subprocess.run([sys.executable,str(root/'scripts/generate-body-sample.py'),action,'--pro'],cwd=root)
 if result.returncode:raise SystemExit('Stopped on failure. No anonymous fallback, automatic recharge or retry.')
print('Ten candidates generated; visual review is still required.',flush=True)
