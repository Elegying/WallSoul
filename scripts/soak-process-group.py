"""Measure an app and WebKit processes isolated by a controlled restart.
CPU values are process CPU, not GPU utilization, temperature or whole-machine power.
"""
import csv,datetime,json,pathlib,subprocess,sys,time
root=pathlib.Path(__file__).resolve().parents[1]
baseline=root/(sys.argv[3] if len(sys.argv)>3 else 'artifacts/runtime-baseline-processes.json')
before={r['pid'] for r in json.loads(baseline.read_text())}
rows=[]
for line in subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines():
 p=line.strip().split(None,1)
 if len(p)==2 and ('WebKit' in p[1] or '/幕灵.app/' in p[1]) and int(p[0]) not in before:rows.append({'pid':int(p[0]),'command':p[1]})
assert sum('/幕灵.app/' in r['command'] for r in rows)==1, 'Expected one newly started app'
assert sum('WebContent' in r['command'] for r in rows)==2, 'Expected panel and wallpaper WebContent'
name=sys.argv[1];duration=int(sys.argv[2]) if len(sys.argv)>2 else 1800
out=root/'artifacts'/name;out.with_name(name+'.json').write_text(json.dumps({'processes':rows,'attribution':'new processes after controlled WallSoul-only restart','caveat':'CPU and RSS of this cohort; excludes physical GPU utilization and temperature'},indent=2))
pids=','.join(str(r['pid']) for r in rows);start=time.monotonic();next_report=0
phase_file=root/'artifacts/runtime-phase.txt'
with out.with_name(name+'.csv').open('w',newline='') as f:
 w=csv.writer(f);w.writerow(['utc','elapsed','phase','pid','cpu_percent','rss_kib'])
 while True:
  elapsed=time.monotonic()-start;phase=phase_file.read_text().strip() if phase_file.exists() else 'unspecified'
  data=subprocess.run(['ps','-p',pids,'-o','pid=,%cpu=,rss='],text=True,capture_output=True,check=False).stdout.splitlines();total_cpu=0;total_rss=0
  for line in data:
   pid,cpu,rss=line.split();w.writerow([datetime.datetime.now(datetime.timezone.utc).isoformat(),round(elapsed,2),phase,pid,cpu,rss]);total_cpu+=float(cpu);total_rss+=int(rss)
  f.flush()
  if len(data)!=len(rows):raise SystemExit('Process cohort changed; measurement ended without claiming survival')
  if elapsed>=next_report:print(f'{elapsed:.0f}s cohort CPU={total_cpu:.1f}% RSS={total_rss/1024:.1f}MiB phase={phase}',flush=True);next_report=elapsed+60
  if elapsed>=duration:break
  time.sleep(min(5,duration-elapsed))
print('Completed process-cohort measurement; no temperature claim.',flush=True)
