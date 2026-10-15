import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  proposeLayout,
  graphBoxes,
  collisions,
} from "../src/services/placement.js";
import { analyze } from "../src/services/analysis.js";
for (const file of [
  "kyc",
  "simple",
  "branches",
  "multiple",
  "legacy",
  "custom-logo",
])
  test(`measured placement: ${file}, labels and satellites do not overlap`, () => {
    const s = JSON.parse(
      fs.readFileSync(new URL(`./fixtures/${file}.vsm`, import.meta.url)),
    );
    s.nodes = s.nodes.map((n) => ({
      ...n,
      width: n.type === "process" ? 300 : 240,
      height: n.type === "process" ? 470 : 140,
    }));
    const original = structuredClone(s);
    const r = proposeLayout(s.nodes, s.edges);
    assert.equal(r.error, undefined);
    assert.equal(collisions(graphBoxes(r.nodes, s.edges)).length, 0);
    assert.deepEqual(s, original);
  });
test("incompatible locks preserve all source positions", () => {
  const s = JSON.parse(
    fs.readFileSync(new URL("./fixtures/simple.vsm", import.meta.url)),
  );
  s.nodes.forEach((n) => {
    n.data.positionLocked = true;
    n.position = { x: 0, y: 0 };
  });
  assert.ok(proposeLayout(s.nodes, s.edges).error);
  assert.ok(s.nodes.every((n) => n.position.x === 0));
});
test("200 steps / 500 edges performance reference (deterministic DAG)", (t) => {
  const nodes = Array.from({ length: 200 }, (_, i) => ({
    id: String(i),
    type: i === 0 || i === 199 ? "startEnd" : "process",
    width: 300,
    height: 440,
    position: { x: 0, y: 0 },
    data: {
      type: i === 0 ? "start" : "end",
      volumeItems: i === 0 ? [{ id: "a", name: "A", value: 100 }] : undefined,
      cycleTimes: { a: 1 },
      wait_time: 0,
    },
  }));
  const edges = [];
  for (let i = 0; i < 199; i++)
    edges.push({
      id: `e${edges.length}`,
      source: String(i),
      target: String(i + 1),
      data: { percentage: 100, wait_time: 0 },
    });
  for (let jump = 2; edges.length < 500; jump++)
    for (let i = 0; i + jump < 200 && edges.length < 500; i++)
      edges.push({
        id: `e${edges.length}`,
        source: String(i),
        target: String(i + jump),
        data: { percentage: 0, wait_time: 0 },
      });
  const r = analyze({ nodes, edges });
  const start = performance.now();
  const layout = proposeLayout(nodes, edges);
  t.diagnostic(
    JSON.stringify({
      analysis: r.elapsedMs,
      layout: performance.now() - start,
      layoutAccepted: !layout.error,
    }),
  );
  assert.equal(layout.error, undefined);
  assert.equal(collisions(graphBoxes(layout.nodes, edges)).length, 0);
  assert.ok(r.elapsedMs < 200);
  assert.ok(performance.now() - start < 2000);
});
