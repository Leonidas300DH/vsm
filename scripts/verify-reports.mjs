import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createReport } from "../src/services/report.js";
import { createExample } from "../src/data/example.js";
import { migrateProject } from "../src/services/project.js";
import { resolveToolBrand } from "../src/utils/toolBrands.js";
import { proposeLayout } from "../src/services/placement.js";
const require = createRequire(
  path.resolve(process.env.VSM_SHARP_MODULE_ROOT || ".", "package.json"),
);
const sharp = require("sharp");
fs.mkdirSync("output/pdf",{recursive:true});
const raw = createExample();
raw.nodes = proposeLayout(raw.nodes, raw.edges).nodes;
const project = migrateProject(raw),
  logos = {};
for (const tool of raw.tools) {
  const brand = resolveToolBrand(tool.icon, tool.name);
  if (brand)
    logos[tool.id] =
      "data:image/png;base64," +
      (
        await sharp("public/tool-logos/" + brand.file)
          .resize(128, 128, { fit: "contain", background: "#ffffff00" })
          .png()
          .toBuffer()
      ).toString("base64");
}
createReport(project, { logos }).save("output/pdf/kyc-recette.pdf");
const simple = migrateProject(
  JSON.parse(fs.readFileSync("tests/fixtures/custom-logo.vsm")),
);
simple.scenarios[0].comments = [
  {
    id: "long",
    target: { id: "p" },
    text: "Une hypothèse explicite et sourcée permet de relire le calcul. ".repeat(
      250,
    ),
    author: "Recette",
    status: "open",
    createdAt: "2026-10-15",
  },
];
createReport(simple).save("output/pdf/rapport-long-recette.pdf");
