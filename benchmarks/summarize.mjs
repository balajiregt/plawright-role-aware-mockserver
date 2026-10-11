import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
export function summarize(report) {
  const rows = [];
  function walk(suite) {
    for (const child of suite.suites ?? []) walk(child);
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) for (const result of test.results ?? []) {
      if (!spec.title.includes(' | ')) continue;
      const [mode, scenario] = spec.title.replace(' @benchmark', '').split(' | ');
      const a = result.attachments?.find(a => a.name === 'benchmark-measurement');
      const measurement = a?.body ? JSON.parse(Buffer.from(a.body, 'base64').toString()) : a?.path ? JSON.parse(fs.readFileSync(a.path, 'utf8')) : null;
      rows.push({ mode, scenario, repeat: measurement?.repeat ?? test.repeatEachIndex, status: result.status, durationMs: result.duration, measurement });
    }
  }
  walk(report);
  const groups = Object.fromEntries(['legacy-interception', 'mockserver'].map(mode => {
    const selected = rows.filter(r => r.mode === mode);
    const mean = field => { const values = selected.filter(r => Number.isFinite(r.measurement?.[field])).map(r => r.measurement[field]); return values.length ? values.reduce((a,b) => a+b,0)/values.length : null; };
    const inconsistent = [...new Set(selected.map(r => r.scenario))].filter(s => new Set(selected.filter(r => r.scenario === s).map(r => r.status)).size > 1);
    return [mode, { attempted: selected.length, passed: selected.filter(r => r.status === 'passed').length, failed: selected.filter(r => ['failed','timedOut','interrupted'].includes(r.status)).length, skipped: selected.filter(r => r.status === 'skipped').length, missingMeasurements: selected.filter(r => !r.measurement).length, meanSetupMs: mean('setupMs'), meanJourneyAndOracleMs: mean('journeyAndOracleMs'), inconsistentScenarios: inconsistent, humanSetupMs: null, diagnosisMs: null }];
  }));
  return { schemaVersion: 1, benchmark: 'role-aware-local-demo-v1', evidenceKind: 'controlled-local-execution', limitations: ['Both arms use synthetic local dependencies; no real identity provider comparison.', 'Setup is programmatic setup, not human environment preparation.', 'No production stability, financial savings or diagnosis-time claim.', 'Small sequential samples; timings are descriptive, not causal speedup evidence.'], rows, groups };
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const file = process.argv[2] ?? 'benchmark-results/playwright.json';
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const summary = summarize(report);
  summary.generatedAt = new Date().toISOString();
  summary.reportSha256 = (await import('node:crypto')).createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  summary.revision = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  summary.dirty = Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim());
  fs.mkdirSync('benchmark-results',{recursive:true});
  fs.writeFileSync('benchmark-results/summary.json',JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify(summary.groups,null,2));
}
