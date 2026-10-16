import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  applyGroupCommand,
  validateGroups,
  groupingSelection,
  groupingUnits,
  groupParents,
  groupLeaves,
  summarizeGroup,
} from "../src/services/groups.js";
import {
  projectGroups,
  inlineGroupView,
  layoutGroups,
} from "../src/services/groupProjection.js";
import { analyze } from "../src/services/analysis.js";
import { calculateMetrics } from "../src/utils/calculations.js";
import {
  migrateProject,
  duplicateScenario,
  compareScenarios,
} from "../src/services/project.js";
import {
  prepareLinkedEdit,
  linkedSession,
} from "../src/services/linkedEditing.js";
import { createTemplate, insertTemplate } from "../src/services/templates.js";
import { attachmentReferences } from "../src/services/portable.js";
import { analysisPackage } from "../src/services/proposals.js";
import { IDBFactory } from "fake-indexeddb";
import { createStore } from "zustand/vanilla";
import { installWorkspace } from "../src/services/workspace.js";
const simple = JSON.parse(
  fs.readFileSync(new URL("./fixtures/simple.vsm", import.meta.url)),
);
function fixture(count = 3) {
  const s = structuredClone(simple);
  s.nodes = s.nodes.filter((n) => n.id !== "p");
  s.nodes.splice(
    1,
    0,
    ...Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      type: "process",
      position: { x: 900 * (i + 1), y: 0 },
      data: {
        label: `Étape ${i}`,
        cycleTimes: { a: i + 1 },
        wait_time: 2,
        toolsUsed: ["excel"],
        actorAllocations: { person: 1 / count },
      },
    })),
  );
  s.nodes.at(-1).position.x = 900 * (count + 1);
  s.edges = s.nodes.slice(1).map((n, i) => ({
    id: `e${i}`,
    source: s.nodes[i].id,
    target: n.id,
    data: { percentage: 100, wait_time: 1 },
  }));
  s.tools = [{ id: "excel", name: "Excel", logo: "data:image/png;base64,x" }];
  s.actors = [
    { id: "person", name: "Analyste", headcount: 1, availableTime: 480 },
  ];
  s.knowledge = [];
  return s;
}
const group = (s, ids = ["p0", "p1"], id = "g") =>
  applyGroupCommand(s, { type: "group", id, ids, name: "Contrôles" });
