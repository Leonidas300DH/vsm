import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeResources, referencedResources } from '../src/utils/resources.js';
import { calculateMetrics } from '../src/utils/calculations.js';
import { createExample } from '../src/data/example.js';

test('libraries merge without losing unrelated entries or metadata', () => {
  assert.deepEqual(mergeResources([{id:'a', name:'Old', custom:42},{id:'b',name:'Keep'}], [{id:'a',name:'New'}]), [{id:'a',name:'New',custom:42},{id:'b',name:'Keep'}]);
});
test('resource references survive file roundtrip and never change flow metrics', () => {
  const demo = createExample();
  const copy = JSON.parse(JSON.stringify(demo));
  assert.ok(referencedResources(copy.nodes, 'actors', 'kyc-analyst').length);
  assert.ok(copy.nodes.every(n => (n.data.toolsUsed || []).every(id => copy.tools.some(t=>t.id===id))));
  const before = calculateMetrics(copy.nodes, copy.edges).metrics;
  copy.nodes.forEach(n => { n.data.actorsUsed=[]; n.data.toolsUsed=[]; n.data.knowledgeUsed=[]; });
  assert.deepEqual(calculateMetrics(copy.nodes,copy.edges).metrics,before);
});
test('executed IT and external steps carry process time while legacy support remains unchanged', () => {
  for (const subtype of ['it','actor']) {
    const nodes = [
      {id:'s',type:'startEnd',data:{type:'start',volumeItems:[{id:'x',name:'X',value:10}]}},
      {id:'p',type:'process',data:{subtype,executionMode:'step',cycleTimes:{x:2},wait_time:3}},
      {id:'e',type:'startEnd',data:{type:'end'}},
    ];
    const edges = [{id:'a',source:'s',target:'p',data:{}},{id:'b',source:'p',target:'e',data:{}}];
    const current = calculateMetrics(nodes,edges);
    assert.equal(current.nodes.find(n=>n.id==='p').data.process_time_total,20);
    assert.equal(current.nodes.find(n=>n.id==='e').data.volume_in,10);
    assert.equal(current.metrics.totalLeadTime,23);
    delete nodes[1].data.executionMode;
    assert.equal(calculateMetrics(nodes,edges).nodes.find(n=>n.id==='p').data.process_time_total,0);
  }
});
