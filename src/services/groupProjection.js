import { groupLeaves, groupParents } from "./groups.js";
import { proposeLayout } from "./placement.js";
export const nodeSize = (n) => ({
  width: n.width || 300,
  height:
    n.height ||
    (n.type === "startEnd"
      ? 130
      : 380 +
        Math.max(
          0,
          ...["toolsUsed", "actorsUsed", "knowledgeUsed"].map(
            (k) => n.data[k]?.length || 0,
          ),
        ) *
          110),
});
export function projectGroups(
  scenario,
  { collapsed = [], focusId = null } = {},
) {
  const groups = new Map((scenario.groups || []).map((g) => [g.id, g])),
    parents = groupParents(scenario),
    closed = new Set(collapsed);
  const leaves = new Map(
    [...groups.keys()].map((id) => [id, new Set(groupLeaves(scenario, id))]),
  );
  const boxes = new Map(),
    visible = new Set(),
    owner = new Map();
  const bounds = (id) => {
    if (boxes.has(id)) return boxes.get(id);
    const g = groups.get(id);
    if (!g) {
      const n = scenario.nodes.find((n) => n.id === id),
        b = { ...n.position, ...nodeSize(n) };
      boxes.set(id, b);
      return b;
    }
    const parts = g.members.map(bounds);
    const inside = leaves.get(id);
    for (const e of scenario.edges.filter(
      (e) => inside.has(e.source) && inside.has(e.target),
    )) {
      const a = scenario.nodes.find((n) => n.id === e.source),
        b = scenario.nodes.find((n) => n.id === e.target);
      const size = scenario.edgeLabelSizes?.[e.id] || {
        width: 260,
        height:
          e.data?.itemData && Object.keys(e.data.itemData).length ? 200 : 70,
      };
      const x = (a.position.x + nodeSize(a).width + b.position.x) / 2,
        y =
          (a.position.y +
            (a.layoutMetrics?.sourceOffset?.y || 130) +
            b.position.y +
            (b.layoutMetrics?.targetOffset?.y || 130)) /
          2;
      parts.push({ x: x - size.width / 2, y: y - size.height / 2, ...size });
    }
    const x = Math.min(...parts.map((b) => b.x)) - 32,
      y = Math.min(...parts.map((b) => b.y)) - 58;
    const b = {
      x,
      y,
      width: Math.max(...parts.map((b) => b.x + b.width)) - x + 32,
      height: Math.max(...parts.map((b) => b.y + b.height)) - y + 32,
    };
    boxes.set(id, b);
    return b;
  };
  [...groups.keys()].forEach(bounds);
  const walk = (id) => {
    visible.add(id);
    const g = groups.get(id);
    if (!g) {
      owner.set(id, id);
      return;
    }
    if (closed.has(id) && id !== focusId) {
      for (const leaf of leaves.get(id)) owner.set(leaf, id);
    } else g.members.forEach(walk);
  };
  const roots =
    focusId && groups.has(focusId)
      ? [focusId]
      : [...scenario.nodes, ...groups.values()]
          .filter((n) => !parents.has(n.id))
          .map((n) => n.id);
  roots.forEach(walk);
  const nodes = scenario.nodes
    .filter((n) => visible.has(n.id))
    .map((n) => ({ ...n, zIndex: 10 }));
  const depth = (id) => {
    let d = 0;
    while (parents.has(id)) {
      id = parents.get(id);
      d++;
    }
    return d;
  };
  for (const id of visible) {
    const g = groups.get(id);
    if (!g) continue;
    const b = boxes.get(id),
      isClosed = closed.has(id) && id !== focusId;
    const boundary = scenario.edges.filter(
      (e) => leaves.get(id).has(e.source) !== leaves.get(id).has(e.target),
    );
    const inputs = boundary.filter((e) => leaves.get(id).has(e.target)),
      outputs = boundary.filter((e) => leaves.get(id).has(e.source));
    const portOffsets = {};
    for (const [side, list] of [
      ["in", inputs],
      ["out", outputs],
    ]) {
      let y = 90;
      for (const edge of list) {
        portOffsets[`${side}:${edge.id}`] = y;
        const label = scenario.edgeLabelSizes?.[edge.id];
        y +=
          2 *
          ((label?.height ||
            (Object.keys(edge.data?.itemData || {}).length ? 200 : 70)) +
            24);
      }
    }
    const cardHeight = Math.max(340, 70 + Math.max(0, ...Object.values(portOffsets)));
    for (const [side, list] of [["in", inputs], ["out", outputs]]) {
      if (list.length === 1) portOffsets[`${side}:${list[0].id}`] = cardHeight / 2;
    }
    const members = scenario.nodes.filter(n => leaves.get(id).has(n.id));
    const resourceCount = Math.max(0, ...["toolsUsed", "actorsUsed", "knowledgeUsed"].map(field =>
      new Set(members.flatMap(n => [...(n.data[field] || []), ...(field === "actorsUsed" ? Object.keys(n.data.actorAllocations || {}) : [])])).size));
    const size = isClosed
      ? {
          width: 300,
          height: cardHeight + 40 + resourceCount * 100,
        }
      : { width: b.width, height: b.height };
    nodes.push({
      id,
      type: "subprocess",
      position: { x: b.x + (isClosed ? 32 : 0), y: b.y + (isClosed ? 58 : 0) },
      style: size,
      width: size.width,
      height: size.height,
      zIndex: isClosed ? 8 : -100 + depth(id),
      deletable: false,
      draggable: !scenario.nodes.some(
        (n) => leaves.get(id).has(n.id) && n.data.positionLocked,
      ),
      data: {
        group: g,
        collapsed: isClosed,
        inputs,
        outputs,
        portOffsets,
        cardHeight,
        leafIds: [...leaves.get(id)],
      },
    });
  }
  // A collapsed child can have more satellites than any individual leaf.
  // Extend its open ancestors to contain the projected card and resources.
  for (const frame of nodes.filter(n => n.type === "subprocess" && !n.data.collapsed).sort((a,b) => depth(b.id)-depth(a.id))) {
    const children = nodes.filter(n => parents.get(n.id) === frame.id);
    const right = Math.max(frame.position.x + frame.width, ...children.map(n => n.position.x + nodeSize(n).width + 32));
    const bottom = Math.max(frame.position.y + frame.height, ...children.map(n => n.position.y + nodeSize(n).height + 32));
    frame.width = right - frame.position.x;
    frame.height = bottom - frame.position.y;
    frame.style = {width:frame.width, height:frame.height};
  }
  const edges = scenario.edges.flatMap((e) => {
    const source = owner.get(e.source),
      target = owner.get(e.target);
    if (!source || !target || (source === target && source !== e.source))
      return [];
    return [
      {
        ...e,
        source,
        target,
        sourceHandle: source === e.source ? e.sourceHandle : `out:${e.id}`,
        targetHandle: target === e.target ? e.targetHandle : `in:${e.id}`,
        zIndex: 20,
      },
    ];
  });
  return { nodes, edges, boxes, parents };
}
export function layoutGroups(scenario) {
  const next = structuredClone(scenario),
    parents = groupParents(next),
    groups = new Map((next.groups || []).map((g) => [g.id, g]));
  const arrange = (members) => {
    members.forEach((id) => {
      if (groups.has(id)) arrange(groups.get(id).members);
    });
    const projection = projectGroups(next),
      owner = new Map(
        members.flatMap((id) =>
          groupLeaves(next, id).map((leaf) => [leaf, id]),
        ),
      );
    const units = members.map((id) => {
      const n = next.nodes.find((n) => n.id === id),
        b = projection.boxes.get(id) || { ...n.position, ...nodeSize(n) },
        ids = new Set(groupLeaves(next, id));
      const incoming = next.edges.filter(
          (e) => !ids.has(e.source) && ids.has(e.target),
        ),
        outgoing = next.edges.filter(
          (e) => ids.has(e.source) && !ids.has(e.target),
        );
      const insetIn = Math.max(
        0,
        ...incoming.map(
          (e) => next.nodes.find((n) => n.id === e.target).position.x - b.x,
        ),
      );
      const insetOut = Math.max(
        0,
        ...outgoing.map((e) => {
          const n = next.nodes.find((n) => n.id === e.source);
          return b.x + b.width - n.position.x - nodeSize(n).width;
        }),
      );
      const leftPad = groups.has(id) ? Math.max(0, insetIn + 300 - 640) : 0,
        rightPad = groups.has(id) ? Math.max(0, insetOut + 300 - 640) : 0;
      return {
        id,
        type: n?.type || "process",
        data: n?.data || {},
        position: { x: b.x, y: b.y },
        width: b.width + leftPad + rightPad,
        height: b.height,
        leftPad,
      };
    });
    const edges = next.edges
      .filter(
        (e) =>
          owner.has(e.source) &&
          owner.has(e.target) &&
          owner.get(e.source) !== owner.get(e.target),
      )
      .map((e) => ({
        ...e,
        source: owner.get(e.source),
        target: owner.get(e.target),
      }));
    const layoutEdges = [
      ...new Map(edges.map((e) => [`${e.source}:${e.target}`, e])).values(),
    ];
    const result = proposeLayout(units, layoutEdges);
    if (result.error) throw new Error(result.error);
    for (const unit of result.nodes) {
      const old = units.find((n) => n.id === unit.id),
        dx = unit.position.x + (unit.leftPad || 0) - old.position.x,
        dy = unit.position.y - old.position.y;
      const ids = new Set(groupLeaves(next, unit.id));
      next.nodes.forEach((n) => {
        if (ids.has(n.id))
          n.position = { x: n.position.x + dx, y: n.position.y + dy };
      });
    }
  };
  arrange(
    [...next.nodes, ...groups.values()]
      .filter((n) => !parents.has(n.id))
      .map((n) => n.id),
  );
  if (
    next.nodes.some(
      (n) =>
        n.data.positionLocked &&
        JSON.stringify(n.position) !==
          JSON.stringify(scenario.nodes.find((x) => x.id === n.id).position),
    )
  )
    throw new Error(
      "Les positions verrouillées empêchent ce réagencement. La carte est conservée.",
    );
  const conflicts = groupCollisions(next);
  if (conflicts.length)
    throw new Error(
      "Le placement proposé contient des collisions : " +
        conflicts.slice(0, 3).join("; "),
    );
  return next;
}
// Parent/descendant containment is intentional; all other overlaps are diagnostics.
export function groupCollisions(scenario, view = {}, sizes = {}) {
  const projection = projectGroups(scenario, view),
    groups = new Map(
      (scenario.groups || []).map((g) => [
        g.id,
        new Set(groupLeaves(scenario, g.id)),
      ]),
    );
  const boxes = projection.nodes.map((n) => ({
    id: n.id,
    kind: "node",
    ...n.position,
    ...nodeSize(n),
  }));
  for (const edge of projection.edges) {
    const s = projection.nodes.find((n) => n.id === edge.source),
      t = projection.nodes.find((n) => n.id === edge.target);
    const sw = nodeSize(s).width,
      sh = nodeSize(s).height,
      th = nodeSize(t).height;
    const size = sizes[edge.id] || {
      width: 260,
      height:
        edge.data?.itemData && Object.keys(edge.data.itemData).length
          ? 200
          : 70,
    };
    const sourcePort =
      s.type === "subprocess"
        ? s.data.portOffsets[`out:${edge.id}`]
        : s.layoutMetrics?.sourceOffset?.y || Math.min(sh / 2, 150);
    const targetPort =
      t.type === "subprocess"
        ? t.data.portOffsets[`in:${edge.id}`]
        : t.layoutMetrics?.targetOffset?.y || Math.min(th / 2, 150);
    boxes.push({
      id: edge.id,
      kind: "label",
      edge,
      x: (s.position.x + sw + t.position.x) / 2 - size.width / 2,
      y:
        (s.position.y + sourcePort + t.position.y + targetPort) / 2 -
        size.height / 2,
      width: size.width,
      height: size.height,
    });
  }
  const contains = (a, b) =>
    groups.has(a.id) &&
    (b.kind === "label"
      ? groups
          .get(a.id)
          .has(scenario.edges.find((e) => e.id === b.id)?.source) &&
        groups.get(a.id).has(scenario.edges.find((e) => e.id === b.id)?.target)
      : groups.has(b.id)
        ? [...groups.get(b.id)].every((id) => groups.get(a.id).has(id))
        : groups.get(a.id).has(b.id));
  const hits = [];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      if (contains(a, b) || contains(b, a)) continue;
      if (
        a.x < b.x + b.width + 12 &&
        a.x + a.width + 12 > b.x &&
        a.y < b.y + b.height + 12 &&
        a.y + a.height + 12 > b.y
      )
        hits.push(`${a.kind}:${a.id} / ${b.kind}:${b.id}`);
    }
  return hits;
}
