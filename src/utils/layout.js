// Longest-path ranks ensure every edge in a DAG points left to right.
// Cycles are left untouched: a real feedback loop needs an explicit business meaning.
export function horizontalLayout(nodes, edges) {
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
  const height = node => node.height || (node.type === 'startEnd' ? 100 : 260);
  const starts = nodes.filter(n => n.type === 'startEnd' && n.data.type === 'start' && !edges.some(e => e.target === n.id));
  const ends = nodes.filter(n => n.type === 'startEnd' && n.data.type === 'end' && !outgoing.get(n.id).length);
  // All exits belong on the right, even when their paths have different lengths.
  const lastRank = Math.max(0, ...rank.values());
  ends.forEach(n => rank.set(n.id, lastRank));
  const columns = new Map();
  for (const node of nodes) {
    const level = rank.get(node.id);
    if (!columns.has(level)) columns.set(level, []);
    columns.get(level).push(node);
  }
  const positions = new Map();
  const width = node => node.width || (node.type === 'startEnd' ? 240 : 300);
  // Ports belong to the step card, not to the satellites extending below it.
  const portOffset = node => {
    if (node.type !== 'process') return height(node) / 2;
    const count = Math.max(0, ...['toolsUsed','actorsUsed','knowledgeUsed'].map(k => (node.data[k] || []).length));
    return Math.max(60, (height(node) - 44 - count * 100) / 2);
  };
  // Follow the highest-volume route as the horizontal spine.
  const spine = new Set();
  let cursor = starts[0]?.id || queue[0];
  while (cursor && !spine.has(cursor)) {
    spine.add(cursor);
    const candidates = edges.filter(e => e.source === cursor);
    candidates.sort((a,b) => Number(b.data?.volume ?? nodes.find(n => n.id === b.target)?.data.volume_in ?? b.data?.percentage ?? 0) - Number(a.data?.volume ?? nodes.find(n => n.id === a.target)?.data.volume_in ?? a.data?.percentage ?? 0) || String(a.id || a.target).localeCompare(String(b.id || b.target)));
    cursor = candidates[0]?.target;
  }
  const lanes = new Map([...spine].map(id => [id,0]));
  const occupied = new Set([...spine].map(id => `0:${rank.get(id)}`));
  for (const id of queue) {
    if (lanes.has(id)) continue;
    const parents = edges.filter(e => e.target === id).map(e => lanes.get(e.source)).filter(l => l > 0);
    let lane = parents.length ? Math.min(...parents) : 1;
    while (occupied.has(`${lane}:${rank.get(id)}`)) lane++;
    lanes.set(id,lane); occupied.add(`${lane}:${rank.get(id)}`);
  }
  const lanePitch = Math.max(650, ...nodes.map(n => height(n) + 220));
  let x = 0;
  for (const [, column] of [...columns].sort(([a], [b]) => a - b)) {
    for (const node of column) positions.set(node.id, { x, y:lanes.get(node.id)*lanePitch-portOffset(node) });
    x += Math.max(300, ...column.map(width)) + 640;
  }
  const byId = new Map(nodes.map(n => [n.id, n]));
  const center = id => positions.get(id).y + portOffset(byId.get(id));
  // A branch needs horizontal run on both sides of its label, proportional to its rise.
  let columnX = 0;
  for (const [level, column] of [...columns].sort(([a], [b]) => a - b)) {
    column.forEach(n => { positions.get(n.id).x = columnX; });
    const adjacent = edges.filter(e => rank.get(e.source) === level && rank.get(e.target) === level + 1);
    const rise = Math.max(0, ...adjacent.map(e => Math.abs(center(e.target) - center(e.source))));
    const corridor = Math.max(640, 380 + rise * 0.9);
    columnX += Math.max(300, ...column.map(n => n.width || 300)) + corridor;
  }
  return { nodes: nodes.map(node => ({ ...node, position: positions.get(node.id) })) };
}
