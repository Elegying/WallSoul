"""Read-only measurement of one running WallSoul main process; excludes WebKit XPC memory."""
import csv, datetime, pathlib, subprocess, sys, time
pid = int(sys.argv[1]); seconds = int(sys.argv[2]) if len(sys.argv)>2 else 1800
path = pathlib.Path(sys.argv[3]) if len(sys.argv)>3 else pathlib.Path('docs/soak-main-process.csv')
start = time.monotonic()
with path.open('w',newline='') as f:
    writer=csv.writer(f);writer.writerow(['utc','elapsed_seconds','pid','cpu_percent','rss_kib','threads'])
    while True:
        elapsed=round(time.monotonic()-start,1)
        result=subprocess.run(['ps','-p',str(pid),'-o','%cpu=,rss=,thcount='],text=True,capture_output=True)
        if result.returncode or not result.stdout.strip():
            result=subprocess.run(['ps','-p',str(pid),'-o','%cpu=,rss='],text=True,capture_output=True)
        values=result.stdout.split()
        if len(values)<2: raise SystemExit('WallSoul process exited before soak completed')
        writer.writerow([datetime.datetime.now(datetime.timezone.utc).isoformat(),elapsed,pid,*values[:2],values[2] if len(values)>2 else 'unavailable']);f.flush()
        print(f'{elapsed:.0f}s CPU={values[0]}% RSS={int(values[1])/1024:.1f}MiB',flush=True)
        if elapsed>=seconds:break
        time.sleep(min(30,seconds-elapsed))
print(f'PASS {seconds}-second process survival; interactive and WebKit results are recorded separately.',flush=True)
