"""Export allowlisted public aggregate evidence; raw reports never enter the site."""
import argparse, datetime, hashlib, json, pathlib, math, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
REPOS={'mockserver':('Role-Aware Mockserver','plawright-role-aware-mockserver'),'harness':('Agentic Playwright','playwright-harness-framework'),'api':('Agentic API','agentic-workspace'),'jev':('JEV Review','jev-scope-qa')}
def sha(raw):return hashlib.sha256(raw).hexdigest()
def iso(ts):return datetime.datetime.fromtimestamp(ts,datetime.timezone.utc).isoformat()
def load(root,name):
 p=root/name;raw=p.read_bytes();return json.loads(raw),sha(raw),iso(p.stat().st_mtime)
def check(name,ok,detail):return {'name':name,'ok':bool(ok),'detail':detail}
def counts(report):
 rows=[]
 def walk(s):
  for child in s.get('suites',[]):walk(child)
  for spec in s.get('specs',[]):
   for test in spec.get('tests',[]):
    rows.append({'name':spec['title'],'status':test.get('results',[{}])[-1].get('status','missing') if test.get('results') else 'missing','attempts':len(test.get('results',[])),'expectedStatus':test.get('expectedStatus','passed')})
 walk(report)
 return rows

def trial_summary(root):
 records=[];errors=[]
 for p in sorted((root/'benchmark-results/trials').glob('*.json')):
  try:
   r=json.loads(p.read_text());assert r['evidenceKind'] in ('live-agent','scripted-validation');assert r['arm'] in ('baseline','framework');assert isinstance(r['repeat'],int) and r['repeat']>=0
   assert r['taskId'] in ('crm-viewer-export','crm-manager-export','crm-manager-direct-route','api-customer-risk')
   assert re.fullmatch('[a-f0-9]{64}',r['reportSha256']) and re.fullmatch('[a-f0-9]{64}',r['targetRevision']);assert isinstance(r.get('model'),str) and isinstance(r.get('modelVersion'),str)
   assert isinstance(r['checks'],list) and r['checks'];assert r['correctCompletion']==all(c['passed'] is True for c in r['checks'])
   assert isinstance(r['elapsedMs'],(int,float)) and math.isfinite(r['elapsedMs']) and r['elapsedMs']>=0
   records.append(r)
  except (ValueError,KeyError,AssertionError,TypeError):errors.append(p.name)
 groups={};seen=set()
 for r in records:
  if r['evidenceKind']!='live-agent':continue
  key=json.dumps([r['taskId'],r['model'],r['modelVersion'],r['targetRevision']]);identity=(key,r['arm'],r['repeat'])
  if identity in seen:errors.append('duplicate arm/repeat');continue
  seen.add(identity);g=groups.setdefault(key,{'task':r['taskId'],'groupId':sha(key.encode())[:12],'baseline':[],'framework':[]});g[r['arm']].append(r)
 def median(values):
  values=sorted(v for v in values if isinstance(v,(float,int)) and math.isfinite(v) and v>=0);n=len(values);return None if not n else values[n//2] if n%2 else (values[n//2-1]+values[n//2])/2
 summaries=[];paired=0
 for g in groups.values():
  pairs=len(set(r['repeat'] for r in g['baseline'])&set(r['repeat'] for r in g['framework']));paired+=pairs;out={'task':g['task'],'groupId':g['groupId'],'pairedRepeats':pairs}
  for arm in ('baseline','framework'):
   rows=g[arm];out[arm]={'trials':len(rows),'correct':sum(r['correctCompletion'] for r in rows),'medianElapsedMs':median([r['elapsedMs'] for r in rows]),'medianHumanCorrectionMs':median([r.get('humanCorrectionMs') for r in rows]),'medianIncorrectChanges':median([r.get('incorrectChanges') for r in rows]),'estimatedCostByCurrency':{}}
   for row in rows:
    cost=row.get('cost')
    if isinstance(cost,dict) and isinstance(cost.get('amount'),(int,float)) and cost['amount']>=0 and isinstance(cost.get('currency'),str) and re.fullmatch('[A-Z]{3}',cost['currency']) and math.isfinite(cost['amount']):
     currency=cost['currency'];out[arm]['estimatedCostByCurrency'][currency]=out[arm]['estimatedCostByCurrency'].get(currency,0)+cost['amount']
  summaries.append(out)
 return {'liveTrials':sum(r['evidenceKind']=='live-agent' for r in records),'scriptedValidations':sum(r['evidenceKind']=='scripted-validation' for r in records),'pairedRepeats':paired,'groups':summaries,'invalidRecords':len(errors)}

def collect(kind,root):
 title,repo=REPOS[kind];base={'project':kind,'title':title,'repository':'https://github.com/balajiregt/'+repo,'protocol':'https://github.com/balajiregt/'+repo+'/blob/main/benchmarks/README.md','checks':[],'metrics':[],'limitations':[],'cases':[]}
 def metric(label,value,unit='',note=''):base['metrics'].append({'label':label,'value':value,'unit':unit,'note':note})
 def evidence(file):
  d,h,t=load(root,file);base.setdefault('evidence',[]).append({'file':pathlib.Path(file).name,'sha256':h,'fileModifiedAt':t});return d,h,t
 try:
  if kind=='mockserver':
   summary,_,_=evidence('benchmark-results/summary.json');report,h,t=evidence('benchmark-results/playwright.json');rows=counts(report);base['checks'].append(check('Summary matches source report',summary.get('reportSha256')==h,'SHA256 comparison'));base['runAt']=summary.get('generatedAt',t);base['timeBasis']='summary generated time';base['revision']=summary.get('revision');base['dirtySource']=summary.get('dirty');base['limitations']=summary.get('limitations',[])
   groups={}
   for mode in ['legacy-interception','mockserver']:
    selected=[r for r in rows if r['name'].startswith(mode+' | ')];g=summary.get('groups',{}).get(mode,{});groups[mode]={key:g.get(key) for key in ['attempted','passed','failed','skipped','missingMeasurements','meanSetupMs','meanJourneyAndOracleMs','inconsistentScenarios']};base['checks'].append(check(mode+' denominator',g.get('attempted')==len(selected) and g.get('passed')==sum(r['status']=='passed' for r in selected),f'{len(selected)} observed journeys'))
   base['comparison']=groups;base['cases']=rows;metric('Passed checks',sum(r['status']=='passed' for r in rows),' / '+str(len(rows)));metric('Human setup effort',None,'ms');metric('Debugging time',None,'ms');base['status']='passed' if rows and all(r['status']=='passed' for r in rows) else 'failed'
  elif kind=='harness':
   report,h,t=evidence('benchmark-results/oracle.json');mutant,_,_=evidence('benchmark-results/mutation-summary.json');rawmutant,mh,_=evidence('benchmark-results/mutant.json');rows=counts(report);mutants=counts(rawmutant);base['checks'].append(check('Mutation report hash',mutant.get('reportSha256')==mh,'Summary bound to source report'));detected=mutant.get('detected') is True and len(mutants)==1 and mutants[0]['status']=='failed' and mutants[0]['name']=='viewer export denied in UI and API' and bool(re.search(r'Expected.*403.*Received.*200',json.dumps(rawmutant),re.S));base['checks'].append(check('Seeded defect observed',detected,'Intentional viewer-export bypass must fail its oracle'));base['cases']=rows;base['runAt']=report.get('stats',{}).get('startTime',t);base['timeBasis']='browser run start';metric('Passed oracle checks',sum(r['status']=='passed' for r in rows),' / '+str(len(rows)));metric('Seeded defects detected',1 if detected else 0,' / 1');trials=trial_summary(root);base['agentTrials']=trials;base['checks'].append(check('Trial records consistent',trials['invalidRecords']==0,'Duplicate pairs or malformed records do not qualify'));metric('Paired live-agent trials',trials['pairedRepeats']);metric('Scripted collector checks',trials['scriptedValidations']);metric('AI cost',None);base['status']='passed' if rows and all(r['status']=='passed' for r in rows) and detected else 'failed';base['limitations']=['One deliberately seeded defect; not a general defect detection rate.','Browser runtime is not agent task completion time.','Agent comparisons require matched task, model/version and target groups; scripted validation is separate.']
  elif kind=='api':
   report,_,t=evidence('benchmark-results/api-oracle.json');rows=counts(report);base['runAt']=t;base['timeBasis']='normalized report file modified time';base['cases']=rows
   base['checks'].append(check('Expected JUnit source',len(report.get('sourceReports',[]))==1 and report['sourceReports'][0].get('file')=='TEST-com.agentic.workspace.qa.xyz.tests.CustomerRiskApiTest.xml','Exact fixed API suite required'))
   for source in report.get('sourceReports',[]):
    name=source['file'];p=root/'projects/microservices/qa-projects/xyz-service-api-tests/target/surefire-reports'/name
    ok=pathlib.Path(name).name==name and p.is_file() and sha(p.read_bytes())==source.get('sha256');base['checks'].append(check('JUnit source: '+name,ok,'XML hash checked locally; XML not published'))
   base['checks'].append(check('Oracle has test evidence',bool(rows),'Empty evidence cannot pass'));metric('Passed API cases',sum(r['status']=='passed' for r in rows),' / '+str(len(rows)));trials=trial_summary(root);base['agentTrials']=trials;base['checks'].append(check('Trial records consistent',trials['invalidRecords']==0,'Duplicate pairs or malformed records do not qualify'));metric('Paired live-agent trials',trials['pairedRepeats']);metric('Scripted collector checks',trials['scriptedValidations']);metric('Human corrections',None);metric('AI cost',None);base['status']='passed' if rows and all(r['status']=='passed' for r in rows) else 'failed';base['limitations']=['Synthetic sample API; no production result.','Timestamp is file provenance, not measured agent elapsed time.','Agent comparisons require matched task, model/version and target groups; scripted validation is separate.']
  else:
   report,h,t=evidence('artifacts/workflow-benchmark.json');metrics,_,_=evidence('artifacts/crm-benchmark-metrics.json');rows=report.get('rows',[]);ids=[c['id'] for c in report.get('checks',[])];evaluated=sum(r['status']=='evaluated' for r in rows);errors=sum(r['status']=='error' for r in rows);base['checks'] += [check('Metrics match source report',metrics.get('reportSha256')==h,'SHA256 comparison'),check('Unique valid check identities',len(ids)==len(set(ids)) and len(rows)==len(set(r['checkId'] for r in rows)) and all(r['checkId'] in ids for r in rows),'No duplicated or unknown checks'),check('Evaluation denominator',metrics.get('overall',{}).get('evaluated')==evaluated and metrics.get('overall',{}).get('requested')==len(ids),'Requested and evaluated remain separate')];base['runAt']=report.get('generatedAt',t);base['timeBasis']='evaluator report generated time';base['status']='blocked' if errors and not evaluated else 'partial' if evaluated<len(ids) else 'completed';base['mode']=report.get('mode');metric('Evaluated checks',evaluated,' / '+str(len(ids)));metric('Operational errors',errors);metric('Not evaluated',len(ids)-evaluated-errors);m=metrics.get('overall',{}).get('metrics') or {}
   for label,key in [('Issue precision','precision'),('Issue recall','recall'),('Missed issue rate','missedIssueRate'),('False alarm rate','falseAlarmRate'),('Exact finding accuracy','exactFindingAccuracy')]:metric(label,m.get(key),'ratio')
   metric('AI cost',None);base['limitations']=metrics.get('limitations',[]);base['cases']=[{'name':r['checkId'],'status':r['status'],'errorCode':r.get('errorCode')} for r in rows];base['stages']={k:{'requested':v.get('requested'),'evaluated':v.get('evaluated')} for k,v in metrics.get('stages',{}).items()};base['notice']='Provider HTTP 403 prevented live evaluation. No model quality result.' if any(r.get('errorCode')=='http_403' for r in rows) else 'Authored synthetic evaluation; inspect coverage before interpreting findings.'
  base['checks'].append(check('No expected-failure oracles',all(r.get('expectedStatus','passed')=='passed' for r in base['cases']),'Expected failures cannot qualify as successful oracle evidence'))
  base['checks'].append(check('No oracle retries',all(r.get('attempts',1)==1 for r in base['cases']),'Retry counts checked where browser/JUnit results are supplied'))
  base['integrity']='verified' if base['checks'] and all(c['ok'] for c in base['checks']) else 'invalid'
 except (OSError,ValueError,KeyError,TypeError) as e:
  base.update(status='unavailable',integrity='invalid',notice='Required source evidence is missing or malformed. Re-import after completing the documented benchmark.',runAt=None,timeBasis='unavailable');base['checks'].append(check('Source evidence available',False,type(e).__name__))
 base['runId']=sha(json.dumps(base,sort_keys=True).encode())[:16]
 return base

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--sources',type=pathlib.Path,required=True,help='JSON mapping of exactly four repo IDs to artifact-bearing checkout paths');parser.add_argument('--output',type=pathlib.Path,default=ROOT/'public/data/benchmarks.json');args=parser.parse_args();sources=json.loads(args.sources.read_text())
 if set(sources)!=set(REPOS):raise SystemExit('Sources must map exactly mockserver, harness, api and jev')
 runs=[collect(k,pathlib.Path(sources[k]).resolve()) for k in REPOS];history=[]
 if args.output.exists():history=json.loads(args.output.read_text()).get('history',[])
 known={r['runId'] for r in history}
 for run in runs:
  if run['runId'] not in known:history.append(run);known.add(run['runId'])
 data={'schemaVersion':1,'exportedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runs':runs,'history':history[-100:],'scope':'Reviewed public aggregates from synthetic local benchmarks. No raw reports, credentials, traces, prompts or reviewer notes.'};args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(data,indent=2)+'\n');print(json.dumps({'runs':len(runs),'integrity':{r['project']:r['integrity'] for r in runs}}))
if __name__=='__main__':main()
