import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMetrics } from '../src/utils/calculations.js';

// Graphe minimal : start(10 X) -> p (2 min/X) -> end
export const graph = () => ({
  nodes: [
    { id: 's', type: 'startEnd', data: { type: 'start', volumeItems: [{ id: 'x', name: 'X', value: 10 }] } },
    { id: 'p', type: 'process', data: { cycleTimes: { x: 2 } } },
    { id: 'e', type: 'startEnd', data: { type: 'end' } },
  ],
  edges: [
    { id: 'a', source: 's', target: 'p', data: {} },
    { id: 'b', source: 'p', target: 'e', data: {} },
  ],
});

test('calculateMetrics ne modifie ni les nœuds ni les arêtes fournis', () => {
  const g = graph();
  const snapshot = structuredClone(g);
  const result = calculateMetrics(g.nodes, g.edges);
  assert.deepEqual(g, snapshot);
  assert.equal(result.nodes.find(n => n.id === 'p').data.process_time_total, 20);
});

test('une arête vers un nœud absent est marquée en erreur sans planter', () => {
  const g = graph();
  g.edges.push({ id: 'c', source: 'p', target: 'ghost', data: {} });
  g.edges.push({ id: 'd', source: 'ghost2', target: 'e', data: {} });
  const result = calculateMetrics(g.nodes, g.edges);
  const c = result.edges.find(e => e.id === 'c');
  const d = result.edges.find(e => e.id === 'd');
  assert.equal(c.data.isError, true);
  assert.equal(c.data.label, 'Missing step');
  assert.deepEqual(c.data.volumeStream, []);
  assert.equal(d.data.isError, true);
  // Le reste du graphe est calculé normalement
  assert.equal(result.nodes.find(n => n.id === 'e').data.volume_in, 10);
  assert.equal(result.nodes.find(n => n.id === 'p').data.process_time_total, 20);
});

test('un cycle est signalé sur ses étapes et n’empêche pas le calcul du reste', () => {
  // s -> p -> e (50 %) et s -> p -> q -> r -> q (boucle q/r, 50 %)
  const g = graph();
  g.nodes.push(
    { id: 'q', type: 'process', data: { cycleTimes: { x: 1 } } },
    { id: 'r', type: 'process', data: { cycleTimes: { x: 1 } } },
  );
  g.edges = [
    { id: 'a', source: 's', target: 'p', data: {} },
    { id: 'b', source: 'p', target: 'e', data: { percentage: 50 } },
    { id: 'c', source: 'p', target: 'q', data: { percentage: 50 } },
    { id: 'd', source: 'q', target: 'r', data: {} },
    { id: 'f', source: 'r', target: 'q', data: {} },
  ];
  const result = calculateMetrics(g.nodes, g.edges);
  for (const id of ['q', 'r']) {
    const n = result.nodes.find(n => n.id === id);
    assert.deepEqual(n.data.errors, ['Part of a loop: volume cannot be computed.']);
    assert.equal(n.data.volume_in, 0);
    assert.equal(n.data.process_time_total, 0);
  }
  assert.equal(result.edges.find(e => e.id === 'd').data.isError, true);
  assert.equal(result.edges.find(e => e.id === 'f').data.isError, true);
  assert.deepEqual([...result.metrics.cycleNodeIds].sort(), ['q', 'r']);
  // Le chemin sain est calculé
  assert.equal(result.nodes.find(n => n.id === 'p').data.process_time_total, 20);
  assert.equal(result.nodes.find(n => n.id === 'e').data.volume_in, 5);
});

test('metrics.cycleNodeIds est vide sur un graphe acyclique', () => {
  const g = graph();
  assert.deepEqual(calculateMetrics(g.nodes, g.edges).metrics.cycleNodeIds, []);
});

test('les valeurs non numériques valent 0 et n’éteignent pas la validation', () => {
  const g = graph();
  g.nodes[0].data.volumeItems[0].value = 'abc';
  g.nodes[1].data.cycleTimes.x = '';
  let result = calculateMetrics(g.nodes, g.edges);
  assert.equal(result.nodes.find(n => n.id === 'p').data.volume_in, 0);
  assert.equal(result.nodes.find(n => n.id === 'p').data.process_time_total, 0);

  // Volume valide mais pourcentage invalide : la sortie est 0 et l'écart est signalé
  const h = graph();
  h.edges[1].data.percentage = 'oops';
  result = calculateMetrics(h.nodes, h.edges);
  const b = result.edges.find(e => e.id === 'b');
  assert.equal(Number.isNaN(Number(b.data.volume)), false);
  assert.equal(b.data.isError, true);
});
