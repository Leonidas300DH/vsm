// Focus on one resource: which steps use it, so the canvas can dim everything else.
// Actors: scope 'internal' (default) = our people; scope 'external' = another team called into the flow.
const isExternal = actor => actor?.scope === 'external';
export const teamOf = actor => (actor.team || '').trim() || actor.name;

// Options for the toolbar picker: tools, internal actors, and external teams (deduplicated).
export function focusOptions({ tools = [], actors = [] }) {
  const teams = [];
  for (const a of actors.filter(isExternal)) {
    const label = teamOf(a);
    if (!teams.some(t => t.label === label)) teams.push({ kind: 'team', id: label, label });
  }
  return {
    tools: tools.map(t => ({ kind: 'tool', id: String(t.id), label: t.name })),
    actors: actors.filter(a => !isExternal(a)).map(a => ({ kind: 'actor', id: String(a.id), label: a.name })),
    teams,
  };
}

// Set of node ids that use the focused resource. Terminals are never focused.
export function focusedNodeIds(nodes, focus, { actors = [] } = {}) {
  const ids = new Set();
  if (!focus) return ids;
  const teamActors = focus.kind === 'team'
    ? new Set(actors.filter(a => isExternal(a) && teamOf(a) === focus.id).map(a => String(a.id)))
    : null;
  for (const node of nodes) {
    if (node.type !== 'process') continue;
    const data = node.data || {};
    const uses = focus.kind === 'tool' ? (data.toolsUsed || []).some(id => String(id) === focus.id)
      : focus.kind === 'actor' ? (data.actorsUsed || []).some(id => String(id) === focus.id)
      : (data.actorsUsed || []).some(id => teamActors.has(String(id)));
    if (uses) ids.add(node.id);
  }
  return ids;
}

// Does this satellite (kind + resource id) match the focus? Used to light up the orb on the card.
export function resourceMatchesFocus(kind, resourceId, focus, { actors = [] } = {}) {
  if (!focus) return false;
  if (focus.kind === 'tool') return kind === 'tools' && String(resourceId) === focus.id;
  if (focus.kind === 'actor') return kind === 'actors' && String(resourceId) === focus.id;
  const actor = actors.find(a => String(a.id) === String(resourceId));
  return kind === 'actors' && !!actor && isExternal(actor) && teamOf(actor) === focus.id;
}
