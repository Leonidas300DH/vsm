import { layoutGraph, portOffset } from "../utils/layout.js";
const w = (n) => n.width || (n.type === "startEnd" ? 240 : 300),
  h = (n) => n.height || (n.type === "startEnd" ? 100 : 440);
export function graphBoxes(
  nodes,
  edges,
  sizes = {},
  orientation = "horizontal",
) {
  const vertical = orientation === "vertical",
    map = new Map(nodes.map((n) => [n.id, n]));
  const boxes = nodes.map((n) => ({
    id: n.id,
    kind: "node",
    x: n.position.x,
    y: n.position.y,
    width: w(n),
    height: h(n),
  }));
  for (const e of edges) {
    const s = map.get(e.source),
      t = map.get(e.target);
    if (!s || !t) continue;
    const size = sizes[e.id] || {
      width: 260,
      height:
        e.data?.itemData && Object.keys(e.data.itemData).length ? 200 : 70,
    };
    const source = s.layoutMetrics?.sourceOffset || {
      x: vertical ? portOffset(s, true) : w(s),
      y: vertical ? h(s) : portOffset(s),
    };
    const target = t.layoutMetrics?.targetOffset || {
      x: vertical ? portOffset(t, true) : 0,
      y: vertical ? 0 : portOffset(t),
    };
    const x = (s.position.x + source.x + t.position.x + target.x) / 2;
    const y = (s.position.y + source.y + t.position.y + target.y) / 2;
    boxes.push({
      id: e.id,
      kind: "label",
      x: x - size.width / 2,
      y: y - size.height / 2,
      width: size.width,
      height: size.height,
    });
  }
  return boxes;
}
export function collisions(boxes, padding = 20) {
  const result = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      if (
        a.x < b.x + b.width + padding &&
        a.x + a.width + padding > b.x &&
        a.y < b.y + b.height + padding &&
        a.y + a.height + padding > b.y
      )
        result.push([a, b]);
    }
  return result;
}
export function proposeLayout(
  nodes,
  edges,
  { sizes = {}, orientation = "horizontal" } = {},
) {
  const started = performance.now(),
    base = layoutGraph(nodes, edges, { orientation });
  if (base.error) return base;
  const pinned = new Map(
    nodes.filter((n) => n.data.positionLocked).map((n) => [n.id, n.position]),
  );
  let candidate = base.nodes.map((n) => ({
    ...n,
    position: pinned.get(n.id) || { ...n.position },
  }));
  const axis = orientation === "vertical" ? "y" : "x";
  const valid = () => {
    const boxes = graphBoxes(candidate, edges, sizes, orientation);
    return collisions(boxes);
  };
  if (pinned.size) {
    const overlaps = valid();
    const backwards = edges.filter((e) => {
      const s = candidate.find((n) => n.id === e.source),
        t = candidate.find((n) => n.id === e.target);
      return (
        t.position[axis] <= s.position[axis] + (axis === "x" ? w(s) : h(s))
      );
    });
    if (overlaps.length || backwards.length)
      return {
        error:
          "Les positions verrouillées empêchent cette proposition. La carte est conservée.",
        conflicts: [
          ...new Set([
            ...pinned.keys(),
            ...overlaps.flat().map((b) => b.id),
            ...backwards.map((e) => e.id),
          ]),
        ],
      };
    return {
      nodes: candidate,
      overlaps: [],
      elapsedMs: performance.now() - started,
    };
  }
  // Sweep columns once. Earlier columns and their labels stay fixed. Moving only
  // the current column avoids the oscillation caused by shifting every successor.
  const groups = new Map();
  for (const n of candidate) {
    const x = n.position[axis];
    if (!groups.has(x)) groups.set(x, []);
    groups.get(x).push(n.id);
  }
  const done = new Set();
  let priorEnd = -Infinity;
  for (const [original, ids] of [...groups].sort(([a], [b]) => a - b)) {
    const group = new Set(ids);
    let location = Math.max(original, priorEnd + 640);
    let accepted = false;
    for (let attempt = 0; attempt < 1500; attempt++) {
      candidate = candidate.map((n) =>
        group.has(n.id)
          ? { ...n, position: { ...n.position, [axis]: location } }
          : n,
      );
      const visible = candidate.filter(
          (n) => done.has(n.id) || group.has(n.id),
        ),
        available = new Set(visible.map((n) => n.id));
      const links = edges.filter(
        (e) => available.has(e.source) && available.has(e.target),
      );
      const hits = collisions(graphBoxes(visible, links, sizes, orientation));
      if (!hits.length) {
        accepted = true;
        break;
      }
      const [a, b] = hits[0];
      location +=
        Math.max(
          axis === "x" ? a.width : a.height,
          axis === "x" ? b.width : b.height,
        ) *
          2 +
        80;
      if (performance.now() - started > 1700) break;
    }
    if (!accepted) break;
    for (const id of ids) done.add(id);
    priorEnd = Math.max(
      ...candidate
        .filter((n) => group.has(n.id))
        .map((n) => n.position[axis] + (axis === "x" ? w(n) : h(n))),
    );
  }
  if (done.size === nodes.length && !valid().length)
    return {
      nodes: candidate,
      overlaps: [],
      elapsedMs: performance.now() - started,
    };
  return {
    error:
      "Aucun placement sans chevauchement trouvé. La carte est conservée ; réduisez les contraintes ou séparez le sous-processus.",
    conflicts: collisions(graphBoxes(candidate, edges, sizes, orientation))
      .flat()
      .map((b) => b.id),
  };
}
