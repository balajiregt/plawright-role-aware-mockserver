"""Canonical benchmark runner; always prepare/publicise its attempt, including failures."""
import datetime as dt, json, os, pathlib, signal, subprocess, sys
from publish import git, main as publish, now, write
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[1]

def execute(command):
    child=subprocess.Popen(command,cwd=ROOT,start_new_session=True)
    try: return child.wait(timeout=900)
    except (subprocess.TimeoutExpired, KeyboardInterrupt):
        os.killpg(child.pid,signal.SIGTERM)
        try:child.wait(timeout=10)
        except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
        return 124

def main():
    config=json.loads((HERE/'config.json').read_text());out=ROOT/'benchmark-results';out.mkdir(exist_ok=True)
    lock=out/'dashboard-run.lock'
    try:fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY)
    except FileExistsError:raise SystemExit('A benchmark is already running. If its process died, remove benchmark-results/dashboard-run.lock before retrying.')
    os.close(fd)
    code=1;publication=1
    try:
        revision=git(['rev-parse','--verify','HEAD'],ROOT,allowed=(0,128)).stdout.strip() or None
        dirty=bool(git(['status','--porcelain'],ROOT).stdout.strip())
        receipt={'project':config['project'],'startedAt':now(),'finishedAt':None,'exitCode':None,'revision':revision,'dirtySource':dirty}
        write(out/'dashboard-execution.json',receipt)
        for name in config['outputs']:(ROOT/name).unlink(missing_ok=True)
        codes=[]
        for command in config['steps']:
            try:codes.append(execute(command))
            except OSError:codes.append(127)
        code=next((c for c in codes if c!=0),0)
        receipt.update(finishedAt=now(),exitCode=code if code>=0 else 128-code)
        write(out/'dashboard-execution.json',receipt)
        try:publish();publication=0
        except Exception:print('Dashboard publication failed. Evidence is retained locally; retry npm run benchmark:publish.',file=sys.stderr)
    finally:lock.unlink(missing_ok=True)
    return code or publication
if __name__=='__main__':sys.exit(main())
