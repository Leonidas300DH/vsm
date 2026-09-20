import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProject, FILE_VERSION } from '../src/utils/projectSchema.js';
import { createExample } from '../src/data/example.js';

test('l’exemple fourni est accepté tel quel', () => {
  const result = validateProject({ meta: { version: FILE_VERSION }, ...createExample() });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.project.nodes.length, 21);
  assert.equal(result.project.edges.length, 22);
  assert.equal(result.project.title, 'KYC · Entrée en relation & vigilance renforcée');
});

test('un fichier sans nodes ou edges est refusé avec un message explicite', () => {
  assert.deepEqual(validateProject(null), { ok: false, errors: ['File is not a VSM project.'] });
  assert.equal(validateProject({ nodes: [] }).ok, false);
  assert.match(validateProject({ nodes: [] }).errors[0], /edges/);
  assert.equal(validateProject({ nodes: 'x', edges: [] }).ok, false);
});

test('les nœuds malformés sont refusés, les valeurs manquantes sont normalisées', () => {
  const bad = validateProject({ nodes: [{ id: 'a' }], edges: [] });
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /type/);

  const result = validateProject({
    nodes: [{ id: 1, type: 'process' }, { id: 'e', type: 'startEnd', data: { type: 'end' } }],
    edges: [{ source: 1, target: 'e' }],
  });
  assert.equal(result.ok, true, result.errors.join('\n'));
  const [n] = result.project.nodes;
  assert.equal(n.id, '1');
  assert.deepEqual(n.position, { x: 0, y: 0 });
  assert.deepEqual(n.data, {});
  assert.equal(result.project.edges[0].source, '1');
  assert.equal(typeof result.project.edges[0].id, 'string');
  assert.deepEqual(result.project.edges[0].data, {});
  assert.deepEqual(result.project.tools, []);
});

test('les arêtes orphelines ou en doublon sont retirées et signalées', () => {
  const result = validateProject({
    nodes: [{ id: 'a', type: 'process' }, { id: 'b', type: 'process' }],
    edges: [
      { id: 'x', source: 'a', target: 'b' },
      { id: 'x', source: 'a', target: 'b' },
      { id: 'y', source: 'a', target: 'ghost' },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.project.edges.length, 1);
  assert.equal(result.errors.length, 2);
});

test('les ressources sans id ou sans nom sont ignorées', () => {
  const result = validateProject({
    nodes: [], edges: [],
    tools: [{ id: 't1', name: 'Excel' }, { name: 'sans id' }, 'texte'],
    actors: null,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.project.tools, [{ id: 't1', name: 'Excel' }]);
  assert.deepEqual(result.project.actors, []);
});
