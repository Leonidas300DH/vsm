// Turns a view (tools / actors / teams) into a lane per resource, using the local libraries only.
// Actors: scope 'internal' (default) = our people; scope 'external' = another team called into the flow.
const isExternal = actor => actor?.scope === 'external';
const teamOf = actor => (actor.team || '').trim() || actor.name;

const FALLBACK = {
  tools: ['Sans outil'],
  actors: ['Équipes externes', 'Sans acteur'],
  teams: ['Notre équipe', 'Sans acteur'],
};

// Candidate lanes of one process node, in library order. Each entry: { key, label }.
function candidates(node, mode, { tools = [], actors = [] }) {
  const data = node.data || {};
  if (mode === 'tools') {
    const used = new Set(data.toolsUsed || []);
    const found = tools.filter(t => used.has(t.id)).map(t => ({ key: `tool:${t.id}`, label: t.name }));
    return found.length ? found : [{ key: 'fallback:0', label: FALLBACK.tools[0] }];
  }
  const used = new Set(data.actorsUsed || []);
  const known = actors.filter(a => used.has(a.id));
  if (mode === 'actors') {
    const internal = known.filter(a => !isExternal(a)).map(a => ({ key: `actor:${a.id}`, label: a.name }));
    if (internal.length) return internal;
    return [{ key: known.length ? 'fallback:0' : 'fallback:1', label: FALLBACK.actors[known.length ? 0 : 1] }];
  }
  // teams
  const teams = [];
  for (const a of known.filter(isExternal)) {
    const label = teamOf(a);
    if (!teams.some(t => t.label === label)) teams.push({ key: `team:${label}`, label });
  }
  if (teams.length) return teams;
  return [{ key: known.length ? 'fallback:0' : 'fallback:1', label: FALLBACK.teams[known.length ? 0 : 1] }];
}

export function assignLanes(nodes, edges, mode, libraries) {
  if (!['tools', 'actors', 'teams'].includes(mode)) throw new Error(`Unknown view: ${mode}`);
  // 1. One candidate list per step; the first candidate is the step's lane, the others are reported.
  const labelOf = new Map();
  const byNode = new Map();
  const multi = [];
  for (const node of nodes) {
    if (node.type !== 'process') continue;
    const list = candidates(node, mode, libraries);
    byNode.set(node.id, list[0].key);
    labelOf.set(list[0].key, list[0].label);
    if (list.length > 1) multi.push({ id: node.id, label: node.data?.label || node.id, count: list.length });
  }
  // 2. Lane order: library order for resources, fallback lanes last in their declared order.
  const libraryRank = key => {
    const kind = key.slice(0, key.indexOf(':'));
    const id = key.slice(key.indexOf(':') + 1);
    if (kind === 'tool') return libraries.tools.findIndex(t => String(t.id) === id);
    if (kind === 'actor') return libraries.actors.findIndex(a => String(a.id) === id);
    if (kind === 'team') return libraries.actors.findIndex(a => isExternal(a) && teamOf(a) === id);
    return 1e6 + Number(id);
  };
  const keys = [...labelOf.keys()].sort((a, b) => libraryRank(a) - libraryRank(b));
  const indexOf = new Map(keys.map((k, i) => [k, i]));
  const labels = keys.map(k => labelOf.get(k));

  // 3. Terminals follow their neighbouring step.
  const lanes = new Map();
  for (const [id, key] of byNode) lanes.set(id, indexOf.get(key));
  for (const node of nodes) {
    if (lanes.has(node.id)) continue;
    const neighbour = node.data?.type === 'end'
      ? edges.find(e => e.target === node.id && lanes.has(e.source))?.source
      : edges.find(e => e.source === node.id && lanes.has(e.target))?.target;
    lanes.set(node.id, neighbour !== undefined ? lanes.get(neighbour) : 0);
  }
  return { lanes, labels, multi };
}
