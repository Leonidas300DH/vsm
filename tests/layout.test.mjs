import test from 'node:test';
import assert from 'node:assert/strict';
import { horizontalLayout } from '../src/utils/layout.js';
import { createExample } from '../src/data/addressExample.js';

test('branches and convergence always advance horizontally without changing source data', () => {
  const example = createExample();
  const snapshot = structuredClone(example);
  const { nodes } = horizontalLayout(example.nodes, example.edges);
  for (const edge of example.edges) {
    const source = nodes.find(n => n.id === edge.source);
    const target = nodes.find(n => n.id === edge.target);
    assert.ok(target.position.x > source.position.x + 250, edge.id);
  }
  assert.notEqual(nodes.find(n => n.id === 'standard').position.y, nodes.find(n => n.id === 'exception').position.y);
  assert.deepEqual(example, snapshot);
});
test('cycles and invalid connections preserve manual layout by returning an error', () => {
  const { nodes, edges } = createExample();
  assert.ok(horizontalLayout(nodes, [...edges, { source: 'end', target: 'start' }]).error);
  assert.ok(horizontalLayout(nodes, [{ source: 'start', target: 'missing' }]).error);
});
test('empty maps and disconnected components are accepted', () => {
  assert.deepEqual(horizontalLayout([], []), { nodes: [] });
  const { nodes } = createExample();
  assert.equal(horizontalLayout(nodes, []).nodes.length, nodes.length);
});

test('single input and output align by their ports despite different measured heights', () => {
  const example = createExample();
  example.nodes = example.nodes.map(n => ({ ...n, height: n.id === 'start' ? 124 : n.id === 'end' ? 72 : 280 }));
  const { nodes } = horizontalLayout(example.nodes, example.edges);
  const start = nodes.find(n => n.id === 'start');
  const end = nodes.find(n => n.id === 'end');
  assert.equal(start.position.y + start.height / 2, end.position.y + end.height / 2);
});
test('multiple terminals follow their own branches, independent of array order', () => {
  const n = (id, type, y, height = 100) => ({ id, type: type ? 'startEnd' : 'process', data: { type }, position: { x: 0, y }, height });
  const input = [n('s1','start',0),n('s2','start',400),n('p1',null,0,260),n('p2',null,400,260),n('e2','end',0,70),n('e1','end',400,150)];
  const edges = [{source:'s1',target:'p1'},{source:'s2',target:'p2'},{source:'p1',target:'e1'},{source:'p2',target:'e2'}];
  const { nodes } = horizontalLayout(input, edges);
  const center = id => { const n = nodes.find(n => n.id === id); return n.position.y + (n.height - (n.type === 'process' ? 44 : 0)) / 2; };
  assert.equal(center('s1'),center('p1'));
  assert.equal(center('e1'),center('p1'));
  assert.equal(center('s2'),center('p2'));
  assert.equal(center('e2'),center('p2'));
});
