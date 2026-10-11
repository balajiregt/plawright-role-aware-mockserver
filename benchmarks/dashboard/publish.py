"""Publish only allowlisted aggregate evidence to this project's results branch."""
import base64, datetime as dt, hashlib, json, math, os, pathlib, re, subprocess, sys, tempfile
from import_benchmarks import collect, REPOS
HERE = pathlib.Path(__file__).resolve().parent
BRANCH = 'benchmark-results'

def now(): return dt.datetime.now(dt.timezone.utc).isoformat()
def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp'); temp.write_text(json.dumps(value, indent=2, allow_nan=False)+'\n'); temp.replace(path)
def git(args, cwd, env=None, allowed=(0,)):
    p = subprocess.run(['git', *args], cwd=cwd, env=env, capture_output=True, text=True, timeout=90)
    if p.returncode not in allowed: raise RuntimeError('Git operation failed: '+args[0]+' (check credentials, connectivity and branch permissions)')
    return p

def sanitize(value, vocabulary, field=None):
    """Closed text vocabulary: free-form report text, arbitrary keys and paths cannot escape."""
    if value is None or isinstance(value, bool): return value
    if isinstance(value, (int, float)):
        if not math.isfinite(value) or value < 0: raise ValueError('Invalid numeric evidence')
        return value
    if isinstance(value, str):
        if value in vocabulary: return value
        if field in ('sha256','revision','runId','groupId') and re.fullmatch(r'[a-f0-9]{12,64}', value): return value
        if field in ('runAt','fileModifiedAt','startedAt','finishedAt') and re.fullmatch(r'\d{4}-\d\d-\d\dT[0-9:.]+(?:Z|\+00:00)', value): return value
        if field in ('unit','detail') and re.fullmatch(r' / \d{1,5}|\d{1,5} observed journeys', value): return value
        return '[withheld]'
    if isinstance(value, list): return [sanitize(v, vocabulary, field) for v in value]
    if isinstance(value, dict):
        if any(k not in vocabulary and not (field=='estimatedCostByCurrency' and re.fullmatch(r'[A-Z]{3}', k)) for k in value): raise ValueError('Unexpected public field')
        return {k:sanitize(v, vocabulary, k) for k,v in value.items()}
    raise ValueError('Unsupported evidence value')

def export(root, project):
    receipt = json.loads((root/'benchmark-results/dashboard-execution.json').read_text())
    if receipt.get('project') != project: raise ValueError('Execution receipt does not belong to project')
    run = collect(project, root)
    expected = set(json.loads((HERE/'config.json').read_text())['expectedCases'])
    names = [r['name'] for r in run['cases']]
    protocol = set(names) == expected and (len(names)==len(expected) if project!='mockserver' else len(set(names.count(n) for n in expected))==1)
    run['checks'].append({'name':'Evidence matches the fixed benchmark protocol','ok':protocol,'detail':'Case identities and counts checked against the versioned synthetic protocol'})
    # Require every consumed source to belong to this attempt. Missing files cannot revive old success.
    fresh = bool(run.get('evidence')) and all(dt.datetime.fromisoformat(e['fileModifiedAt']).timestamp() >= dt.datetime.fromisoformat(receipt['startedAt']).timestamp()-1 for e in run.get('evidence', []))
    complete = receipt.get('finishedAt') is not None
    run['checks'].append({'name':'Evidence belongs to this attempt','ok':fresh and complete,'detail':'All required source files were regenerated during this run'})
    run['execution'] = {k:receipt.get(k) for k in ('startedAt','finishedAt','exitCode','revision','dirtySource')}
    run['runAt'] = receipt['startedAt']; run['timeBasis'] = 'benchmark attempt start'
    run['revision'] = receipt.get('revision'); run['dirtySource'] = receipt.get('dirtySource')
    if not fresh or not complete:
        run.update(status='unavailable', integrity='invalid', metrics=[], cases=[], evidence=[], limitations=[], notice='Current attempt did not produce complete fresh evidence. Previous results remain in history.')
        for key in ('comparison','agentTrials','stages'): run.pop(key,None)
    elif receipt['exitCode'] != 0 and run['status'] not in ('blocked','partial','unavailable'):
        run['status'] = 'failed'
    if not all(c['ok'] for c in run['checks']): run['integrity'] = 'invalid'
    vocabulary = set(json.loads((HERE/'public-vocabulary.json').read_text()))
    safe = sanitize(run, vocabulary)
    safe['runId'] = hashlib.sha256(json.dumps(safe,sort_keys=True).encode()).hexdigest()[:16]
    return safe

