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
