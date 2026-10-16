import { analyze } from "./analysis.js";
const copy = (v) => structuredClone(v);
const resourceFields = {
  tools: "toolsUsed",
  actors: "actorsUsed",
  knowledge: "knowledgeUsed",
};
export const groupLeaves = (scenario, id) => {
  const groups = new Map((scenario.groups || []).map((g) => [g.id, g]));
  const found = new Set(),
    visiting = new Set();
  const visit = (key) => {
    if (visiting.has(key)) throw new Error("Cycle dans les sous-processus.");
    const group = groups.get(key);
    if (!group) {
      found.add(key);
      return;
    }
    visiting.add(key);
    group.members.forEach(visit);
    visiting.delete(key);
  };
  visit(id);
  return [...found];
};
export function groupParents(scenario) {
  return new Map(
    (scenario.groups || []).flatMap((g) => g.members.map((id) => [id, g.id])),
  );
}
// A rectangle can enclose both a frame and its contents. Keep the outermost
// selected unit, while the currently opened frame is only the editing context.
export function groupingUnits(ids, parents, focusId = null) {
  const selected = new Set(ids.filter((id) => id !== focusId));
  return [...selected].filter((id) => {
    let parent = parents.get(id);
    while (parent) {
      if (selected.has(parent)) return false;
      parent = parents.get(parent);
    }
    return true;
  });
}
export function validateGroups(scenario) {
  const groups = scenario.groups || [],
    ids = new Set(scenario.nodes.map((n) => n.id)),
    parents = new Map();
  if (!Array.isArray(groups))
    throw new Error("Liste de sous-processus invalide.");
  for (const g of groups) {
    if (
      !g.id ||
      ids.has(g.id) ||
      !g.name?.trim() ||
      !Array.isArray(g.members) ||
      !g.members.length
    )
      throw new Error("Sous-processus invalide ou identifiant dupliqué.");
    ids.add(g.id);
  }
  for (const g of groups)
    for (const id of g.members) {
      if (!ids.has(id)) throw new Error(`${g.name} : membre absent (${id}).`);
      if (parents.has(id))
        throw new Error("Une étape ne peut appartenir à deux groupes.");
      parents.set(id, g.id);
    }
  for (const g of groups) groupLeaves(scenario, g.id);
  const drafts = scenario.decompositionDrafts || [];
  if (
    !Array.isArray(drafts) ||
    new Set(drafts.map((d) => d.nodeId)).size !== drafts.length
  )
    throw new Error("Brouillons de décomposition invalides.");
  for (const draft of drafts) {
    if (
      !scenario.nodes.some((n) => n.id === draft.nodeId) ||
      !Array.isArray(draft.nodes) ||
      !Array.isArray(draft.edges)
    )
      throw new Error("Brouillon orphelin ou invalide.");
    const keys = new Set(draft.nodes.map((n) => n.id));
    if (
      keys.size !== draft.nodes.length ||
      draft.nodes.some(
        (n) =>
          !n.id ||
          n.type !== "process" ||
          !n.data ||
          !Number.isFinite(n.position?.x) ||
          !Number.isFinite(n.position?.y),
      ) ||
      draft.edges.some(
        (e) => !e.id || !keys.has(e.source) || !keys.has(e.target),
      )
    )
      throw new Error("Étapes ou connexions du brouillon invalides.");
  }
  return scenario;
}
export function groupingSelection(scenario, ids) {
  const selected = [...new Set(ids)],
    parents = groupParents(scenario);
  if (selected.length < 2)
    throw new Error("Sélectionnez au moins deux étapes ou groupes.");
  if (new Set(selected.map((id) => parents.get(id) || "")).size > 1)
    throw new Error("Sélectionnez des éléments entiers du même niveau.");
  const known = new Set(
    [...scenario.nodes, ...(scenario.groups || [])].map((n) => n.id),
  );
  if (selected.some((id) => !known.has(id)))
    throw new Error("Une étape sélectionnée est absente.");
  const owners = new Map(
    selected.flatMap((id) =>
      groupLeaves(scenario, id).map((leaf) => [leaf, id]),
    ),
  );
  const adjacent = new Map(selected.map((id) => [id, []]));
  for (const e of scenario.edges) {
    const a = owners.get(e.source),
      b = owners.get(e.target);
    if (a && b) {
      adjacent.get(a).push(b);
      adjacent.get(b).push(a);
    }
  }
  const reached = new Set([selected[0]]),
    queue = [selected[0]];
  for (const id of queue)
    for (const next of adjacent.get(id))
      if (!reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
  if (reached.size !== selected.length) {
    // Report a shortest connecting path through omitted steps; no automatic inclusion.
    const all = new Map(scenario.nodes.map((n) => [n.id, []]));
    scenario.edges.forEach((e) => {
      all.get(e.source)?.push(e.target);
      all.get(e.target)?.push(e.source);
    });
    const start = groupLeaves(scenario, selected[0]),
      target = new Set(
        selected
          .filter((id) => !reached.has(id))
          .flatMap((id) => groupLeaves(scenario, id)),
      );
    const paths = start.map((id) => [id]),
      visited = new Set(start);
    let missing = [];
    for (const path of paths) {
      if (target.has(path.at(-1))) {
        missing = path.filter((id) => !owners.has(id));
        break;
      }
      for (const next of all.get(path.at(-1)) || [])
        if (!visited.has(next)) {
          visited.add(next);
          paths.push([...path, next]);
        }
    }
    throw new Error(
      missing.length
        ? `Sélection discontinue. Complétez avec : ${missing.map((id) => scenario.nodes.find((n) => n.id === id)?.data.label || id).join(", ")}.`
        : "Sélection discontinue : aucune connexion entre ces ensembles.",
    );
  }
  return {
    ids: selected,
    parentId: parents.get(selected[0]),
    leaves: [...owners.keys()],
  };
}
export function cleanGroups(scenario) {
  const next = copy(scenario);
  next.groups ||= [];
  let changed = true;
  while (changed) {
    const ids = new Set([...next.nodes, ...next.groups].map((n) => n.id));
    next.groups.forEach((g) => {
      g.members = g.members.filter((id) => ids.has(id));
    });
    const count = next.groups.length;
    next.groups = next.groups.filter((g) => g.members.length);
    changed = count !== next.groups.length;
  }
  if (next.decompositionDrafts)
    next.decompositionDrafts = next.decompositionDrafts.filter((d) =>
      next.nodes.some((n) => n.id === d.nodeId),
    );
  return next;
}
export function applyGroupCommand(scenario, command) {
  let next = copy(scenario);
  next.groups ||= [];
  next.decompositionDrafts ||= [];
  const g = next.groups.find((g) => g.id === command.id);
  if (command.type === "group") {
    const { ids, parentId } = groupingSelection(next, command.ids);
    if (!command.name?.trim())
      throw new Error("Donnez un nom au sous-processus.");
    if ([...next.nodes, ...next.groups].some((n) => n.id === command.id))
      throw new Error("Identifiant déjà utilisé.");
    if (parentId)
      next.groups.find((g) => g.id === parentId).members = next.groups
        .find((g) => g.id === parentId)
        .members.filter((id) => !ids.includes(id))
        .concat(command.id);
    next.groups.push({
      id: command.id,
      name: command.name.trim(),
      members: ids,
    });
  } else if (command.type === "renameGroup") {
    if (!g || !command.name?.trim()) throw new Error("Nom de groupe invalide.");
    g.name = command.name.trim();
  } else if (command.type === "ungroup" || command.type === "deleteGroup") {
    if (!g) throw new Error("Sous-processus absent.");
    const removed = new Set(
      command.type === "deleteGroup" ? groupLeaves(next, g.id) : [],
    );
    const groupIds = new Set([g.id]);
    if (removed.size)
      for (const other of next.groups)
        if (
          other.id !== g.id &&
          groupLeaves(next, other.id).every((id) => removed.has(id))
        )
          groupIds.add(other.id);
    next.groups = next.groups.filter((other) => !groupIds.has(other.id));
    next.groups.forEach((other) => {
      other.members = other.members.flatMap((id) =>
        id === g.id ? (removed.size ? [] : g.members) : [id],
      );
    });
    next.nodes = next.nodes.filter((n) => !removed.has(n.id));
    next.edges = next.edges.filter(
      (e) => !removed.has(e.source) && !removed.has(e.target),
    );
    next.decompositionDrafts = next.decompositionDrafts.filter(
      (d) => !removed.has(d.nodeId),
    );
    next.retiredGroups = [
      ...(next.retiredGroups || []),
      { ...g, retiredReason: command.type },
    ];
    next = cleanGroups(next);
  } else if (command.type === "moveGroup") {
    if (!g) throw new Error("Sous-processus absent.");
    if (!Number.isFinite(command.dx) || !Number.isFinite(command.dy))
      throw new Error("Déplacement invalide.");
    const leaves = new Set(groupLeaves(next, g.id));
    if (next.nodes.some((n) => leaves.has(n.id) && n.data.positionLocked))
      throw new Error("Une étape du groupe est verrouillée.");
    next.nodes.forEach((n) => {
      if (leaves.has(n.id))
        n.position = {
          x: n.position.x + command.dx,
          y: n.position.y + command.dy,
        };
    });
  } else if (command.type === "saveDraft") {
    const node = next.nodes.find((n) => n.id === command.nodeId);
    if (!node || node.type !== "process")
      throw new Error("Choisissez une étape de traitement.");
    const old = next.decompositionDrafts.find((d) => d.nodeId === node.id);
    const draft = {
      ...copy(command.draft),
      id: node.id,
      nodeId: node.id,
      reference: old?.reference || copy(node),
    };
    next.decompositionDrafts = next.decompositionDrafts
      .filter((d) => d.nodeId !== node.id)
      .concat(draft);
  } else if (command.type === "discardDraft")
    next.decompositionDrafts = next.decompositionDrafts.filter(
      (d) => d.nodeId !== command.nodeId,
    );
  else if (command.type === "activateDraft") {
    if (command.draft) {
      next = applyGroupCommand(next, {
        type: "saveDraft",
        nodeId: command.nodeId,
        draft: command.draft,
      });
    }
    const draft = next.decompositionDrafts.find(
        (d) => d.nodeId === command.nodeId,
      ),
      original = next.nodes.find((n) => n.id === command.nodeId);
    if (!draft || !original || !draft.nodes?.length)
      throw new Error("Le détail est vide.");
    const members = new Set(draft.nodes.map((n) => n.id));
    if (
      members.size !== draft.nodes.length ||
      draft.nodes.some(
        (n) =>
          next.nodes.some((old) => old.id === n.id) ||
          next.groups.some((g) => g.id === n.id),
      )
    )
      throw new Error("Identifiants du détail invalides.");
    if (
      draft.edges.some((e) => !members.has(e.source) || !members.has(e.target))
    )
      throw new Error("Connexion du détail orpheline.");
    if (draft.nodes.length > 1)
      groupingSelection(
        { ...next, nodes: draft.nodes, edges: draft.edges, groups: [] },
        [...members],
      );
    const boundary = next.edges.filter(
      (e) => e.source === original.id || e.target === original.id,
    );
    for (const e of boundary) {
      if (e.source === original.id && !members.has(draft.outputs?.[e.id]))
        throw new Error("Associez chaque sortie à une sous-étape.");
      if (e.target === original.id && !members.has(draft.inputs?.[e.id]))
        throw new Error("Associez chaque entrée à une sous-étape.");
    }
    const categoryIds = new Set(
      next.nodes.flatMap((n) => n.data.volumeItems || []).map((c) => c.id),
    );
    if (
      draft.nodes.some((n) =>
        Object.keys(n.data.cycleTimes || {}).some((id) => !categoryIds.has(id)),
      )
    )
      throw new Error("Catégorie du détail absente du scénario.");
    next.nodes = next.nodes
      .filter((n) => n.id !== original.id)
      .concat(copy(draft.nodes));
    next.edges = next.edges
      .map((e) => ({
        ...e,
        source: e.source === original.id ? draft.outputs[e.id] : e.source,
        target: e.target === original.id ? draft.inputs[e.id] : e.target,
      }))
      .concat(copy(draft.edges));
    if (new Set(next.edges.map((e) => e.id)).size !== next.edges.length)
      throw new Error("Identifiant de connexion dupliqué.");
    next.groups.push({
      id: original.id,
      name: original.data.label,
      members: [...members],
      reference: copy(original),
      draftReference: copy(draft.reference),
    });
    for (const [kind, field] of Object.entries(resourceFields)) {
      const used = new Set(draft.nodes.flatMap((n) => n.data[field] || []));
      const entries = new Map((next[kind] || []).map((r) => [r.id, r]));
      for (const id of used) {
        const resource =
          (draft[kind] || []).find((r) => r.id === id) || entries.get(id);
        if (!resource) throw new Error(`Ressource absente du détail : ${id}`);
        entries.set(id, copy(resource));
      }
      next[kind] = [...entries.values()];
    }
    const analysis = analyze(next);
    if (
      analysis.issues.some((i) => ["routing", "invalid-edge"].includes(i.kind))
    )
      throw new Error("Corrigez les routages et connexions avant activation.");
    if (!analysis.complete && !command.acceptIncomplete)
      throw new Error(
        "Acceptez explicitement les indicateurs incomplets avant validation.",
      );
    next.decompositionDrafts = next.decompositionDrafts.filter(
      (d) => d.nodeId !== original.id,
    );
  } else throw new Error("Commande de sous-processus inconnue.");
  return validateGroups(next);
}
export function summarizeGroup(scenario, id, analysis = analyze(scenario)) {
  const ids = new Set(groupLeaves(scenario, id)),
    nodes = scenario.nodes.filter((n) => ids.has(n.id));
  const incoming = scenario.edges.filter(
      (e) => !ids.has(e.source) && ids.has(e.target),
    ),
    outgoing = scenario.edges.filter(
      (e) => ids.has(e.source) && !ids.has(e.target),
    );
  const edgeResults = new Map((analysis.edges || []).map((e) => [e.id, e]));
  const internal = scenario.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target),
  );
  const localNodes = copy(nodes),
    localEdges = copy(internal);
  incoming.forEach((e, i) => {
    const source = `__group_in_${i}`;
    localNodes.push({
      id: source,
      type: "startEnd",
      data: {
        type: "start",
        volumeItems: (edgeResults.get(e.id)?.categories || []).map((c) => ({
          id: c.category,
          name: c.name,
          value: c.volume,
        })),
      },
    });
    localEdges.push({
      id: `__in_${i}`,
      source,
      target: e.target,
      data: { percentage: 100, wait_time: 0 },
    });
  });
  outgoing.forEach((e, i) => {
    const target = `__group_out_${i}`;
    localNodes.push({ id: target, type: "startEnd", data: { type: "end" } });
    localEdges.push({
      ...copy(e),
      target,
      data: {
        ...copy(e.data),
        wait_time: 0,
        itemData: {},
        measurements: Object.fromEntries(
          Object.entries(e.data?.measurements || {}).filter(
            ([k]) => !k.startsWith("wait:"),
          ),
        ),
      },
    });
  });
  const local = analyze({ ...scenario, nodes: localNodes, edges: localEdges });
  const totals = (edges) => {
    const result = new Map();
    if (
      edges.some((e) => !edgeResults.get(e.id)?.categories.length) &&
      analysis.issues.some((i) => i.kind === "cycle")
    )
      return [
        ...new Map(
          scenario.nodes
            .flatMap((n) => n.data.volumeItems || [])
            .map((c) => [c.id, { category: c.id, name: c.name, volume: null }]),
        ).values(),
      ];
    edges.forEach((e) =>
      (edgeResults.get(e.id)?.categories || []).forEach((c) => {
        const old = result.get(c.category);
        result.set(c.category, {
          ...c,
          volume:
            c.volume === null || old?.volume === null
              ? null
              : (old?.volume || 0) + c.volume,
        });
      }),
    );
    return [...result.values()];
  };
  const inputs = totals(incoming),
    outputs = totals(outgoing);
  nodes
    .filter((n) => n.type === "startEnd" && n.data.type === "start")
    .forEach((n) =>
      (n.data.volumeItems || []).forEach((c) => {
        const old = inputs.find((x) => x.category === c.id);
        if (old)
          old.volume =
            old.volume === null || c.value == null
              ? null
              : old.volume + Number(c.value);
        else
          inputs.push({
            category: c.id,
            name: c.name,
            volume: c.value ?? null,
          });
      }),
    );
  nodes
    .filter((n) => !scenario.edges.some((e) => e.source === n.id))
    .forEach((n) => {
      const row = analysis.nodes.find((r) => r.id === n.id);
      row?.categories.forEach((c) => {
        const old = outputs.find((x) => x.category === c.category);
        if (old)
          old.volume =
            old.volume === null || c.volume === null
              ? null
              : old.volume + c.volume;
        else outputs.push(copy(c));
      });
    });
  const rows = analysis.nodes.filter((n) => ids.has(n.id));
  const workload =
    rows.length !== nodes.length || rows.some((n) => n.workload === null)
      ? null
      : rows.reduce((s, n) => s + n.workload, 0);
  const usesResource = (n, kind, field, id) =>
    n.data[field]?.includes(id) ||
    (kind === "actors" && Object.hasOwn(n.data.actorAllocations || {}, id));
  const resources = Object.fromEntries(
    Object.entries(resourceFields).map(([kind, field]) => [
      kind,
      (scenario[kind] || [])
        .filter((r) => nodes.some((n) => usesResource(n, kind, field, r.id)))
        .map((r) => ({
          ...r,
          usedBy: nodes
            .filter((n) => usesResource(n, kind, field, r.id))
            .map((n) => ({ id: n.id, name: n.data.label })),
        })),
    ]),
  );
  const issues = analysis.issues.filter(
    (i) =>
      ids.has(i.id) ||
      internal.some((e) => e.id === i.id) ||
      (i.kind === "allocation" && resources.actors.some((r) => r.id === i.id)),
  );
  const missingBoundary =
    incoming.some((e) => !edgeResults.get(e.id)?.categories.length) &&
    !analysis.complete;
  const categories = inputs.map((input) => {
    const terminalRows = local.terminals.filter((c) => c.category === input.category);
    const volume = terminalRows.reduce((total, c) => total + (c.volume || 0), 0);
    const loads = rows.flatMap((r) => r.categories.filter((c) => c.category === input.category));
    const validRouting = !local.issues.some((i) => ["cycle", "routing", "invalid-edge"].includes(i.kind));
    return {
      ...input,
      processing: missingBoundary || !validRouting || !volume || terminalRows.some((c) => c.processing == null || c.volume == null)
        ? null : terminalRows.reduce((total, c) => total + c.processing * c.volume, 0) / volume,
      workload: missingBoundary || rows.length !== nodes.length || loads.some((c) => c.workload == null) ? null : loads.reduce((total, c) => total + c.workload, 0),
    };
  });
  return {
    count: nodes.length,
    inputs,
    outputs,
    categories,
    workload,
    processing: missingBoundary ? null : local.processing,
    waiting: missingBoundary ? null : local.waiting,
    lead: missingBoundary ? null : local.lead,
    resources,
    rows,
    issues,
    complete: local.complete && !missingBoundary,
    incoming,
    outgoing,
  };
}
