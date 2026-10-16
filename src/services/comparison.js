import { compareScenarios } from './project.js';
import { analyze } from './analysis.js';

export function affectedNodes(change, scenario) {
  if (change.kind === 'nodes') return scenario.nodes.some(n => n.id === change.id) ? [change.id] : [];
  if (change.kind === 'edges') {
    const edge = scenario.edges.find(e => e.id === change.id);
    return edge ? [edge.source, edge.target] : [];
  }
  const field = { tools: 'toolsUsed', actors: 'actorsUsed', knowledge: 'knowledgeUsed' }[change.kind];
  return field ? scenario.nodes.filter(n => n.data[field]?.includes(change.id)).map(n => n.id) : [];
}
export function scenarioComparison(a, b) {
  const left = analyze(a), right = analyze(b), changes = compareScenarios(a, b);
  const metrics = [
    ['workload', 'Charge / période'], ['processing', 'Processing / dossier'],
    ['waiting', 'Attente / dossier'], ['lead', 'Lead time / dossier'],
  ].map(([key, label]) => {
    const before = left[key], after = right[key];
    const delta = before == null || after == null ? null : after - before;
    return { key, label, before, after, delta, percent: delta == null || before === 0 ? null : 100 * delta / before };
  });
  return { changes, metrics, left, right };
}
