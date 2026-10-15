import { clone, uid, libraries } from "./project.js";
import { measurementRows, applySimulation } from "./simulation.js";
const fields = {
  tools: "toolsUsed",
  actors: "actorsUsed",
  knowledge: "knowledgeUsed",
};
export function createTemplate(scenario, selected, name) {
  const ids = new Set(selected),
    nodes = scenario.nodes.filter((n) => ids.has(n.id));
  if (!nodes.length) throw new Error("Sélectionnez au moins une étape.");
  const internal = scenario.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target),
  );
  const boundary = scenario.edges
    .filter((e) => ids.has(e.source) !== ids.has(e.target))
    .map((e) => ({
      direction: ids.has(e.source) ? "output" : "input",
      nodeId: ids.has(e.source) ? e.source : e.target,
      edge: clone(e),
    }));
  return {
    id: uid(),
    name,
    nodes: clone(nodes),
    edges: clone(internal),
    boundary,
    categories: [
      ...new Map(
        scenario.nodes
          .flatMap((n) => n.data.volumeItems || [])
          .map((c) => [c.id, c]),
      ).values(),
    ],
    parameters: measurementRows(scenario).filter((r) =>
      r.kind === "nodes" ? ids.has(r.id) : internal.some((e) => e.id === r.id),
    ),
    provenance: {
      scenarioId: scenario.id,
      revision: scenario.revision,
      createdAt: new Date().toISOString(),
    },
    ...Object.fromEntries(
      libraries.map((k) => [
        k,
        clone(
          (scenario[k] || []).filter((r) =>
            nodes.some((n) => n.data[fields[k]]?.includes(r.id)),
          ),
        ),
      ]),
    ),
  };
}
export function insertTemplate(
  scenario,
  template,
  categoryMap,
  offset = { x: 500, y: 0 },
  parameters = {},
) {
  const targetCategories = new Set(
    scenario.nodes.flatMap((n) => n.data.volumeItems || []).map((c) => c.id),
  );
  for (const category of template.categories) {
    if (
      !categoryMap[category.id] ||
      !targetCategories.has(categoryMap[category.id])
    )
      throw new Error(`Correspondance explicite requise pour ${category.name}`);
  }
  if (
    new Set(Object.values(categoryMap)).size !==
    Object.values(categoryMap).length
  )
    throw new Error(
      "Les catégories du modèle doivent avoir des correspondances distinctes.",
    );
  let result = clone(scenario);
  const ids = new Map(template.nodes.map((n) => [n.id, uid()])),
    resources = {};
  for (const kind of libraries) {
    resources[kind] = new Map((template[kind] || []).map((r) => [r.id, uid()]));
    result[kind] = [
      ...(result[kind] || []),
      ...(template[kind] || []).map((r) => ({
        ...clone(r),
        id: resources[kind].get(r.id),
        originId: r.id,
      })),
    ];
  }
  const remap = (object) =>
    object &&
    Object.fromEntries(
      Object.entries(object).map(([key, value]) => [
        categoryMap[key] || key,
        value,
      ]),
    );
  const remapMeasurements = (measurements) => Object.fromEntries(
    Object.entries(measurements || {}).map(([key, value]) => {
      const separator = key.indexOf(":");
      if (separator < 0) return [key, clone(value)];
      const field = key.slice(0, separator), category = key.slice(separator + 1);
      return [`${field}:${categoryMap[category] || category}`, clone(value)];
    }),
  );
  const minX = Math.min(...template.nodes.map((n) => n.position.x)),
    minY = Math.min(...template.nodes.map((n) => n.position.y));
  const nodes = template.nodes.map((n) => {
    const copy = clone(n);
    copy.id = ids.get(n.id);
    copy.originId = n.id;
    copy.position = {
      x: n.position.x - minX + offset.x,
      y: n.position.y - minY + offset.y,
    };
    copy.selected = false;
    copy.data.positionLocked = false;
    copy.data.templateOrigin = { id: template.id, ...template.provenance };
    copy.data.cycleTimes = remap(copy.data.cycleTimes);
    copy.data.volumeItems = copy.data.volumeItems?.map((c) => ({
      ...c,
      id: categoryMap[c.id] || c.id,
    }));
    for (const kind of libraries)
      copy.data[fields[kind]] = (copy.data[fields[kind]] || [])
        .map((id) => resources[kind].get(id))
        .filter(Boolean);
    if (copy.data.actorAllocations)
      copy.data.actorAllocations = Object.fromEntries(
        Object.entries(copy.data.actorAllocations)
          .map(([id, v]) => [resources.actors.get(id), v])
          .filter(([id]) => id),
      );
    copy.data.measurements = remapMeasurements(copy.data.measurements);
    return copy;
  });
  const edgeIds = new Map(template.edges.map((e) => [e.id, uid()]));
  const edges = template.edges.map((e) => ({
    ...clone(e),
    id: edgeIds.get(e.id),
    source: ids.get(e.source),
    target: ids.get(e.target),
    selected: false,
    data: {
      ...clone(e.data),
      itemRouting: remap(e.data.itemRouting),
      itemData: remap(e.data.itemData),
      measurements: remapMeasurements(e.data.measurements),
    },
  }));
  result.nodes.push(...nodes);
  result.edges.push(...edges);
  for (const parameter of template.parameters || []) {
    const key = `${parameter.id}:${parameter.key}`;
    if (!(key in parameters)) continue;
    result = applySimulation(result, [
      {
        ...parameter,
        id: ids.get(parameter.id) || edgeIds.get(parameter.id),
        category: categoryMap[parameter.category] || parameter.category,
        value: parameters[key],
      },
    ]);
  }
  return {
    scenario: result,
    insertedIds: nodes.map((n) => n.id),
    boundary: template.boundary.map((b) => ({
      ...b,
      nodeId: ids.get(b.nodeId),
    })),
  };
}
