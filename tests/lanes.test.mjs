import test from 'node:test';
import assert from 'node:assert/strict';
import { assignLanes } from '../src/utils/lanes.js';
import { createExample } from '../src/data/example.js';

const kyc = () => { const e = createExample(); return { nodes: e.nodes, edges: e.edges, libraries: { tools: e.tools, actors: e.actors } }; };
const laneLabel = (r, id) => r.labels[r.lanes.get(id)];

test('vue outils : un couloir par outil dans l’ordre de la bibliothèque, étapes multi-outils signalées', () => {
  const { nodes, edges, libraries } = kyc();
  const r = assignLanes(nodes, edges, 'tools', libraries);
  assert.equal(laneLabel(r, 'intake'), 'SharePoint');
  assert.equal(laneLabel(r, 'extract'), 'OCR documentaire');
  assert.equal(laneLabel(r, 'complete'), 'Excel');
  // risk a ['kyc-case','kyc-web'] : la bibliothèque place Internet avant Excel.
  assert.equal(laneLabel(r, 'risk'), 'Internet');
  assert.deepEqual(r.multi.map(m => m.id).sort(), ['archive', 'enhanced', 'risk']);
  assert.equal(r.multi.find(m => m.id === 'risk').count, 2);
  // Les libellés suivent l'ordre de la bibliothèque, sans couloir vide.
  assert.ok(r.labels.indexOf('Internet') < r.labels.indexOf('Excel'));
  assert.ok(r.labels.includes('Outlook')); // utilisé par « Demander les compléments »
  assert.ok(!r.labels.includes('Sans outil')); // toutes les étapes KYC ont au moins un outil
  // L'entrée suit sa première étape, la sortie sa dernière.
  assert.equal(r.lanes.get('start'), r.lanes.get('intake'));
  assert.equal(r.lanes.get('end'), r.lanes.get('archive'));
});

test('vue acteurs : acteurs internes, puis équipes externes, puis sans acteur', () => {
  const { nodes, edges, libraries } = kyc();
  const r = assignLanes(nodes, edges, 'actors', libraries);
  assert.equal(laneLabel(r, 'intake'), 'Analyste KYC');
  assert.equal(laneLabel(r, 'enhanced'), 'Équipes externes');
  assert.equal(laneLabel(r, 'officer'), 'Équipes externes');
  assert.equal(laneLabel(r, 'extract'), 'Sans acteur');
  assert.deepEqual(r.labels, ['Analyste KYC', 'Équipes externes', 'Sans acteur']);
  assert.deepEqual(r.multi, []);
});

test('vue équipes : une équipe par acteur externe, le reste dans Notre équipe', () => {
  const { nodes, edges, libraries } = kyc();
  const r = assignLanes(nodes, edges, 'teams', libraries);
  assert.equal(laneLabel(r, 'enhanced'), 'Conformité');
  assert.equal(laneLabel(r, 'officer'), 'Conformité');
  assert.equal(laneLabel(r, 'intake'), 'Notre équipe');
  assert.equal(laneLabel(r, 'extract'), 'Sans acteur');
  assert.deepEqual(r.labels, ['Conformité', 'Notre équipe', 'Sans acteur']);
});

test('un acteur externe sans champ équipe forme une équipe à son nom ; une ressource inconnue est ignorée', () => {
  const nodes = [
    { id: 's', type: 'startEnd', data: { type: 'start' } },
    { id: 'p', type: 'process', data: { actorsUsed: ['ext', 'ghost'] } },
    { id: 'e', type: 'startEnd', data: { type: 'end' } },
  ];
  const edges = [{ id: 'a', source: 's', target: 'p' }, { id: 'b', source: 'p', target: 'e' }];
  const r = assignLanes(nodes, edges, 'teams', { tools: [], actors: [{ id: 'ext', name: 'Cabinet externe', scope: 'external' }] });
  assert.deepEqual(r.labels, ['Cabinet externe']);
  assert.equal(r.lanes.get('s'), 0);
  assert.equal(r.lanes.get('e'), 0);
  assert.deepEqual(r.multi, []);
});
