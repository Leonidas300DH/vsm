import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { migrateProject, activeScenario } from "../src/services/project.js";
import { createTemplate, insertTemplate } from "../src/services/templates.js";
import {
  analysisPackage,
  validateProposal,
  acceptProposal,
} from "../src/services/proposals.js";
import { applySimulation } from "../src/services/simulation.js";
import { analyze } from "../src/services/analysis.js";
const raw = JSON.parse(
  fs.readFileSync(new URL("./fixtures/simple.vsm", import.meta.url)),
);
const source = () => activeScenario(migrateProject(raw));
test("subprocess copies remap all internal references and resource identities", () => {
  const s = source();
  s.tools = [{ id: "x", name: "X" }];
  s.nodes[1].data.toolsUsed = ["x"];
  const t = createTemplate(s, ["in", "p"], "Test");
  const r = insertTemplate(s, t, { a: "a" });
  assert.equal(new Set(r.scenario.nodes.map((n) => n.id)).size, 5);
  assert.equal(r.scenario.edges.length, 3);
  assert.equal(r.boundary.length, 1);
  assert.notEqual(r.scenario.tools[1].id, "x");
  t.nodes[1].data.cycleTimes.a = 999;
  assert.equal(r.scenario.nodes.at(-1).data.cycleTimes.a, 4);
  assert.throws(() => insertTemplate(s, t, {}));
});
test("Codex package excludes attachments and logos; validates version and creates independent target", () => {
  const project = migrateProject(raw),
    s = activeScenario(project);
  s.nodes[1].data.attachments = [{ id: "secret" }];
  s.tools = [{ id: "x", name: "X", logo: "private" }];
  const pack = analysisPackage(s);
  assert.ok(!JSON.stringify(pack).includes("secret"));
  assert.ok(!JSON.stringify(pack).includes("private"));
  const proposal = pack.proposalTemplate;
  proposal.proposals[0].objectIds = ["p"];
  proposal.proposals[0].changes = [
    { kind: "nodes", id: "p", field: "cycle", category: "a", value: 2 },
  ];
  assert.ok(validateProposal(proposal, s).ok);
  const next = acceptProposal(project, proposal);
  assert.equal(next.scenarios[0].nodes[1].data.cycleTimes.a, 4);
  assert.equal(activeScenario(next).nodes[1].data.cycleTimes.a, 2);
  assert.equal(analyze(activeScenario(next)).workload, 20);
  proposal.source.revision++;
  assert.equal(validateProposal(proposal, s).ok, false);
});
test("proposals cannot execute code or patch arbitrary data", () => {
  const s = source(),
    p = analysisPackage(s).proposalTemplate;
  p.proposals[0].objectIds = ["p"];
  p.proposals[0].changes = [
    { kind: "nodes", id: "p", field: "__proto__", value: 1 },
  ];
  assert.equal(validateProposal(p, s).ok, false);
  assert.equal(validateProposal({ ...p, proposals: "bad" }, s).ok, false);
});

test("template category mapping preserves edge measurement provenance and parameters", () => {
  const s = source();
  s.edges[0].data.itemRouting = {a:100};
  s.edges[0].data.measurements = {"wait:a": {unit:"h",status:"measured",source:"Journal"}};
  const t = createTemplate(s,["in","p"],"Remapped");
  const target = source(); target.nodes[0].data.volumeItems[0].id="b";
  const inserted = insertTemplate(target,t,{a:"b"});
  const edge=inserted.scenario.edges.at(-1);
  assert.equal(edge.data.measurements["wait:b"].source,"Journal");
  assert.equal(edge.data.measurements["wait:a"],undefined);
  assert.equal(edge.data.itemRouting.b,100);
});

test("simulation retains untouched category routing and makes explicit new assumptions", () => {
 const s=source();s.nodes[0].data.volumeItems.push({id:"b",name:"B",value:5});
 s.nodes[1].data.measurements={"cycle:a":{status:"unknown",source:"Original"}};
 const next=applySimulation(s,[{kind:"edges",id:"e1",field:"routing",category:"a",value:50},{kind:"nodes",id:"p",field:"cycle",category:"a",value:2}]);
 assert.equal(next.edges[0].data.itemRouting.b,100);
 assert.equal(next.nodes[1].data.measurements["cycle:a"].status,"estimated");
 assert.equal(s.nodes[1].data.measurements["cycle:a"].status,"unknown");
 assert.throws(()=>applySimulation(s,[{kind:"nodes",id:"p",field:"cycle",category:"missing",value:2}]));
});
