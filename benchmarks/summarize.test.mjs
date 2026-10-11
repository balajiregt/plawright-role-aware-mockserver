import { test } from 'node:test'; import assert from 'node:assert/strict'; import { summarize } from './summarize.mjs';
test('missing evidence and failures stay in the denominator; inconsistent outcomes reported',()=>{
 const report={suites:[{specs:[{title:'mockserver | viewer @benchmark',tests:[{repeatEachIndex:0,results:[{status:'passed',duration:4,attachments:[]}]},{repeatEachIndex:1,results:[{status:'failed',duration:8,attachments:[]}]}]}]}]};
 const s=summarize(report).groups.mockserver;assert.equal(s.attempted,2);assert.equal(s.failed,1);assert.equal(s.missingMeasurements,2);assert.equal(s.meanSetupMs,null);assert.deepEqual(s.inconsistentScenarios,['viewer']);
});