def merge(previous, run):
    if previous and (previous.get('schemaVersion') != 1 or previous.get('project') != run['project']): raise ValueError('Incompatible results branch')
    history = {r['runId']:r for r in (previous or {}).get('history',[])}
    history[run['runId']] = run
    ordered = sorted(history.values(), key=lambda r:(r.get('runAt') or '',r.get('execution',{}).get('finishedAt') or '',r['runId']))[-50:]
    return {'schemaVersion':1,'project':run['project'],'updatedAt':now(),'run':ordered[-1],'history':ordered}

def publish(run, remote):
    env = dict(os.environ, GIT_TERMINAL_PROMPT='0')
    # The Actions token stays in the subprocess environment; never in URLs, argv, files or output.
    if os.environ.get('GITHUB_ACTIONS') == 'true':
        token = os.environ.get('GH_BENCHMARK_TOKEN')
        if not token: raise RuntimeError('Missing Actions publication token')
        auth = base64.b64encode(('x-access-token:'+token).encode()).decode()
        n = int(env.get('GIT_CONFIG_COUNT','0')); env.update({'GIT_CONFIG_COUNT':str(n+1),f'GIT_CONFIG_KEY_{n}':'http.https://github.com/.extraheader',f'GIT_CONFIG_VALUE_{n}':'AUTHORIZATION: basic '+auth})
    with tempfile.TemporaryDirectory(prefix='benchmark-publication-') as folder:
        git(['init','--quiet',folder], folder, env)
        git(['config','user.name','Benchmark publisher'], folder, env)
        git(['config','user.email','benchmark-publisher@users.noreply.github.com'], folder, env)
        git(['remote','add','origin',remote], folder, env)
        for attempt in range(3):
            exists = git(['ls-remote','--exit-code','--heads','origin',BRANCH], folder, env, (0,2)).returncode == 0
            previous = None
            if exists:
                git(['fetch','--quiet','origin',BRANCH], folder, env)
                git(['checkout','--quiet','-B',BRANCH,'FETCH_HEAD'], folder, env)
                file = pathlib.Path(folder)/'latest.json'
                previous = json.loads(file.read_text()) if file.exists() else None
            else:
                git(['checkout','--quiet','--orphan',BRANCH], folder, env)
            # Re-running publish for the same attempt does not create duplicate commits.
            if any(r['runId']==run['runId'] for r in (previous or {}).get('history',[])): return 'already published'
            write(pathlib.Path(folder)/'latest.json', merge(previous,run))
            git(['add','latest.json'], folder, env)
            git(['commit','--quiet','-m','Publish '+run['project']+' benchmark '+run['runId']], folder, env)
            p = git(['push','--quiet','origin','HEAD:refs/heads/'+BRANCH], folder, env, (0,1,128))
            if p.returncode == 0: return 'published'
            # Fetch/merge/retry resolves concurrent writers; pushes are never forced.
        raise RuntimeError('Publication failed after three attempts; run npm run benchmark:publish to retry')

def main():
    root = HERE.parents[1]
    project = json.loads((HERE/'config.json').read_text())['project']
    if '--refresh-trials' in sys.argv:
        receipt_path = root/'benchmark-results/dashboard-execution.json'
        receipt = json.loads(receipt_path.read_text())
        if receipt.get('finishedAt') is None or receipt.get('exitCode') != 0: raise ValueError('A completed benchmark is required before trial publication')
        receipt['finishedAt'] = now()
        write(receipt_path,receipt)
    run = export(root, project)
    pending = root/'benchmark-results/dashboard-pending.json'; write(pending,run)
    if os.environ.get('BENCHMARK_PUBLISH') == '0':
        print('Public aggregate prepared; publication disabled for this invocation.'); return
    remote = 'https://github.com/balajiregt/'+REPOS[project][1]+'.git'
    result = publish(run,remote)
    pending.unlink(missing_ok=True)
    print('Dashboard '+result+': '+project+' / '+run['status']+' / '+run['runId'])
if __name__ == '__main__':
    try: main()
    except Exception as exc:
        print('Dashboard publication unsuccessful: '+str(exc) if isinstance(exc,RuntimeError) else 'Dashboard publication unsuccessful: invalid or missing evidence; inspect local artifacts.')
        raise SystemExit(1)
