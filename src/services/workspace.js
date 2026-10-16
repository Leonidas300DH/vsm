import { linkedSession, prepareLinkedEdit, needsLinkedPreview } from './linkedEditing.js';
import { calculateMetrics } from "../utils/calculations.js";
import {
  graphSnapshot,
  migrateProject,
  activeScenario,
  signature,
  clone,
  uid,
  duplicateScenario,
} from "./project.js";
import {
  openWorkspaceDB,
  readRecord,
  readAll,
  commitProject,
  importNamedVersions,
} from "./storage.js";
const graphKeys = ["nodes", "edges", "tools", "actors", "knowledge"];
export function installWorkspace(store, { factory, listen = true } = {}) {
  let db,
    revision = 0,
    timer,
    applying = false,
    ready = false;
  let writes = Promise.resolve(),
    past = [],
    future = [],
    previous,
    lastKey,
    lastState,
    historyGroup = null;
  const status = (saveStatus, saveError = "") =>
    store.setState({ saveStatus, saveError });
  const capture = () => {
    const s = store.getState(),
      p = clone(s.workspaceProject),
      snapshot = graphSnapshot(s);
    p.scenarios = p.scenarios.map((c) =>
      c.id === p.activeScenarioId ? { ...c, ...snapshot } : c,
    );
    return {
      ...p,
      ...Object.fromEntries(graphKeys.map((k) => [k, snapshot[k]])),
      title: s.projectTitle,
    };
  };
  const extra = (scenario) =>
    Object.fromEntries(
      Object.entries(scenario).filter(([k]) => !graphKeys.includes(k)),
    );
  function hydrate(project) {
    const scenario = activeScenario(project);
    applying = true;
    store.setState({
      workspaceProject: clone(project),
      projectTitle: project.title,
      ...calculateMetrics(scenario.nodes, scenario.edges),
      tools: clone(scenario.tools || []),
      actors: clone(scenario.actors || []),
      knowledge: clone(scenario.knowledge || []),
      scenarioExtra: clone(extra(scenario)),
      selectedNodeId: null,
      selectedStepId: null,
      selectedItemId: null,
      edgeLabelSizes: {},
      comparisonIds: [],
      focus: null,
      lastDeletion: null,
      inspectionDiagnostic: null,
      detailMode: store.getState().scenarioViews?.[`${project.id}:${scenario.id}`]?.detailMode || "detailed",
    });
    applying = false;
    previous = capture();
    lastKey = signature(previous);
    lastState = store.getState();
  }
  function flush(name = "") {
    clearTimeout(timer);
    const operation = writes.then(() => write(name));
    writes = operation.catch(() => {});
    return operation;
  }
  async function write(name = "") {
    if (!ready) throw new Error("Récupération en cours.");
    if (!db) db = await openWorkspaceDB(factory);
    status("saving");
    const project = capture(),
      key = signature(project);
    try {
      revision = await commitProject(db, project, revision, name);
      if (signature(capture()) === key) status("saved");
      else timer = setTimeout(() => flush().catch(() => {}), 1000);
    } catch (error) {
      status(
        error.name === "ConflictError" ? "conflict" : "error",
        error.message,
      );
      throw error;
    }
  }
  const schedule = () => {
    status("pending");
    clearTimeout(timer);
    timer = setTimeout(() => flush().catch(() => {}), 1000);
  };
  function applyHistory(project) {
    historyGroup = null;
    const linkConfig = store.getState().linkedEditSession || capture().linkedEditing;
    project.linkedEditing = linkConfig ? { ...clone(linkConfig), active: false } : undefined;
    const live = capture();
    project.scenarios = project.scenarios.map((c) => ({
      ...c,
      revision:
        Math.max(
          c.revision,
          live.scenarios.find((x) => x.id === c.id)?.revision || 0,
        ) + 1,
    }));
    hydrate(project);
    const currentSession = store.getState().linkedEditSession;
    if (currentSession) {
      const normalized = linkedSession(project, currentSession);
      store.setState({ linkedEditSession: { ...normalized, active: currentSession.active && normalized.masterId === currentSession.masterId } });
    }
    store.setState({ canUndo: past.length > 0, canRedo: future.length > 0 });
    schedule();
  }
  const initial = migrateProject({
    title: store.getState().projectTitle,
    ...graphSnapshot(store.getState()),
  });
  store.setState({
    workspaceProject: initial,
    scenarioExtra: extra(activeScenario(initial)),
    saveStatus: "loading",
    saveError: "",
    canUndo: false,
    canRedo: false,
    detailMode: "detailed",
    scenarioViews: (() => { try { const views = JSON.parse(localStorage.getItem('vsm.scenarioViews') || '{}'); return views && typeof views === 'object' && !Array.isArray(views) ? views : {}; } catch { return {}; } })(),
    rememberScenarioView: (view) => {
      const state = store.getState(), p = state.workspaceProject;
      const key = `${p.id}:${p.activeScenarioId}`;
      const scenarioViews = { ...state.scenarioViews, [key]: { ...state.scenarioViews[key], ...view } };
      store.setState({ scenarioViews });
      try { localStorage.setItem('vsm.scenarioViews', JSON.stringify(scenarioViews)); } catch { /* Session view remains available. */ }
    },
    switchScenario: (id) => {
      const project = capture(), target = project.scenarios.find(s => s.id === id && !s.archived);
      if (!target) throw new Error("Scénario introuvable ou archivé.");
      if (id === project.activeScenarioId) return;
      project.activeScenarioId = id;
      hydrate(project);
      schedule();
    },
    copyScenario: async (sourceId, name, snapshot) => {
      if (!name.trim()) throw new Error("Donnez un nom à l’onglet.");
      let project = capture();
      if (!project.scenarios.some(s => s.id === sourceId)) throw new Error("Scénario source introuvable.");
      if (!project.scenarioStartingPointSaved) {
        await flush("Point de départ · " + project.scenarios.find(s => s.id === project.actualScenarioId).name);
        project = capture();
      }
      const source = snapshot || project.scenarios.find(s => s.id === sourceId);
      const next = duplicateScenario(project, name.trim(), source);
      next.scenarioStartingPointSaved = true;
      store.getState().editWorkspace(next);
      await flush();
      return next.activeScenarioId;
    },
    linkedEditSession: null,
    endLinkedEditing: () => {
      if (store.getState().linkedEditSession) store.getState().configureLinkedEditing({ active: false });
      store.setState({ linkedEditSession: null });
      historyGroup = null;
    },
    beginLinkedEditing: () => {
      const project = capture();
      store.setState({ linkedEditSession: linkedSession(project) });
    },
    configureLinkedEditing: (updates) => {
      const project = capture(), current = store.getState().linkedEditSession || linkedSession(project);
      const session = { ...linkedSession(project, { ...current, ...updates }), active: updates.masterId && updates.masterId !== current.masterId ? false : (updates.active ?? current.active) };
      project.linkedEditing = { ...session, active: false };
      historyGroup = null;
      hydrate(project);
      store.setState({ linkedEditSession: session });
      schedule();
    },
    previewLinkedEdit: (originId, command, geometry) => prepareLinkedEdit(capture(), store.getState().linkedEditSession || linkedSession(capture()), originId, command, geometry),
    applyLinkedEdit: (originId, command, { confirmed = false, group, geometry } = {}) => {
      const state = store.getState(), session = state.linkedEditSession;
      if (!session) throw new Error('Ouvrez l’édition liée avant de modifier une carte.');
      if (needsLinkedPreview(command) && !confirmed) throw new Error('Vérifiez l’aperçu avant application.');
      // A direct child action is local, even if a caller missed the selection event.
      const effective = originId !== session.masterId ? { ...session, linkedIds: session.linkedIds.filter(id => id !== originId) } : session;
      const result = prepareLinkedEdit(capture(), effective, originId, command, geometry);
      if (originId !== session.masterId && session.linkedIds.includes(originId)) store.getState().configureLinkedEditing({ linkedIds: effective.linkedIds });
      result.project.linkedEditing = { ...effective, active: false };
      if (result.report.length) store.getState().editWorkspace(result.project, { group });
      return result;
    },
    comparisonIds: [],
    setDetailMode: (detailMode) => { store.setState({ detailMode }); store.getState().rememberScenarioView({ detailMode }); },
    flushWorkspace: flush,
    getWorkspaceProject: capture,
    listVersions: async () =>
      (await readAll(db, "versions"))
        .filter((v) => v.projectId === store.getState().workspaceProject.id)
        .sort((a, b) => b.revision - a.revision),
    listProjects: async () => readAll(db, "projects"),
    openSavedProject: async (id) => {
      await flush();
      const record = await readRecord(db, "projects", id);
      if (record) {
        revision = record.revision;
        hydrate(migrateProject(record.project));
        past = [];
        future = [];
        store.setState({ canUndo: false, canRedo: false, linkedEditSession: null });
        await flush();
      }
    },
    replaceWorkspace: async (raw) => {
      const p = migrateProject(raw);
      const imported = (p.namedVersions || [])
        .filter((v) => v.name)
        .map((v) => {const versionProject=migrateProject(v.project);delete versionProject.namedVersions;return {...v,project:versionProject};});
      delete p.namedVersions;
      await flush();
      const existing = await readRecord(db, "projects", p.id);
      revision = existing?.revision || 0;
      hydrate(p);
      past = [];
      future = [];
      store.setState({ canUndo: false, canRedo: false, linkedEditSession: null });
      await flush();
      await importNamedVersions(db, p.id, imported);
    },
    editWorkspace: (project, { group } = {}) => {
      const before = capture();
      if (!group || group !== historyGroup) past.push(before);
      past = past.slice(-100);
      historyGroup = group || null;
      future = [];
      project = clone(project);
      project.scenarios = project.scenarios.map((c) => {
        const old = before.scenarios.find((s) => s.id === c.id);
        return {
          ...c,
          revision:
            old &&
            signature({ ...old, revision: 0 }) !==
              signature({ ...c, revision: 0 })
              ? Math.max(c.revision, old.revision) + 1
              : c.revision,
        };
      });
      hydrate(project);
      store.setState({ canUndo: true, canRedo: false });
      schedule();
    },
    restoreVersion: async (version) => {
      await flush("Avant restauration");
      past.push(capture());
      future = [];
      applyHistory(clone(version.project));
      await flush(`Restauration de ${version.name || version.updatedAt}`);
    },
    recoverCopy: async () => {
      const project = capture();
      project.id = uid();
      project.title += " · récupération";
      revision = 0;
      hydrate(project);
      await flush("Copie de récupération");
    },
    undoBusiness: () => {
      if (!past.length) return;
      future.push(capture());
      applyHistory(past.pop());
    },
    redoBusiness: () => {
      if (!future.length) return;
      past.push(capture());
      applyHistory(future.pop());
    },
  });
  store.subscribe((state) => {
    if (!ready || applying) return;
    // Skip geometry observations, labels, preferences and save-status notifications.
    if (
      lastState &&
      state.workspaceProject === lastState.workspaceProject &&
      state.scenarioExtra === lastState.scenarioExtra &&
      state.projectTitle === lastState.projectTitle &&
      graphKeys.every((k) => state[k] === lastState[k])
    )
      return;
    const project = capture(),
      key = signature(project);
    lastState = state;
    if (key === lastKey) return;
    const structural =
      project.nodes.length !== previous.nodes.length ||
      project.edges.length !== previous.edges.length;
    past.push(previous);
    past = past.slice(-100);
    future = [];
    const scenario = activeScenario(project);
    scenario.revision++;
    applying = true;
    store.setState({
      workspaceProject: project,
      scenarioExtra: extra(scenario),
      canUndo: true,
      canRedo: false,
    });
    applying = false;
    previous = capture();
    lastKey = signature(previous);
    lastState = store.getState();
    schedule();
    if (structural) queueMicrotask(() => flush().catch(() => {}));
  });
  const initialize = async () => {
    try {
      db = await openWorkspaceDB(factory);
      const last = await readRecord(db, "settings", "lastProject");
      const record = last && (await readRecord(db, "projects", last.projectId));
      if (record) {
        revision = record.revision;
        hydrate(migrateProject(record.project));
      }
      previous = capture();
      lastKey = signature(previous);
      lastState = store.getState();
      ready = true;
      status("saved");
      if (!record) await flush();
    } catch (error) {
      previous = capture();
      lastKey = signature(previous);
      lastState = store.getState();
      ready = true;
      status("error", error.message);
    }
  };
  const initialized = initialize();
  if (listen && typeof window !== "undefined") {
    window.addEventListener("pagehide", () => flush().catch(() => {}));
    window.addEventListener("keydown", (e) => {
      if (
        !document.querySelector(".scenario-comparison, .linked-editor") &&
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "z" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
      ) {
        e.preventDefault();
        store.getState()[e.shiftKey ? "redoBusiness" : "undoBusiness"]();
      }
    });
  }
  return {
    initialized,
    close: () => {
      clearTimeout(timer);
      db?.close();
    },
  };
}
