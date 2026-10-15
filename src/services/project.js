import { validateProject } from "../utils/projectSchema.js";
export const clone = (value) => structuredClone(value);
export const uid = () => crypto.randomUUID();
export const libraries = ["tools", "actors", "knowledge"];
export function graphSnapshot(state) {
  return {
    ...clone(state.scenarioExtra || {}),
    nodes: clone(state.nodes),
    edges: clone(state.edges),
    ...Object.fromEntries(libraries.map((k) => [k, clone(state[k] || [])])),
  };
}
// Runtime geometry and legacy derived fields are never business edits.
export function signature(value) {
  return JSON.stringify(value, (key, v) =>
    [
      "selected",
      "dragging",
      "width",
      "height",
      "positionAbsolute",
      "__rf",
      "layoutMetrics",
      "volumeStreamIn",
      "volumeStreamOut",
      "volumeStream",
      "volume_in",
      "process_time_total",
      "fte_required",
      "utilization",
      "isError",
      "errors",
      "computedVolume",
    ].includes(key)
      ? undefined
      : v,
  );
}
export function migrateProject(raw) {
  const checked = validateProject(raw);
  if (!checked.ok || checked.errors.length) throw new Error(checked.errors.join("\n"));
  for (const kind of libraries) if (Array.isArray(raw[kind]) && raw[kind].length !== checked.project[kind].length)
    throw new Error(`Bibliothèque ${kind} invalide : import annulé pour préserver les données.`);
  const project = clone(checked.project);
  project.id ||= uid();
  project.meta = {
    ...project.meta,
    version: "3.0",
    engine: project.meta?.engine || "legacy-2",
  };
  if (!project.scenarios?.length) {
    const id = uid();
    project.scenarios = [
      {
        id,
        name: "Actuel",
        revision: 0,
        engine: "legacy-2",
        ...graphSnapshot(project),
        comments: [],
        presentation: [],
      },
    ];
    project.activeScenarioId = id;
    project.actualScenarioId = id;
  }
  if (
    new Set(project.scenarios.map((s) => s.id)).size !==
    project.scenarios.length
  )
    throw new Error("Identifiants de scénarios dupliqués.");
  project.scenarios = project.scenarios.map((s) => {
    const result = validateProject(s);
    if (!s.id || !result.ok || result.errors.length || libraries.some(kind => Array.isArray(s[kind]) && s[kind].length !== result.project[kind].length))
      throw new Error(`Scénario invalide : ${s.name || s.id}`);
    return {
      ...s,
      ...result.project,
      revision: Number.isInteger(s.revision) ? s.revision : 0,
      engine: s.engine || "legacy-2",
    };
  });
  if (
    !project.scenarios.some((s) => s.id === project.activeScenarioId) ||
    !project.scenarios.some((s) => s.id === project.actualScenarioId)
  )
    throw new Error("Référence de scénario absente.");
  return project;
}
export function activeScenario(project) {
  return project.scenarios.find((s) => s.id === project.activeScenarioId);
}
export function updateActive(project, snapshot, title) {
  const next = clone(project),
    current = activeScenario(next);
  Object.assign(current, snapshot, { revision: current.revision + 1 });
  Object.assign(
    next,
    Object.fromEntries(
      ["nodes", "edges", ...libraries].map((k) => [k, snapshot[k]]),
    ),
    { title },
  );
  return next;
}
export function duplicateScenario(
  project,
  name,
  snapshot = activeScenario(project),
) {
  const next = clone(project),
    id = uid();
  next.scenarios.push({
    ...clone(snapshot),
    id,
    name,
    revision: 0,
    archived: false,
    sourceScenarioId: snapshot.id,
    sourceRevision: snapshot.revision,
  });
  next.activeScenarioId = id;
  return next;
}
export function compareScenarios(a, b) {
  const changes = [];
  for (const kind of ["nodes", "edges", ...libraries]) {
    const left = new Map((a[kind] || []).map((x) => [x.id, x]));
    const right = new Map((b[kind] || []).map((x) => [x.id, x]));
    for (const id of new Set([...left.keys(), ...right.keys()])) {
      if (signature(left.get(id)) !== signature(right.get(id)))
        changes.push({
          kind,
          id,
          label:
            right.get(id)?.data?.label ||
            right.get(id)?.name ||
            left.get(id)?.data?.label ||
            id,
          type: !left.has(id)
            ? "ajout"
            : !right.has(id)
              ? "suppression"
              : "modification",
          before: left.get(id),
          after: right.get(id),
        });
    }
  }
  return changes;
}
