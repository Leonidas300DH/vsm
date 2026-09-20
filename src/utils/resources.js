export const resourceKinds = {
  tools: { label: 'Outils', field: 'toolsUsed' },
  actors: { label: 'Acteurs', field: 'actorsUsed' },
  knowledge: { label: 'Connaissances', field: 'knowledgeUsed' },
};
export function referencedResources(nodes, kind, id) {
  return nodes.filter(n => (n.data[resourceKinds[kind].field] || []).includes(id));
}
export function mergeResources(current, incoming = []) {
  const byId = new Map(current.map(r => [r.id, r]));
  incoming.forEach(r => byId.set(r.id, { ...byId.get(r.id), ...r }));
  return [...byId.values()];
}
