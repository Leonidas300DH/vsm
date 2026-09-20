// Pure helpers for reversible graph edits. The store applies them, then recalculates metrics.

// Removes nodes and every edge touching them. `removed` is what undo needs to put back.
export function removeNodes(nodes, edges, ids) {
  const gone = new Set(ids);
  const removedNodes = nodes.filter(n => gone.has(n.id));
  const removedEdges = edges.filter(e => gone.has(e.source) || gone.has(e.target));
  return {
    nodes: nodes.filter(n => !gone.has(n.id)),
    edges: edges.filter(e => !gone.has(e.source) && !gone.has(e.target)),
    removed: { nodes: removedNodes, edges: removedEdges },
  };
}

// Puts a removal back. Edges are restored only when both ends exist again;
// nodes already present (same id) are left untouched.
export function restoreRemoved(nodes, edges, removed) {
  const present = new Set(nodes.map(n => n.id));
  const nextNodes = [...nodes, ...removed.nodes.filter(n => !present.has(n.id))];
  const ids = new Set(nextNodes.map(n => n.id));
  const edgeIds = new Set(edges.map(e => e.id));
  const nextEdges = [...edges, ...removed.edges.filter(e => !edgeIds.has(e.id) && ids.has(e.source) && ids.has(e.target))];
  return { nodes: nextNodes, edges: nextEdges };
}
