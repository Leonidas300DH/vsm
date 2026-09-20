import test from 'node:test';
import assert from 'node:assert/strict';
import { createExample } from '../src/data/example.js';
import { calculateMetrics } from '../src/utils/calculations.js';
import { horizontalLayout } from '../src/utils/layout.js';
test('KYC preserves category volumes through branches and merges', () => {
 const demo = createExample();
 const result = calculateMetrics(demo.nodes, demo.edges);
 assert.equal(result.nodes.length, 21);
 assert.ok(!result.edges.some(e => e.data.isError));
 assert.ok(result.nodes.every(n => !n.data.errors?.length));
 for (const id of ['retail','business']) {
  const outputs = result.nodes.filter(n => ['end','rejected'].includes(n.id));
  const sum = outputs.reduce((s,n) => s + n.data.volumeStreamIn.find(i => i.id === id).value,0);
  assert.ok(Math.abs(sum - (id === 'retail' ? 70 : 30)) < 1e-8);
 }
 assert.ok(result.nodes.find(n => n.id === 'extract').data.process_time_total > 0);
 assert.ok(!horizontalLayout(result.nodes,result.edges).error);
 const roundtrip = JSON.parse(JSON.stringify(demo));
 assert.equal(roundtrip.nodes.filter(n=>n.data.subtype==='ai').length,3);
});
test('KYC primary route stays on a horizontal spine and supplement steps share a lower lane', () => {
 const example=createExample();
 const measured=example.nodes.map(n=>({...n,width:300,height:n.type==='process'?444:100}));
 const calculated=calculateMetrics(measured,example.edges);
 const {nodes}=horizontalLayout(calculated.nodes,calculated.edges);
 // Horizontal: resources sit beside the card, so every port is at mid-height.
 const port=id=>{const n=nodes.find(n=>n.id===id);return n.position.y+n.height/2;};
 for(const id of ['start','complete','screen','risk','standard','decision','activate','end']) assert.equal(port(id),0,id);
 assert.equal(port('request'),port('recheck'));
 assert.ok(port('request')>600);
 for(const a of nodes) for(const b of nodes) if(a.id!==b.id) assert.ok(a.position.x+a.width<=b.position.x || b.position.x+b.width<=a.position.x || a.position.y+a.height<=b.position.y || b.position.y+b.height<=a.position.y);
});
