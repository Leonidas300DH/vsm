import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import {
  migrateProject,
  duplicateScenario,
  compareScenarios,
  activeScenario,
} from "../src/services/project.js";
import {
  openWorkspaceDB,
  commitProject,
  readRecord,
  readAll,
} from "../src/services/storage.js";
import { calculateMetrics } from "../src/utils/calculations.js";
const simple = JSON.parse(
  fs.readFileSync(new URL("./fixtures/simple.vsm", import.meta.url)),
);
test("corpus opens without losing unknown business fields and reproduces legacy baseline", () => {
  const baseline = JSON.parse(
    fs.readFileSync(
      new URL("../docs/verification/baseline/results.json", import.meta.url),
    ),
  );
  for (const name of Object.keys(baseline.metrics)) {
    const raw = JSON.parse(
      fs.readFileSync(new URL(`./fixtures/${name}.vsm`, import.meta.url)),
    );
    const p = migrateProject(raw);
    assert.deepEqual(
      calculateMetrics(p.nodes, p.edges).metrics,
      baseline.metrics[name],
    );
    assert.deepEqual(p.extraBusinessField, raw.extraBusinessField);
    assert.equal(p.meta.engine, "legacy-2");
    assert.deepEqual(migrateProject(p), p);
  }
});
test("atomic saves, interrupted transactions, conflicts, retention and recovery", async () => {
  const db = await openWorkspaceDB(new IDBFactory());
  const p = migrateProject(simple);
  let rev = await commitProject(db, p);
  await assert.rejects(
    commitProject(db, { ...p, title: "lost" }, rev, "", { abort: true }),
  );
  assert.equal((await readRecord(db, "projects", p.id)).project.title, p.title);
  await assert.rejects(commitProject(db, p, 0), { name: "ConflictError" });
  rev = await commitProject(db, p, rev, "Reference");
  for (let i = 0; i < 52; i++) rev = await commitProject(db, p, rev);
  const history = await readAll(db, "versions");
  assert.equal(history.filter((v) => !v.name).length, 50);
  assert.equal(history.filter((v) => v.name).length, 1);
  db.close();
});
test("scenario duplicate is independent including resources and identical comparison is empty", () => {
  const p = migrateProject(simple);
  p.scenarios[0].tools = [{ id: "excel", name: "Excel" }];
  const copy = duplicateScenario(p, "Cible");
  assert.deepEqual(compareScenarios(p.scenarios[0], activeScenario(copy)), []);
  activeScenario(copy).tools[0].name = "Autre";
  assert.equal(p.scenarios[0].tools[0].name, "Excel");
  assert.equal(
    compareScenarios(p.scenarios[0], activeScenario(copy)).length,
    1,
  );
});

import { createStore } from "zustand/vanilla";
import { installWorkspace } from "../src/services/workspace.js";
const state = () => ({
  nodes: structuredClone(simple.nodes),
  edges: structuredClone(simple.edges),
  tools: [],
  actors: [],
  knowledge: [],
  projectTitle: "Test",
});
test("workspace revisions stable on reads, complete undo/redo, restoration and independent scenarios", async () => {
  const store = createStore(() => state()),
    controller = installWorkspace(store, {
      factory: new IDBFactory(),
      listen: false,
    });
  await controller.initialized;
  try {
    const first = store.getState().getWorkspaceProject();
    assert.deepEqual(store.getState().getWorkspaceProject(), first);
    store.setState({ projectTitle: "Changed" });
    assert.equal(
      store.getState().getWorkspaceProject().scenarios[0].revision,
      1,
    );
    store.getState().undoBusiness();
    assert.equal(store.getState().projectTitle, "Test");
    store.getState().redoBusiness();
    assert.equal(store.getState().projectTitle, "Changed");
    const p = duplicateScenario(
      store.getState().getWorkspaceProject(),
      "Target",
    );
    store.getState().editWorkspace(p);
    assert.equal(store.getState().getWorkspaceProject().scenarios.length, 2);
    store.getState().undoBusiness();
    assert.equal(store.getState().getWorkspaceProject().scenarios.length, 1);
    await store.getState().flushWorkspace("Named");
    const versions = await store.getState().listVersions();
    store.setState({ projectTitle: "Later" });
    await store.getState().flushWorkspace();
    await store.getState().restoreVersion(versions[0]);
    assert.equal(store.getState().projectTitle, "Changed");
    assert.ok(
      (await store.getState().listVersions()).some(
        (v) => v.name === "Avant restauration",
      ),
    );
  } finally {
    controller.close();
  }
});
test("two workspaces conflict instead of overwriting and recover to a new project", async () => {
  const factory = new IDBFactory(),
    a = createStore(() => state()),
    ca = installWorkspace(a, { factory, listen: false });
  await ca.initialized;
  const b = createStore(() => state()),
    cb = installWorkspace(b, { factory, listen: false });
  await cb.initialized;
  try {
    a.setState({ projectTitle: "A" });
    await a.getState().flushWorkspace();
    b.setState({ projectTitle: "B" });
    await assert.rejects(b.getState().flushWorkspace(), {
      name: "ConflictError",
    });
    assert.equal(b.getState().saveStatus, "conflict");
    await b.getState().recoverCopy();
    assert.notEqual(
      a.getState().workspaceProject.id,
      b.getState().workspaceProject.id,
    );
    assert.equal((await b.getState().listProjects()).length, 2);
  } finally {
    ca.close();
    cb.close();
  }
});
test("named versions travel with the file and are restored as local history", async () => {
  const factory = new IDBFactory(),
    s = createStore(() => state()),
    c = installWorkspace(s, { factory, listen: false });
  await c.initialized;
  try {
    await s.getState().flushWorkspace("Portable");
    const exported = s.getState().getWorkspaceProject();
    exported.id = crypto.randomUUID();
    exported.namedVersions = (await s.getState().listVersions()).filter(
      (v) => v.name,
    );
    await s.getState().replaceWorkspace(exported);
    assert.ok(
      (await s.getState().listVersions()).some((v) => v.name === "Portable"),
    );
  } finally {
    c.close();
  }
});
test("storage quota failure aborts atomically and remains an explicit error", async () => {
  const db = await openWorkspaceDB(new IDBFactory()),
    p = migrateProject(simple);
  await commitProject(db, p);
  const quotaDB = {
    transaction(...args) {
      const tx = db.transaction(...args);
      const objectStore = tx.objectStore.bind(tx);
      tx.objectStore = (name) => {
        const store = objectStore(name);
        if (name === "projects")
          store.put = () => {
            throw new DOMException("Stockage plein", "QuotaExceededError");
          };
        return store;
      };
      return tx;
    },
  };
  await assert.rejects(
    commitProject(quotaDB, { ...p, title: "Should not save" }, 1),
    { name: "QuotaExceededError" },
  );
  assert.equal((await readRecord(db, "projects", p.id)).project.title, p.title);
  db.close();
});