const metrics = (s) => {
  const a = analyze(s);
  return [a.workload, a.processing, a.waiting, a.lead, a.completedVolume];
};
test("rectangle selection groups a complete frame with its neighbour without duplicating its descendants", () => {
  const s = group(fixture());
  const ids = groupingUnits(["g", "p0", "p1", "p2"], groupParents(s));
  assert.deepEqual(ids, ["g", "p2"]);
  const nested = group(s, ids, "outer");
  assert.deepEqual(groupLeaves(nested, "outer"), ["p0", "p1", "p2"]);
  assert.deepEqual(metrics(nested), metrics(s));
});
test("rectangle selection inside an open group keeps the steps, not its context frame", () => {
  const s = group(fixture());
  assert.deepEqual(groupingUnits(["g", "p0", "p1"], groupParents(s), "g"), ["p0", "p1"]);
  assert.throws(() => groupingSelection(s, groupingUnits(["p0", "p2"], groupParents(s))), /même niveau/);
});
test("grouping and dissolving preserve every leaf, edge, resources and unknown business fields", () => {
  const s = fixture();
  s.nodes[1].data.unknown = { a: [1, 2] };
  const g = group(s);
  assert.deepEqual(g.nodes, s.nodes);
  assert.deepEqual(g.edges, s.edges);
  assert.deepEqual(metrics(g), metrics(s));
  assert.deepEqual(
    calculateMetrics(g.nodes, g.edges).metrics,
    calculateMetrics(s.nodes, s.edges).metrics,
  );
  const undone = applyGroupCommand(g, { type: "ungroup", id: "g" });
  assert.deepEqual(undone.nodes, s.nodes);
  assert.deepEqual(undone.edges, s.edges);
  assert.deepEqual(undone.tools, s.tools);
});
test("nested groups reach five levels, disallow duplicate parents and parent cycles", () => {
  let s = fixture(7);
  s = group(s);
  for (let i = 2; i < 6; i++)
    s = group(s, [i === 2 ? "g" : `g${i - 1}`, `p${i}`], `g${i}`);
  assert.equal(s.groups.length, 5);
  assert.equal(groupLeaves(s, "g5").length, 6);
  assert.throws(
    () =>
      validateGroups({
        ...s,
        groups: [...s.groups, { id: "bad", name: "Bad", members: ["p0"] }],
      }),
    /deux groupes/,
  );
  assert.throws(
    () =>
      validateGroups({
        ...s,
        groups: [
          { id: "a", name: "a", members: ["b"] },
          { id: "b", name: "b", members: ["a"] },
        ],
      }),
    /Cycle/,
  );
});
test("disconnected and partial hierarchy selections identify required correction", () => {
  const s = fixture();
  assert.throws(() => groupingSelection(s, ["p0", "p2"]), /Étape 1/);
  assert.throws(() => group(group(s), ["g", "p0"]), /même niveau/);
});
test("aggregate uses boundary passages and route-local times, not sum of repeated volumes", () => {
  const s = group(fixture());
  const a = summarizeGroup(s, "g");
  assert.equal(a.inputs[0].volume, 10);
  assert.equal(a.outputs[0].volume, 10);
  assert.equal(a.workload, 30);
  assert.equal(a.processing, 3);
  assert.equal(a.waiting, 5);
  assert.equal(a.lead, 8);
  assert.equal(a.categories[0].volume, 10);
  assert.equal(a.categories[0].processing, 3);
  assert.equal(a.categories[0].workload, 30);
  assert.equal(a.resources.tools.length, 1);
  assert.equal(a.resources.tools[0].usedBy.length, 2);
});
test("projection preserves canonical edge IDs, independent ports and never rewrites graph", () => {
  const s = group(fixture());
  const before = JSON.stringify(s);
  const p = projectGroups(s, { collapsed: ["g"] });
  assert.equal(p.nodes.filter((n) => n.type === "process").length, 1);
  assert.equal(p.edges.find((e) => e.id === "e0").target, "g");
  assert.equal(p.edges.find((e) => e.id === "e0").targetHandle, "in:e0");
  assert.equal(p.edges.find((e) => e.id === "e2").sourceHandle, "out:e2");
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(projectGroups(s, { focusId: "g" }), projectGroups(s));
});
test("unfolding nested groups keeps frames, neighbours and boundary connections on the full map", () => {
  const s = group(group(fixture(4)), ["g", "p2"], "outer");
  const original = structuredClone(s), totals = metrics(s);
  for (const collapsed of [["outer", "g"], ["g"], [], ["outer"], []]) {
    const projected = projectGroups(s, { collapsed });
    const visible = new Set(projected.nodes.map(n => n.id));
    for (const id of [s.nodes[0].id, "p3", s.nodes.at(-1).id, "outer"]) assert.ok(visible.has(id));
    assert.equal(visible.has("g"), !collapsed.includes("outer"));
    assert.equal(visible.has("p0"), !collapsed.includes("outer") && !collapsed.includes("g"));
    for (const id of ["e0", "e3", "e4"]) assert.ok(projected.edges.some(e => e.id === id));
    if (!collapsed.length) {
      assert.equal(projected.edges.length, s.edges.length);
      assert.ok(projected.nodes.filter(n => n.type === "subprocess").every(n => !n.data.collapsed));
      for (const node of s.nodes) assert.deepEqual(projected.nodes.find(n => n.id === node.id).position, node.position);
    }
    assert.deepEqual(s, original);
    assert.deepEqual(metrics(s), totals);
  }
});
test("old isolated-view preferences reopen the ancestor path without isolating it or opening siblings", () => {
  const s = group(group(fixture(4)), ["g", "p2"], "outer");
  const saved = { focusId: "g", collapsed: ["g", "outer", "other"], custom: 42 };
  const view = inlineGroupView(s, saved);
  assert.deepEqual(view, { collapsed: ["other"], custom: 42 });
  assert.deepEqual(saved.collapsed, ["g", "outer", "other"]);
  assert.deepEqual(inlineGroupView(s, view), view);
  assert.deepEqual(inlineGroupView(s), { collapsed: [] });
  assert.deepEqual(inlineGroupView(s, { focusId: "deleted", collapsed: ["outer"] }), { collapsed: ["outer"] });
  assert.equal(projectGroups(s, view).nodes.length, s.nodes.length + s.groups.length);
});
test("frames include full measured card and satellite extents; collective movement respects locks", () => {
  let s = group(fixture());
  s.nodes[1].height = 750;
  const box = projectGroups(s).boxes.get("g");
  assert.ok(box.height >= 840);
  const moved = applyGroupCommand(s, {
    type: "moveGroup",
    id: "g",
    dx: 30,
    dy: 40,
  });
  assert.equal(moved.nodes[1].position.y, 40);
  assert.equal(moved.nodes[3].position.y, 0);
  s.nodes[1].data.positionLocked = true;
  assert.throws(
    () => applyGroupCommand(s, { type: "moveGroup", id: "g", dx: 30, dy: 0 }),
    /verrouillée/,
  );
  assert.throws(() => layoutGroups(s), /verrouillées/);
});
test("folded links share a port for the same visible neighbour; detailed paths and weighted durations remain intact", () => {
  const s = fixture(4);
  s.edges = [
    {
      id: "a",
      source: "in",
      target: "p0",
      data: { percentage: 50, wait_time: 0 },
    },
    {
      id: "b",
      source: "in",
      target: "p1",
      data: { percentage: 50, wait_time: 0 },
    },
    {
      id: "c",
      source: "p0",
      target: "p2",
      data: { percentage: 100, wait_time: 0 },
    },
    {
      id: "d",
      source: "p1",
      target: "p2",
      data: { percentage: 100, wait_time: 0 },
    },
    {
      id: "e",
      source: "p2",
      target: "p3",
      data: { percentage: 100, wait_time: 0 },
    },
    {
      id: "f",
      source: "p3",
      target: "out",
      data: { percentage: 100, wait_time: 0 },
    },
  ];
  const g = group(s, ["p0", "p1", "p2"]);
  const a = summarizeGroup(g, "g");
  assert.equal(a.incoming.length, 2);
  assert.equal(a.inputs[0].volume, 10);
  assert.equal(a.processing, 4.5);
  assert.equal(a.workload, 45);
  assert.equal(a.categories[0].processing, 4.5);
  assert.equal(a.categories[0].workload, 45);
  const projected = projectGroups(g, { collapsed: ["g"] });
  const incoming = projected.edges.filter(e => e.target === "g");
  assert.equal(incoming.length, 1);
  assert.deepEqual(incoming[0].data.bundleEdgeIds, ["a", "b"]);
  assert.equal(incoming[0].data.volume, "10.0");
  assert.equal(projected.nodes.find(n => n.id === "g").data.inputs.length, 1);
  assert.equal(projectGroups(g).edges.filter(e => e.source === "in").length, 2);
});
test("KYC collapsed admission has one screening link with 70 + 30 dossiers, restoring every route on expansion", async () => {
  const { createExample } = await import("../src/data/example.js");
  const s = createExample(), original = structuredClone(s);
  const projected = projectGroups(s, { collapsed: ["kyc-admission"] });
  const edges = projected.edges.filter(e => e.source === "kyc-admission" && e.target === "screen");
  assert.equal(edges.length, 1);
  const edge = edges[0];
  assert.deepEqual(edge.data.bundleEdgeIds, ["complete-screen", "recheck-screen"]);
  assert.equal(edge.data.volume, "100.0");
  assert.deepEqual(edge.data.labelItems.map(i => [i.id, i.amount]), [["retail", 70], ["business", 30]]);
  assert.equal(edge.deletable, false);
  const card = projected.nodes.find(n => n.id === "kyc-admission");
  assert.equal(card.data.outputs.length, 1);
  assert.equal(edge.sourceHandle, `out:${edge.id}`);
  assert.equal(card.data.portOffsets[edge.sourceHandle], card.data.cardHeight / 2);
  const enriched = calculateMetrics(s.nodes, s.edges);
  assert.deepEqual(projectGroups({ ...s, ...enriched }, { collapsed: ["kyc-admission"] }).edges.find(e => e.id === edge.id).data, edge.data);
  assert.deepEqual(projectGroups(s).edges.map(e => e.id), s.edges.map(e => e.id));
  assert.deepEqual(s, original);
});
test("bundle aggregation is symmetric between two folded groups and leaves distinct destinations separate", () => {
  const s = fixture(4);
  s.groups = [{ id: "left", members: ["p0", "p1"] }, { id: "right", members: ["p2", "p3"] }];
  s.edges.push({ id: "extra", source: "p0", target: "p3", data: { percentage: 50 } });
  const projected = projectGroups(s, { collapsed: ["left", "right"] });
  const bundle = projected.edges.find(e => e.source === "left" && e.target === "right");
  assert.deepEqual(bundle.data.bundleEdgeIds, ["e2", "extra"]);
  assert.deepEqual(bundle.data.bundleGroupIds, ["left", "right"]);
  assert.equal(projected.nodes.find(n => n.id === "left").data.outputs.length, 1);
  assert.equal(projected.nodes.find(n => n.id === "right").data.inputs.length, 1);
  const withOther = { ...s, edges: [...s.edges, { id: "other", source: "p0", target: "out", data: { percentage: 0 } }] };
  assert.equal(projectGroups(withOther, { collapsed: ["left", "right"] }).edges.filter(e => e.source === "left").length, 2);
  const invalid = calculateMetrics(s.nodes, s.edges);
  invalid.edges.find(e => e.id === "extra").data.isError = true;
  const unknown = projectGroups({ ...s, ...invalid }, { collapsed: ["left", "right"] }).edges.find(e => e.id === bundle.id);
  assert.equal(unknown.data.volume, undefined);
  assert.equal(unknown.data.label, "Volume inconnu");
});
test("unknown measures and cycles never become a valid aggregate zero", () => {
  let s = fixture();
  s.nodes[1].data.cycleTimes.a = null;
  assert.equal(summarizeGroup(group(s), "g").workload, null);
  assert.equal(summarizeGroup(group(s), "g").categories[0].processing, null);
  assert.equal(summarizeGroup(group(s), "g").categories[0].workload, null);
  s = fixture();
  s.edges.push({
    id: "loop",
    source: "p1",
    target: "p0",
    data: { percentage: 50, wait_time: 0 },
  });
  const a = summarizeGroup(group(s), "g");
  assert.equal(a.workload, null);
  assert.equal(a.processing, null);
  assert.ok(a.issues.some((i) => i.kind === "cycle"));
});
test("merged cards keep step width and open ancestors contain all merged satellites", () => {
  const s = fixture();
  s.nodes[1].data.toolsUsed = Array.from({length:8}, (_, i) => `tool${i}`);
  const nested = group(group(s), ["g", "p2"], "outer");
  const p = projectGroups(nested, {collapsed:["g"]});
  const card = p.nodes.find(n => n.id === "g");
  const frame = p.nodes.find(n => n.id === "outer");
  assert.equal(card.width, 300);
  assert.ok(frame.position.y + frame.height >= card.position.y + card.height + 32);
  assert.equal(card.data.portOffsets["in:e0"], card.data.cardHeight / 2);
  assert.equal(card.data.portOffsets["out:e2"], card.data.cardHeight / 2);
  assert.deepEqual(metrics(nested), metrics(s));
});
function draft(s) {
  return {
    id: "p0",
    nodeId: "p0",
    nodes: [
      {
        id: "d1",
        type: "process",
        position: { x: 900, y: 0 },
        data: {
          label: "Détail 1",
          cycleTimes: { a: 1 },
          wait_time: 1,
          toolsUsed: ["excel"],
        },
      },
      {
        id: "d2",
        type: "process",
        position: { x: 1800, y: 0 },
        data: { label: "Détail 2", cycleTimes: { a: 2 }, wait_time: 1 },
      },
    ],
    edges: [
      {
        id: "de",
        source: "d1",
        target: "d2",
        data: { percentage: 100, wait_time: 0 },
      },
    ],
    inputs: { e0: "d1" },
    outputs: { e1: "d2" },
    tools: s.tools,
  };
}
test("draft is inert, portable, activated atomically and preserves initial reference", () => {
  const s = fixture();
  const d = draft(s);
  const saved = applyGroupCommand(s, {
    type: "saveDraft",
    nodeId: "p0",
    draft: d,
  });
  assert.deepEqual(metrics(saved), metrics(s));
  const imported = migrateProject(JSON.parse(JSON.stringify(saved)));
  assert.equal(imported.meta.version, "3.1");
  assert.equal(imported.scenarios[0].decompositionDrafts.length, 1);
  const next = applyGroupCommand(saved, {
    type: "activateDraft",
    nodeId: "p0",
  });
  assert.equal(
    next.nodes.some((n) => n.id === "p0"),
    false,
  );
  assert.equal(next.groups[0].id, "p0");
  assert.deepEqual(next.groups[0].reference, s.nodes[1]);
  assert.equal(next.edges.find((e) => e.id === "e0").target, "d1");
  assert.equal(next.edges.find((e) => e.id === "e1").source, "d2");
  assert.equal(next.decompositionDrafts.length, 0);
});
test("draft invalid mappings, disconnected details, duplicate IDs and unknowns need correction or explicit acceptance", () => {
  const s = fixture(),
    d = draft(s);
  d.inputs = {};
  assert.throws(
    () =>
      applyGroupCommand(s, { type: "activateDraft", nodeId: "p0", draft: d }),
    /entrée/,
  );
  d.inputs = { e0: "d1" };
  d.nodes[0].data.cycleTimes.a = null;
  assert.throws(
    () =>
      applyGroupCommand(s, { type: "activateDraft", nodeId: "p0", draft: d }),
    /incomplets/,
  );
  assert.equal(
    analyze(
      applyGroupCommand(s, {
        type: "activateDraft",
        nodeId: "p0",
        draft: d,
        acceptIncomplete: true,
      }),
    ).workload,
    null,
  );
  d.nodes[0].id = "p1";
  assert.throws(
    () =>
      applyGroupCommand(s, { type: "activateDraft", nodeId: "p0", draft: d }),
    /Identifiants|invalides/,
  );
});
test("delete group removes descendants and incident edges, keeps libraries and comment references", () => {
  let s = fixture();
  s.comments = [{ id: "c", targetId: "p0", text: "Review" }];
  s = group(s);
  const next = applyGroupCommand(s, { type: "deleteGroup", id: "g" });
  assert.deepEqual(
    next.nodes.map((n) => n.id),
    ["in", "p2", "out"],
  );
  assert.equal(next.edges.length, 1);
  assert.equal(next.comments[0].targetId, "p0");
  assert.equal(next.tools.length, 1);
});
test("copy comparison and template preserve hierarchy independently and remap members", () => {
  let p = migrateProject(group(fixture()));
  p = duplicateScenario(p, "Future", p.scenarios[0]);
  p.scenarios[1].groups[0].name = "Different";
  assert.equal(p.scenarios[0].groups[0].name, "Contrôles");
  const changes = compareScenarios(p.scenarios[0], p.scenarios[1]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].structural, true);
  const t = createTemplate(p.scenarios[0], ["g"], "Reusable");
  const inserted = insertTemplate(fixture(), t, { a: "a" }).scenario;
  validateGroups(inserted);
  assert.equal(inserted.groups.length, 1);
  assert.notEqual(inserted.groups[0].id, "g");
  assert.equal(groupLeaves(inserted, inserted.groups[0].id).length, 2);
});
test("analysis export includes hierarchy but excludes draft metadata and custom files", () => {
  const s = group(fixture());
  s.groups[0].reference = { data: { attachments: [{ id: "secret" }] } };
  s.decompositionDrafts = [
    {
      nodeId: "p2",
      reference: { data: { attachments: [{ id: "draftfile" }] } },
      nodes: [],
    },
  ];
  assert.deepEqual(
    attachmentReferences(s)
      .map((r) => r.id)
      .sort(),
    ["draftfile", "secret"],
  );
  const p = analysisPackage(s);
  assert.equal(p.scenario.groups[0].reference, undefined);
  assert.equal(p.scenario.decompositionDrafts, undefined);
});
test("linked hierarchy is atomic, independent children stay untouched and incompatibility blocks all", () => {
  let p = migrateProject(fixture());
  p = duplicateScenario(p, "A", p.scenarios[0]);
  p = duplicateScenario(p, "B", p.scenarios[0]);
  const [master, a, b] = p.scenarios.map((s) => s.id),
    session = {
      ...linkedSession(p, {
        masterId: master,
        childIds: [a, b],
        linkedIds: [a],
      }),
      active: true,
    };
  const c = {
    type: "hierarchy",
    operation: { type: "group", id: "g", ids: ["p0", "p1"], name: "G" },
  };
  const next = prepareLinkedEdit(p, session, master, c).project;
  assert.equal(next.scenarios[0].groups.length, 1);
  assert.equal(next.scenarios[1].groups.length, 1);
  assert.equal(next.scenarios[2].groups, undefined);
  const invalid = structuredClone(p);
  invalid.scenarios[1] = group(invalid.scenarios[1], ["p1", "p2"], "other");
  assert.throws(
    () => prepareLinkedEdit(invalid, session, master, c),
    /incompatible/,
  );
  assert.equal(invalid.scenarios[0].groups, undefined);
});
test("workspace undo redo restores complete hierarchy and activation after reload persistence", async () => {
  const store = createStore(() => ({ ...fixture(), projectTitle: "Group QA" })),
    api = installWorkspace(store, { factory: new IDBFactory(), listen: false });
  await api.initialized;
  try {
    store.getState().applyGroupCommand({
      type: "group",
      id: "g",
      ids: ["p0", "p1"],
      name: "G",
    });
    assert.equal(
      store.getState().getWorkspaceProject().scenarios[0].groups.length,
      1,
    );
    store.getState().undoBusiness();
    assert.equal(store.getState().scenarioExtra.groups, undefined);
    store.getState().redoBusiness();
    assert.equal(store.getState().scenarioExtra.groups.length, 1);
    const before = metrics(store.getState().getWorkspaceProject().scenarios[0]);
    store.getState().applyGroupCommand({
      type: "activateDraft",
      nodeId: "p0",
      draft: draft(fixture()),
    });
    assert.equal(
      store.getState().nodes.some((n) => n.id === "d1"),
      true,
    );
    store.getState().undoBusiness();
    assert.deepEqual(
      metrics(store.getState().getWorkspaceProject().scenarios[0]),
      before,
    );
    assert.equal(
      store.getState().scenarioExtra.groups[0].members.includes("p0"),
      true,
    );
    store.getState().redoBusiness();
    await store.getState().flushWorkspace();
    assert.equal(
      (await store.getState().listProjects())[0].project.scenarios[0].groups
        .length,
      2,
    );
  } finally {
    api.close();
  }
});
test("KYC grouped layout clears all non-containment collisions without changing data", async () => {
  const { createExample } = await import("../src/data/example.js");
  const { groupCollisions } =
    await import("../src/services/groupProjection.js");
  const s = createExample(),
    arranged = layoutGroups(s);
  assert.deepEqual(metrics(arranged), metrics(s));
  assert.deepEqual(groupCollisions(arranged), []);
  assert.equal(arranged.groups.length, 3);
  for (const collapsed of [
    ["kyc-admission"],
    ["kyc-documents"],
    ["kyc-completeness"],
    ["kyc-documents", "kyc-completeness"],
  ])
    assert.deepEqual(groupCollisions(arranged, { collapsed }), []);
});
test("200 steps / 500 connections / five levels: calculate, project and arrange safely", async () => {
  const { groupCollisions } =
    await import("../src/services/groupProjection.js");
  const nodes = Array.from({ length: 200 }, (_, i) => ({
    id: `n${i}`,
    type: i === 0 || i === 199 ? "startEnd" : "process",
    position: { x: i * 1000, y: 0 },
    data:
      i === 0
        ? {
            type: "start",
            volumeItems: [{ id: "a", name: "Dossiers", value: 100 }],
          }
        : i === 199
          ? { type: "end" }
          : { label: `Étape ${i}`, cycleTimes: { a: 2 }, wait_time: 1 },
  }));
  const edges = [];
  for (let gap = 1; edges.length < 500; gap++)
    for (let i = 0; i + gap < 200 && edges.length < 500; i++)
      edges.push({
        id: `e${edges.length}`,
        source: `n${i}`,
        target: `n${i + gap}`,
        data: { wait_time: 0 },
      });
  for (const e of edges)
    e.data.percentage = 100 / edges.filter((x) => x.source === e.source).length;
  const groups = [{ id: "g1", name: "Niveau 1", members: ["n1", "n2"] }];
  for (let i = 2; i <= 5; i++)
    groups.push({
      id: `g${i}`,
      name: `Niveau ${i}`,
      members: [`g${i - 1}`, `n${i + 1}`],
    });
  const s = { nodes, edges, groups };
  const before = metrics(s);
  const a = layoutGroups(s);
  assert.deepEqual(metrics(a), before);
  assert.deepEqual(groupCollisions(a), []);
  assert.equal(projectGroups(s, { collapsed: ["g5"] }).nodes.length, 195);
});
test("linked grouping and ungrouping undo/redo affect only explicitly linked scenarios", async () => {
  const store = createStore(() => ({ ...fixture(), projectTitle: "Links" })),
    api = installWorkspace(store, { factory: new IDBFactory(), listen: false });
  await api.initialized;
  try {
    let p = store.getState().getWorkspaceProject();
    p = duplicateScenario(p, "A", p.scenarios[0]);
    p = duplicateScenario(p, "B", p.scenarios[0]);
    store.getState().editWorkspace(p);
    const [master, a, b] = p.scenarios.map((s) => s.id);
    store.getState().beginLinkedEditing();
    store.getState().configureLinkedEditing({
      masterId: master,
      childIds: [a, b],
      linkedIds: [a],
      active: true,
    });
    store.getState().applyLinkedEdit(
      master,
      {
        type: "hierarchy",
        operation: { type: "group", id: "g", ids: ["p0", "p1"], name: "G" },
      },
      { confirmed: true },
    );
    assert.equal(
      store.getState().getWorkspaceProject().scenarios[1].groups.length,
      1,
    );
    assert.equal(
      store.getState().getWorkspaceProject().scenarios[2].groups,
      undefined,
    );
    store.getState().undoBusiness();
    assert.equal(
      store.getState().getWorkspaceProject().scenarios[1].groups,
      undefined,
    );
    store.getState().redoBusiness();
    assert.equal(
      store.getState().getWorkspaceProject().scenarios[1].groups.length,
      1,
    );
    assert.deepEqual(store.getState().linkedEditSession.linkedIds, [a]);
  } finally {
    api.close();
  }
});

