// Longest-path ranks ensure every edge advances along the flow axis (left→right or top→bottom).
// Cycles are left untouched: a real feedback loop needs an explicit business meaning.
const RESOURCE_FIELDS = ['toolsUsed', 'actorsUsed', 'knowledgeUsed'];
const width = node => node.width || (node.type === 'startEnd' ? 240 : 300);
const height = node => node.height || (node.type === 'startEnd' ? 100 : 260);
// Lane-axis distance from the node's origin to its ports.
// Horizontal: resources hang below the card, so the ports sit in the upper part (the card).
// Vertical: resources sit beside the card, which comes first, so the ports are at the card's centre line.
const CARD_WIDTH = 300;
export const portOffset = (node, vertical = false) => {
  if (node.type !== 'process') return vertical ? width(node) / 2 : height(node) / 2;
  if (vertical) return CARD_WIDTH / 2;
  const count = Math.max(0, ...RESOURCE_FIELDS.map(k => (node.data[k] || []).length));
  return Math.max(60, (height(node) - 44 - count * 100) / 2);
};

function rankNodes(nodes, edges) {
  const ids = new Set(nodes.map(n => n.id));
  const incoming = new Map(nodes.map(n => [n.id, 0]));
  const outgoing = new Map(nodes.map(n => [n.id, []]));
  const rank = new Map(nodes.map(n => [n.id, 0]));
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) return { error: 'Une connexion pointe vers une étape absente.' };
    incoming.set(edge.target, incoming.get(edge.target) + 1);
    outgoing.get(edge.source).push(edge.target);
  }
  const queue = nodes.filter(n => incoming.get(n.id) === 0).map(n => n.id);
  let count = 0;
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    count++;
    for (const next of outgoing.get(id)) {
      rank.set(next, Math.max(rank.get(next), rank.get(id) + 1));
      incoming.set(next, incoming.get(next) - 1);
      if (!incoming.get(next)) queue.push(next);
    }
  }
  if (count !== nodes.length) return { error: 'Ce graphe contient une boucle. Sa disposition manuelle est conservée.' };
  // All exits belong at the end, even when their paths have different lengths.
  const ends = nodes.filter(n => n.type === 'startEnd' && n.data.type === 'end' && !outgoing.get(n.id).length);
  const lastRank = Math.max(0, ...rank.values());
  ends.forEach(n => rank.set(n.id, lastRank));
  return { rank, queue };
}

// The highest-volume route is lane 0, branches take the next free lane.
function assignLanes(nodes, edges, rank, queue) {
  const starts = nodes.filter(n => n.type === 'startEnd' && n.data.type === 'start' && !edges.some(e => e.target === n.id));
  const spine = new Set();
  let cursor = starts[0]?.id || queue[0];
  const weight = e => Number(e.data?.volume ?? nodes.find(n => n.id === e.target)?.data.volume_in ?? e.data?.percentage ?? 0);
  while (cursor && !spine.has(cursor)) {
    spine.add(cursor);
    const candidates = edges.filter(e => e.source === cursor);
    candidates.sort((a, b) => weight(b) - weight(a) || String(a.id || a.target).localeCompare(String(b.id || b.target)));
    cursor = candidates[0]?.target;
  }
  const lanes = new Map([...spine].map(id => [id, 0]));
  const occupied = new Set([...spine].map(id => `0:${rank.get(id)}`));
  for (const id of queue) {
    if (lanes.has(id)) continue;
    const parents = edges.filter(e => e.target === id).map(e => lanes.get(e.source)).filter(l => l > 0);
    let lane = parents.length ? Math.min(...parents) : 1;
    while (occupied.has(`${lane}:${rank.get(id)}`)) lane++;
    lanes.set(id, lane); occupied.add(`${lane}:${rank.get(id)}`);
  }
  return lanes;
}

// orientation: 'horizontal' (x = flow, y = lane) or 'vertical' (y = flow, x = lane).
export function layoutGraph(nodes, edges, { orientation = 'horizontal' } = {}) {
  const ranked = rankNodes(nodes, edges);
  if (ranked.error) return { error: ranked.error };
  const { rank, queue } = ranked;
  const vertical = orientation === 'vertical';
  const laneOf = assignLanes(nodes, edges, rank, queue);
  const lanePitch = vertical ? Math.max(420, ...nodes.map(n => width(n) + 120)) : Math.max(650, ...nodes.map(n => height(n) + 220));
  const laneCenter = id => laneOf.get(id) * lanePitch;

  // Flow axis: one column (or row) per rank, corridor proportional to the biggest lane jump.
  const columns = new Map();
  for (const node of nodes) {
    const level = rank.get(node.id);
    if (!columns.has(level)) columns.set(level, []);
    columns.get(level).push(node);
  }
  const positions = new Map();
  let flow = 0;
  for (const [level, column] of [...columns].sort(([a], [b]) => a - b)) {
    for (const node of column) {
      const c = laneCenter(node.id);
      positions.set(node.id, vertical ? { x: c - portOffset(node, true), y: flow } : { x: flow, y: c - portOffset(node, false) });
    }
    const adjacent = edges.filter(e => rank.get(e.source) === level && rank.get(e.target) === level + 1);
    const rise = Math.max(0, ...adjacent.map(e => Math.abs(laneCenter(e.target) - laneCenter(e.source))));
    const corridor = vertical ? Math.max(260, 160 + rise * 0.5) : Math.max(640, 380 + rise * 0.9);
    const extent = Math.max(vertical ? 100 : 300, ...column.map(n => (vertical ? height(n) : width(n))));
    flow += extent + corridor;
  }
  return { nodes: nodes.map(node => ({ ...node, position: positions.get(node.id) })) };
}

export function horizontalLayout(nodes, edges) {
  return layoutGraph(nodes, edges, { orientation: 'horizontal' });
}