test("v3 migration refuses silent edge or library losses",()=>{
 const project=migrateProject({nodes:[],edges:[],tools:[],actors:[],knowledge:[]});
 project.scenarios[0].edges=[{id:"orphan",source:"missing",target:"missing",data:{}}];
 assert.throws(()=>migrateProject(project));
 assert.throws(()=>migrateProject({nodes:[],edges:[],tools:[{id:"bad"}]}));
});

test('scenario tabs preserve live edits, independent resources, views and named starting point', async () => {
  const factory = new IDBFactory(), store = createStore(() => state());
  const controller = installWorkspace(store, {factory, listen:false});
  await controller.initialized;
  try {
    const baseline = store.getState().workspaceProject.actualScenarioId;
    assert.equal(store.getState().scenarioExtra.name, 'Baseline');
    store.setState({tools:[{id:'excel',name:'Excel',logo:'embedded-original',metadata:{source:'custom'}}]});
    const original = structuredClone(store.getState().getWorkspaceProject().scenarios[0]);
    const future = await store.getState().copyScenario(baseline, 'Future State');
    assert.equal(store.getState().workspaceProject.activeScenarioId, future);
    assert.deepEqual(compareScenarios(original, activeScenario(store.getState().getWorkspaceProject())), []);
    store.setState({tools:[{id:'excel',name:'Changed',logo:'embedded-future',metadata:{source:'future'}}]});
    store.getState().rememberScenarioView({viewport:{x:50,y:90,zoom:.6},detailMode:'operations'});
    const revision = store.getState().scenarioExtra.revision;
    store.getState().switchScenario(baseline);
    assert.equal(store.getState().tools[0].name, 'Excel');
    assert.equal(store.getState().tools[0].logo, 'embedded-original');
    assert.equal(store.getState().scenarioExtra.revision, original.revision);
    store.getState().switchScenario(future);
    assert.equal(store.getState().tools[0].name, 'Changed');
    assert.equal(store.getState().scenarioExtra.revision, revision);
    assert.equal(store.getState().detailMode, 'operations');
    // A second copy still defaults to an explicit baseline source, not the edited active tab.
    const third = await store.getState().copyScenario(baseline, 'Today');
    assert.equal(store.getState().tools[0].name, 'Excel');
    assert.equal((await store.getState().listVersions()).filter(v=>v.name.startsWith('Point de départ')).length,1);
    const exported = migrateProject(JSON.parse(JSON.stringify(store.getState().getWorkspaceProject())));
    assert.equal(exported.scenarios.length, 3);
    assert.equal(exported.actualScenarioId, baseline);
    assert.equal(exported.activeScenarioId, third);
    assert.equal(exported.scenarios.find(s=>s.id===future).tools[0].logo,'embedded-future');
    await store.getState().flushWorkspace();
    const reopened = createStore(() => state()), next = installWorkspace(reopened,{factory,listen:false});
    await next.initialized;
    assert.equal(reopened.getState().workspaceProject.activeScenarioId,third);
    reopened.getState().switchScenario(future);
    assert.equal(reopened.getState().tools[0].metadata.source,'future');
    next.close();
  } finally { controller.close(); }
});
