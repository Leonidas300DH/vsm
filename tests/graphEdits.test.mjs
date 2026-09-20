import test from 'node:test';
import assert from 'node:assert/strict';
import { removeNodes, restoreRemoved } from '../src/utils/graphEdits.js';
import { createExample } from '../src/data/example.js';

test('supprimer une étape retire ses connexions et renvoie de quoi annuler', () => {
  const { nodes, edges } = createExample();
  const result = removeNodes(nodes, edges, ['risk']);
  assert.equal(result.nodes.length, nodes.length - 1);
  assert.ok(!result.nodes.some(n => n.id === 'risk'));
  assert.ok(!result.edges.some(e => e.source === 'risk' || e.target === 'risk'));
  assert.deepEqual(result.removed.nodes.map(n => n.id), ['risk']);
  assert.deepEqual(result.removed.edges.map(e => e.id).sort(), ['provider-risk', 'risk-enhanced', 'risk-standard']);
  // Les entrées ne sont pas modifiées.
  assert.equal(nodes.length, 21);
  assert.equal(edges.length, 22);
});

test('annuler restaure l’étape et ses connexions à l’identique', () => {
  const { nodes, edges } = createExample();
  const removal = removeNodes(nodes, edges, ['risk']);
  const restored = restoreRemoved(removal.nodes, removal.edges, removal.removed);
  assert.deepEqual([...restored.nodes].sort((a, b) => a.id.localeCompare(b.id)), [...nodes].sort((a, b) => a.id.localeCompare(b.id)));
  assert.deepEqual([...restored.edges].sort((a, b) => a.id.localeCompare(b.id)), [...edges].sort((a, b) => a.id.localeCompare(b.id)));
});

test('annuler ignore une connexion dont l’autre extrémité a disparu entre-temps, et ne duplique rien', () => {
  const { nodes, edges } = createExample();
  const first = removeNodes(nodes, edges, ['risk']);
  const second = removeNodes(first.nodes, first.edges, ['standard']);
  const restored = restoreRemoved(second.nodes, second.edges, first.removed);
  assert.ok(restored.nodes.some(n => n.id === 'risk'));
  assert.ok(!restored.edges.some(e => e.id === 'risk-standard'));
  assert.ok(restored.edges.some(e => e.id === 'risk-enhanced'));
  const again = restoreRemoved(restored.nodes, restored.edges, first.removed);
  assert.equal(again.nodes.length, restored.nodes.length);
  assert.equal(again.edges.length, restored.edges.length);
});
