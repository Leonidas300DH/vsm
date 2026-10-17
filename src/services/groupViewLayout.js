import { groupParents } from "./groups.js";
import { projectGroups, groupCollisions, nodeSize } from "./groupProjection.js";
import { proposeLayout } from "./placement.js";

// Disclosure is a local presentation change, never a business/history edit.
export function reflowGroupView(scenario, view, collapsed, anchorId) {
  const before = projectGroups(scenario, view);
  const next = {
    ...view,
    collapsed,
    offsets: structuredClone(view.offsets || {}),
  };
  const parents = groupParents(scenario);
  const groups = new Map((scenario.groups || []).map((g) => [g.id, g]));
  const closed = new Set(collapsed);
  const descendants = (id) => {
    const ids = new Set([id]);
    const visit = (key) =>
      groups.get(key)?.members.forEach((child) => {
        ids.add(child);
        visit(child);
      });
    visit(id);
    return ids;
  };
  const shift = (ids, dx, dy) => {
    for (const id of ids) {
      const prior = next.offsets[id] || { x: 0, y: 0 };
      next.offsets[id] = { x: prior.x + dx, y: prior.y + dy };
    }
  };
  const arrange = (members) => {
    for (const id of members)
      if (groups.has(id) && !closed.has(id)) arrange(groups.get(id).members);
    const projection = projectGroups(scenario, next);
    const map = new Map(projection.nodes.map((n) => [n.id, n]));
    const owner = new Map(
      members.flatMap((id) => [...descendants(id)].map((child) => [child, id])),
    );
    const links = projection.edges.filter(
      (e) =>
        owner.has(e.source) &&
        owner.has(e.target) &&
        owner.get(e.source) !== owner.get(e.target),
    );
    const units = members.map((id) => {
      const n = map.get(id),
        size = nodeSize(n);
      const incoming = projection.edges.filter(
        (e) => owner.get(e.target) === id && owner.get(e.source) !== id,
      );
      const outgoing = projection.edges.filter(
        (e) => owner.get(e.source) === id && owner.get(e.target) !== id,
      );
      const leftPad = Math.max(
        0,
        ...incoming.map(
          (e) => map.get(e.target).position.x - n.position.x + 300 - 640,
        ),
      );
      const rightPad = Math.max(
        0,
        ...outgoing.map(
          (e) =>
            n.position.x +
            size.width -
            map.get(e.source).position.x -
            nodeSize(map.get(e.source)).width +
            300 -
            640,
        ),
      );
      const portY = (node, edge, side) =>
        node.type === "subprocess"
          ? node.data.portOffsets[`${side}:${edge.id}`]
          : node.layoutMetrics?.[
              side === "out" ? "sourceOffset" : "targetOffset"
            ]?.y || Math.min(nodeSize(node).height / 2, 150);
      const boundaryY = (edges, side) => {
        if (!edges.length)
          return (
            n.layoutMetrics?.[side === "out" ? "sourceOffset" : "targetOffset"]
              ?.y || Math.min(size.height / 2, 150)
          );
        const edge = edges[0],
          endpoint = map.get(side === "out" ? edge.source : edge.target);
        return endpoint.position.y - n.position.y + portY(endpoint, edge, side);
      };
      return {
        ...n,
        data: { ...n.data, positionLocked: false },
        width: size.width + leftPad + rightPad,
        leftPad,
        layoutMetrics: {
          sourceOffset: {
            x: size.width + leftPad + rightPad,
            y: boundaryY(outgoing, "out"),
          },
          targetOffset: { x: 0, y: boundaryY(incoming, "in") },
        },
      };
    });
    const edges = [
      ...new Map(
        links.map((e) => [
          JSON.stringify([owner.get(e.source), owner.get(e.target)]),
          { ...e, source: owner.get(e.source), target: owner.get(e.target) },
        ]),
      ).values(),
    ];
    const result = proposeLayout(units, edges, {
      sizes: scenario.edgeLabelSizes,
    });
    if (result.error) throw new Error(result.error);
    for (const unit of result.nodes) {
      const old = map.get(unit.id);
      shift(
        descendants(unit.id),
        unit.position.x + unit.leftPad - old.position.x,
        unit.position.y - old.position.y,
      );
    }
  };
  arrange(
    [...scenario.nodes, ...groups.values()]
      .filter((n) => !parents.has(n.id))
      .map((n) => n.id),
  );
  // Keep the clicked group in place. The camera itself never moves.
  const after = projectGroups(scenario, next);
  const anchor = before.nodes.find((n) => n.id === anchorId) || before.nodes[0];
  const target = after.nodes.find((n) => n.id === anchor?.id);
  if (target)
    shift(
      new Set([...scenario.nodes, ...groups.values()].map((n) => n.id)),
      anchor.position.x - target.position.x,
      anchor.position.y - target.position.y,
    );
  const placed = projectGroups(scenario, next);
  for (const node of scenario.nodes.filter((n) => n.data.positionLocked)) {
    const old = before.nodes.find((n) => n.id === node.id),
      current = placed.nodes.find((n) => n.id === node.id);
    const moved =
      old &&
      current &&
      (Math.abs(old.position.x - current.position.x) > 0.1 ||
        Math.abs(old.position.y - current.position.y) > 0.1);
    if (moved)
      throw new Error(
        `La position verrouillée de « ${node.data.label || node.id} » empêche ce réagencement. La carte est conservée.`,
      );
  }
  const conflicts = groupCollisions(scenario, next);
  if (conflicts.length)
    throw new Error(
      "Impossible de libérer la place sans chevauchement. La carte est conservée : " +
        conflicts.slice(0, 2).join("; "),
    );
  return next;
}

export function canonicalNodeChange(change, view) {
  const offset = view.offsets?.[change.id];
  return change.type === "position" && change.position && offset
    ? {
        ...change,
        position: {
          x: change.position.x - offset.x,
          y: change.position.y - offset.y,
        },
      }
    : change;
}
