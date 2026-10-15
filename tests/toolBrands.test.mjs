import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  toolPresets,
  filterToolPresets,
  matchesToolQuery,
} from "../src/utils/toolPresets.js";
import { resolveToolBrand, toolBrands } from "../src/utils/toolBrands.js";
test("existing named tools get logos without rewriting saved references", () => {
  assert.equal(resolveToolBrand("spreadsheet", " Excel ").id, "brand-excel");
  assert.equal(
    resolveToolBrand("mail", "MICROSOFT OUTLOOK").id,
    "brand-outlook",
  );
  assert.equal(
    resolveToolBrand("folder", "SharePoint Online").id,
    "brand-sharepoint",
  );
  assert.equal(
    resolveToolBrand("workflow", "Power Automate").id,
    "brand-power-automate",
  );
  assert.equal(
    resolveToolBrand("brand-excel", "Suivi des dossiers").id,
    "brand-excel",
  );
  assert.equal(resolveToolBrand("globe", "Internet"), undefined);
  assert.equal(
    resolveToolBrand("spreadsheet", "Excellente analyse"),
    undefined,
  );
});
test("all catalog logos are bundled safe images, including theme variants", () => {
  for (const brand of toolBrands) {
    for (const file of [brand.file, brand.darkFile].filter(Boolean)) {
      const data = readFileSync(
        new URL(`../public/tool-logos/${file}`, import.meta.url),
      );
      if (file.endsWith(".png"))
        assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      else {
        assert.match(data.toString(), /<svg[\s>]/);
        assert.doesNotMatch(
          data.toString(),
          /<script|<foreignObject|(?:href|src)=["']https?:/i,
        );
      }
    }
  }
});
test("brand identifiers and aliases are unique and survive customized tool names", () => {
  assert.equal(new Set(toolBrands.map((b) => b.id)).size, toolBrands.length);
  const aliases = toolBrands.flatMap((b) => b.aliases);
  assert.equal(new Set(aliases).size, aliases.length);
  for (const brand of toolBrands) {
    assert.equal(resolveToolBrand(brand.id, "Outil personnalisé"), brand);
    for (const alias of brand.aliases)
      assert.equal(resolveToolBrand("wrench", alias.toUpperCase()), brand);
  }
});
test("catalog search combines aliases, descriptions and family without changing saved data", () => {
  assert.ok(toolPresets.find((p) => p.name === "Teams"));
  assert.ok(toolPresets.find((p) => p.name === "Word"));
  assert.deepEqual(
    filterToolPresets("microsoft teams").map((p) => p.name),
    ["Teams"],
  );
  assert.deepEqual(
    filterToolPresets("chat gpt").map((p) => p.name),
    ["ChatGPT"],
  );
  assert.ok(
    filterToolPresets("signature electronique", "Adobe").some(
      (p) => p.name === "Adobe Acrobat Sign",
    ),
  );
  assert.equal(filterToolPresets("Gmail", "Adobe").length, 0);
  assert.equal(filterToolPresets("inexistant-xyz").length, 0);
  assert.ok(
    matchesToolQuery({ name: "ChatGPT", icon: "brand-chatgpt" }, "chat gpt"),
  );
  assert.ok(
    matchesToolQuery({ name: "Teams", icon: "wrench" }, "microsoft teams"),
  );
  assert.equal(
    new Set(toolPresets.map((p) => p.name)).size,
    toolPresets.length,
  );
  for (const preset of toolPresets.filter((p) => p.icon.startsWith("brand-")))
    assert.ok(resolveToolBrand(preset.icon));
});
