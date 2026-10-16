import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {startDecomposition} from '../src/services/decomposition.js';
import {applyGroupCommand} from '../src/services/groups.js';
import {analyze} from '../src/services/analysis.js';

const fixture = () => JSON.parse(fs.readFileSync(new URL('./fixtures/simple.vsm',import.meta.url)));
test('direct decomposition starts with two connected unknown steps and preserves source calculations', () => {
  const source=fixture(), before=structuredClone(source), metrics=analyze(source);
  let seq=0;
  const draft=startDecomposition(source,'p',()=>`draft-${++seq}`);
  assert.equal(draft.nodes.length,2);
  assert.equal(draft.edges[0].source,draft.nodes[0].id);
  assert.equal(draft.edges[0].target,draft.nodes[1].id);
  assert.ok(draft.nodes.every(n=>Object.values(n.data.cycleTimes).every(v=>v===null) && n.data.wait_time===null));
  assert.deepEqual(source,before);
  const again=analyze(source);
  for(const key of ['nodes','edges','workload','processing','waiting','lead','completedVolume']) assert.deepEqual(again[key],metrics[key]);
  for(const e of source.edges) {
    if(e.target==='p') assert.equal(draft.inputs[e.id],draft.nodes[0].id);
    if(e.source==='p') assert.equal(draft.outputs[e.id],draft.nodes[1].id);
  }
  const active=applyGroupCommand(source,{type:'activateDraft',nodeId:'p',draft,acceptIncomplete:true});
  assert.equal(analyze(active).workload,null);
  assert.equal(analyze(active).completedVolume,metrics.completedVolume);
});
test('reopening a saved decomposition preserves every edit and owns independent resources', () => {
  const s=fixture(); s.tools=[{id:'custom',name:'Outil',logo:'data:image/png;base64,x'}];
  const draft=startDecomposition(s,'p');
  draft.nodes[0].data.label='Déjà éditée';
  draft.nodes[0].data.toolsUsed=['custom'];
  s.decompositionDrafts=[draft];
  const reopened=startDecomposition(s,'p',()=>{throw new Error('Must not regenerate');});
  assert.deepEqual(reopened,draft);
  reopened.tools[0].name='Copie';
  assert.equal(s.tools[0].name,'Outil');
  assert.equal(draft.tools[0].name,'Outil');
});
