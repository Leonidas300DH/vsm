import test from "node:test";
import assert from "node:assert/strict";
import { analyze, measure } from "../src/services/analysis.js";
const n = (id, type, data = {}) => ({
  id,
  type: type ? "startEnd" : "process",
  position: { x: 0, y: 0 },
  data: { type, wait_time: 0, ...data },
});
const e = (id, source, target, pct = 100, wait = 0) => ({
  id,
  source,
  target,
  data: { percentage: pct, wait_time: wait },
});
const sample = () => ({
  actors: [],
  nodes: [
    n("s", "start", { volumeItems: [{ id: "a", name: "A", value: 10 }] }),
    n("p", null, { cycleTimes: { a: 4 }, staffing: 1, availableTime: 20 }),
    n("o", "end"),
  ],
  edges: [e("a", "s", "p", 100, 5), e("b", "p", "o")],
});
test("analytical units separate workload, per-case processing, wait and lead", () => {
  const r = analyze(sample());
  assert.equal(r.workload, 40);
  assert.equal(r.processing, 4);
  assert.equal(r.waiting, 5);
  assert.equal(r.lead, 9);
  assert.equal(r.nodes.find((n) => n.id === "p").utilization, 200);
  assert.equal(r.completedVolume, 10);
});
test("unknowns are not zero and explicit units convert", () => {
  const s = sample();
  s.nodes[1].data.cycleTimes.a = null;
  const r = analyze(s);
  assert.equal(r.workload, null);
  assert.equal(r.processing, null);
  assert.equal(
    measure({ measurements: { x: { unit: "h" } } }, "x", 2, { time: true }),
    120,
  );
  assert.equal(
    measure({ measurements: { x: { status: "unknown" } } }, "x", 2),
    null,
  );
});
test("splits and convergences weight alternate paths without parallel synchronization", () => {
  const s = sample();
  s.nodes.splice(
    2,
    0,
    n("q", null, { cycleTimes: { a: 10 }, staffing: 1, availableTime: 100 }),
  );
  s.edges = [
    e("a", "s", "p", 80),
    e("b", "s", "q", 20),
    e("c", "p", "o"),
    e("d", "q", "o"),
  ];
  const r = analyze(s);
  assert.equal(r.completedVolume, 10);
  assert.equal(r.processing, 5.2);
  assert.equal(r.longest.maxLead, 10);
  assert.equal(r.workload, 52);
});
test("invalid routing, cycles, capacity zero and shared actors are diagnosed", () => {
  const s = sample();
  s.edges[0].data.percentage = 110;
  assert.ok(analyze(s).issues.some((i) => i.kind === "routing"));
  s.edges.push(e("loop", "p", "s"));
  assert.equal(analyze(s).workload, null);
  const zero = sample();
  zero.nodes[1].data.availableTime = 0;
  assert.equal(analyze(zero).nodes[1].utilization, Infinity);
  const shared = sample();
  shared.actors = [{ id: "a", headcount: 1, availableTime: 480 }];
  shared.nodes[1].data.actorAllocations = { a: 1 };
  shared.nodes.push(n("q", null, { actorAllocations: { a: 0.5 } }));
  assert.ok(analyze(shared).issues.some((i) => i.kind === "allocation"));
});
test("unknown wait does not conceal known processing per case", () => {
  const s = sample();
  delete s.edges[0].data.wait_time;
  const r = analyze(s);
  assert.equal(r.processing, 4);
  assert.equal(r.waiting, null);
  assert.equal(r.lead, null);
  assert.equal(r.complete, false);
});

test("explicit unknown waits and staffing override legacy defaults", () => {
 const s=sample(); s.edges[0].data.itemData={a:{wait:null}};
 s.nodes[1].data.measurements={staffing:{status:"unknown"}};
 const r=analyze(s);assert.equal(r.waiting,null);assert.equal(r.nodes[1].capacity,null);
});
