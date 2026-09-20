// Longest-path ranks ensure every edge advances along the flow axis (left→right or top→bottom).
// Cycles are left untouched: a real feedback loop needs an explicit business meaning.
const RESOURCE_FIELDS = ['toolsUsed', 'actorsUsed', 'knowledgeUsed'];
const width = node => node.width || (node.type === 'startEnd' ? 240 : 300);
const height = node => node.height || (node.type === 'startEnd' ? 100 : 260);
// Ports belong to the step card, not to the satellites extending below it.
export const portOffset = node => {
  if (node.type !== 'process') return height(node) / 2;
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

// Flow view: the highest-volume route is lane 0, branches take the next free lane.
function flowLanes(nodes, edges, rank, queue) {
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
// lanes: optional Map<nodeId, laneIndex>. When given, nodes sharing lane and rank are stacked
// inside the lane and one background band per lane is returned.
export function layoutGraph(nodes, edges, { orientation = 'horizontal', lanes = null, laneLabels = [] } = {}) {
  const ranked = rankNodes(nodes, edges);
  if (ranked.error) return { error: ranked.error };
  const { rank, queue } = ranked;
  const vertical = orientation === 'vertical';
  const laneOf = lanes ? new Map(nodes.map(n => [n.id, lanes.get(n.id) ?? 0])) : flowLanes(nodes, edges, rank, queue);

  // Slot = position inside a lane when several nodes share lane and rank (swimlane mode only).
  const slot = new Map();
  const slotsPerLane = new Map();
  const seen = new Map();
  for (const n of nodes) {
    const lane = laneOf.get(n.id);
    const key = `${lane}:${rank.get(n.id)}`;
    const k = lanes ? (seen.get(key) || 0) : 0;
    seen.set(key, k + 1);
    slot.set(n.id, k);
    slotsPerLane.set(lane, Math.max(slotsPerLane.get(lane) || 1, k + 1));
  }

  // Lane axis: one slot pitch per stacked node, lanes laid end to end.
  const slotPitch = vertical ? Math.max(420, ...nodes.map(n => width(n) + 120)) : Math.max(650, ...nodes.map(n => height(n) + 220));
  const laneCount = Math.max(0, ...laneOf.values()) + 1;
  const laneStart = [];
  let acc = 0;
  for (let l = 0; l < laneCount; l++) { laneStart[l] = acc; acc += slotPitch * (slotsPerLane.get(l) || 1); }
  // Lane-axis coordinate of a node's ports: lane start, plus one slot pitch per stacked node.
  const laneCenter = id => laneStart[laneOf.get(id)] + slotPitch * slot.get(id);

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
      positions.set(node.id, vertical ? { x: c - width(node) / 2, y: flow } : { x: flow, y: c - portOffset(node) });
    }
    const adjacent = edges.filter(e => rank.get(e.source) === level && rank.get(e.target) === level + 1);
    const rise = Math.max(0, ...adjacent.map(e => Math.abs(laneCenter(e.target) - laneCenter(e.source))));
    const corridor = vertical ? Math.max(260, 160 + rise * 0.5) : Math.max(640, 380 + rise * 0.9);
    const extent = Math.max(vertical ? 100 : 300, ...column.map(n => (vertical ? height(n) : width(n))));
    flow += extent + corridor;
  }

  const bands = lanes
    ? Array.from({ length: laneCount }, (_, l) => {
        const thickness = slotPitch * (slotsPerLane.get(l) || 1);
        const start = laneStart[l] - slotPitch / 2;
        const label = laneLabels[l] ?? `Couloir ${l + 1}`;
        return vertical
          ? { key: String(l), label, x: start, y: -80, width: thickness, height: flow + 80 }
          : { key: String(l), label, x: -80, y: start, width: flow + 80, height: thickness };
      })
    : [];
  return { nodes: nodes.map(node => ({ ...node, position: positions.get(node.id) })), bands };
}

export function horizontalLayout(nodes, edges) {
  const result = layoutGraph(nodes, edges, { orientation: 'horizontal' });
  return result.error ? result : { nodes: result.nodes };
}
