import { analyze } from './analysis.js';

// A connected starting sketch, not an invented distribution of work or capacity.
export function startDecomposition(scenario, nodeId, makeId = () => crypto.randomUUID()) {
  const saved = scenario.decompositionDrafts?.find(d => d.nodeId === nodeId);
  if (saved) return structuredClone(saved);
  const reference = scenario.nodes.find(n => n.id === nodeId);
  if (!reference || reference.type !== 'process') throw new Error('Choisissez une étape de traitement.');
  const categories = analyze(scenario).nodes.find(n => n.id === nodeId)?.categories || [];
  const nodes = [0, 1].map(i => ({
    id:makeId(), type:'process', position:{x:reference.position.x + i * 900, y:reference.position.y},
    data:{label:`Sous-étape ${i+1}`,cycleTimes:Object.fromEntries(categories.map(c => [c.category,null])), wait_time:null, executionMode:'step'},
  }));
  return structuredClone({
    id:nodeId, nodeId, reference, nodes,
    edges:[{id:makeId(),source:nodes[0].id,target:nodes[1].id,type:'flow',data:{routingType:'global',percentage:100,wait_time:0}}],
    inputs:Object.fromEntries(scenario.edges.filter(e => e.target === nodeId).map(e => [e.id,nodes[0].id])),
    outputs:Object.fromEntries(scenario.edges.filter(e => e.source === nodeId).map(e => [e.id,nodes[1].id])),
    tools:scenario.tools || [], actors:scenario.actors || [], knowledge:scenario.knowledge || [],
  });
}
