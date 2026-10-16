import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { migrateProject, duplicateScenario, activeScenario, renameScenario, archiveScenario } from '../src/services/project.js';
import { scenarioComparison, affectedNodes } from '../src/services/comparison.js';
const raw = JSON.parse(fs.readFileSync(new URL('./fixtures/simple.vsm',import.meta.url)));

test('renaming preserves reference identity; archiving recovers active selection without data loss', () => {
  const project = migrateProject(raw), ref = project.actualScenarioId;
  const renamed = renameScenario(project, ref, 'Current State');
  assert.equal(renamed.actualScenarioId,ref);
  assert.equal(renamed.scenarios[0].name,'Current State');
  assert.equal(project.scenarios[0].name,'Baseline');
  assert.throws(()=>renameScenario(project,ref,'  '));
  assert.throws(()=>archiveScenario(project,ref));
  const copy = duplicateScenario(renamed,'Future State'), id=copy.activeScenarioId;
  const archived = archiveScenario(copy,id);
  assert.equal(archived.activeScenarioId,ref);
  assert.equal(archived.scenarios.length,2);
  assert.equal(archiveScenario(archived,id,false).scenarios[1].archived,false);
});

test('comparison is pure, identical copies have zero deltas, changes link to affected steps', () => {
  const project = migrateProject(raw), a = activeScenario(project), b = activeScenario(duplicateScenario(project,'Future'));
  const original = JSON.stringify(a);
  const identical = scenarioComparison(a,b);
  assert.equal(identical.changes.length,0);
  identical.metrics.forEach(m=>assert.ok(m.delta === 0 || m.delta === null));
  b.tools=[{id:'tool',name:'Excel'}];
  const node=b.nodes.find(n=>n.type==='process');
  node.data.toolsUsed=['tool'];
  const changed = scenarioComparison(a,b);
  assert.deepEqual(affectedNodes(changed.changes.find(c=>c.kind==='tools'),b),[node.id]);
  assert.deepEqual(affectedNodes(changed.changes.find(c=>c.kind==='tools'),a),[]);
  b.nodes=b.nodes.filter(n=>n.id!==node.id);
  b.edges=b.edges.filter(e=>e.source!==node.id&&e.target!==node.id);
  assert.ok(scenarioComparison(a,b).changes.some(c=>c.id===node.id && c.type==='suppression'));
  assert.equal(JSON.stringify(a),original);
});
