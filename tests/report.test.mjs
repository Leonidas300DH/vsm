import test from "node:test";
import assert from "node:assert/strict";
import { createReport } from "../src/services/report.js";
import { createExample } from "../src/data/example.js";
import { migrateProject } from "../src/services/project.js";

test("PDF formulas use readable text supported by the embedded standard font", () => {
  const project = migrateProject(createExample());
  const pdf = createReport(project);
  const content = pdf.output();
  assert.ok(pdf.getNumberOfPages() > 1);
  assert.ok(content.includes("Somme des attentes du parcours pour cette"));
  assert.ok(!content.includes("Σ"), "Greek sigma is not supported by Helvetica's PDF encoding");
  assert.ok(!content.includes("(workload)"), "Comparison uses user-facing indicator labels");
});