test("templates retain draft-only logos, allocations and category measurements under fresh IDs", () => {
  const s = fixture();
  const d = draft(s);
  d.tools = [
    ...s.tools,
    { id: "custom", name: "Interne", logo: "data:image/png;base64,test" },
  ];
  d.actors = s.actors;
  d.nodes[0].data.toolsUsed = ["custom"];
  d.nodes[0].data.actorAllocations = { person: 0.5 };
  d.nodes[0].data.measurements = { "cycleTimes:a": { status: "estimated" } };
  const saved = applyGroupCommand(s, {
    type: "saveDraft",
    nodeId: "p0",
    draft: d,
  });
  const t = createTemplate(saved, ["p0", "p1"], "T");
  const target = fixture();
  target.nodes[0].data.volumeItems[0].id = "b";
  const next = insertTemplate(target, t, { a: "b" }).scenario;
  const inserted = next.decompositionDrafts[0],
    tool = next.tools.find((r) => r.originId === "custom"),
    actor = next.actors.find((r) => r.originId === "person");
  assert.equal(inserted.nodes[0].data.toolsUsed[0], tool.id);
  assert.equal(inserted.tools.find((r) => r.id === tool.id).logo, tool.logo);
  assert.equal(inserted.nodes[0].data.actorAllocations[actor.id], 0.5);
  assert.equal(
    inserted.nodes[0].data.measurements["cycleTimes:b"].status,
    "estimated",
  );
  validateGroups(next);
});

test("attachment vault stores portable bytes and reads legacy blobs without loss", async () => {
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = new IDBFactory();
  try {
    const { saveFile, getFile, initDB } = await import("../src/utils/db.js");
    await saveFile({
      id: "doc",
      name: "Pièce.txt",
      content: new Blob(["Référence conservée"], { type: "text/plain" }),
    });
    const file = await getFile("doc");
    assert.equal(await file.content.text(), "Référence conservée");
    assert.equal(file.content.type, "text/plain");
    const db = await initDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put({
        id: "legacy",
        content: new Blob(["Ancien"]),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    assert.equal(await (await getFile("legacy")).content.text(), "Ancien");
  } finally {
    globalThis.indexedDB = previous;
  }
});
