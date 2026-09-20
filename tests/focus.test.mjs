import test from 'node:test';
import assert from 'node:assert/strict';
import { focusOptions, focusedNodeIds, resourceMatchesFocus } from '../src/utils/focus.js';
import { createExample } from '../src/data/example.js';

const kyc = () => { const e = createExample(); return { nodes: e.nodes, libraries: { tools: e.tools, actors: e.actors } }; };

test('les options listent les outils, les acteurs internes et les équipes externes', () => {
  const { libraries } = kyc();
  const o = focusOptions(libraries);
  assert.equal(o.tools.length, 8);
  assert.deepEqual(o.actors.map(a => a.label), ['Analyste KYC']);
  assert.deepEqual(o.teams.map(t => t.label), ['Conformité']);
  assert.deepEqual(o.teams[0], { kind: 'team', id: 'Conformité', label: 'Conformité' });
});

test('focus sur un outil : toutes les étapes qui l’utilisent, et seulement elles', () => {
  const { nodes, libraries } = kyc();
  const ids = focusedNodeIds(nodes, { kind: 'tool', id: 'kyc-web' }, libraries);
  assert.deepEqual([...ids].sort(), ['enhanced', 'risk']);
  assert.ok(!ids.has('start'));
  assert.equal(focusedNodeIds(nodes, null, libraries).size, 0);
});

test('focus sur un acteur interne et sur une équipe externe', () => {
  const { nodes, libraries } = kyc();
  const analyst = focusedNodeIds(nodes, { kind: 'actor', id: 'kyc-analyst' }, libraries);
  assert.ok(analyst.has('intake') && analyst.has('decision'));
  assert.ok(!analyst.has('enhanced') && !analyst.has('extract'));
  const team = focusedNodeIds(nodes, { kind: 'team', id: 'Conformité' }, libraries);
  assert.deepEqual([...team].sort(), ['enhanced', 'officer']);
});

test('un satellite s’allume quand il correspond au focus', () => {
  const { libraries } = kyc();
  assert.equal(resourceMatchesFocus('tools', 'kyc-web', { kind: 'tool', id: 'kyc-web' }, libraries), true);
  assert.equal(resourceMatchesFocus('tools', 'kyc-case', { kind: 'tool', id: 'kyc-web' }, libraries), false);
  assert.equal(resourceMatchesFocus('actors', 'kyc-compliance', { kind: 'team', id: 'Conformité' }, libraries), true);
  assert.equal(resourceMatchesFocus('actors', 'kyc-analyst', { kind: 'team', id: 'Conformité' }, libraries), false);
  assert.equal(resourceMatchesFocus('knowledge', 'kyc-policy', { kind: 'tool', id: 'kyc-web' }, libraries), false);
});
