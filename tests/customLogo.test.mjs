import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateLogoFile,
  logoDimensions,
  isCustomLogo,
  MAX_LOGO_FILE_BYTES,
  MAX_LOGO_DATA_LENGTH,
} from "../src/utils/customLogo.js";
import { validateProject } from "../src/utils/projectSchema.js";
import { mergeResources } from "../src/utils/resources.js";
const logo = `data:image/png;base64,${readFileSync(new URL("../public/tool-logos/google-docs.png", import.meta.url)).toString("base64")}`;

test("logo upload accepts supported images and rejects empty, oversized or unrelated files", () => {
  for (const type of ["image/png", "image/jpeg", "image/webp", "image/svg+xml"])
    assert.doesNotThrow(() => validateLogoFile({ type, size: 100 }));
  assert.throws(
    () => validateLogoFile({ type: "text/html", size: 100 }),
    /PNG/,
  );
  assert.throws(() => validateLogoFile({ type: "image/png", size: 0 }), /vide/);
  assert.throws(
    () =>
      validateLogoFile({ type: "image/png", size: MAX_LOGO_FILE_BYTES + 1 }),
    /2 Mo/,
  );
});
test("logo resizing preserves aspect ratio, does not upscale and bounds decoded size", () => {
  assert.deepEqual(logoDimensions(1024, 512), { width: 256, height: 128 });
  assert.deepEqual(logoDimensions(48, 96), { width: 48, height: 96 });
  assert.throws(() => logoDimensions(0, 300));
  assert.throws(() => logoDimensions(8000, 8000));
});
test("custom logos only render embedded PNG data, never remote resources or raw SVG", () => {
  assert.ok(isCustomLogo(logo));
  for (const invalid of [
    null,
    {},
    "https://example.com/logo.png",
    "data:image/svg+xml,<svg/>",
    "data:image/png;base64,not-a-png",
    logo + "A".repeat(MAX_LOGO_DATA_LENGTH),
  ])
    assert.equal(isCustomLogo(invalid), false);
});
test("custom logos and extra metadata survive VSM validation, library merges, replacement and removal", () => {
  const tool = {
    id: "custom",
    name: "Outil maison",
    logo,
    icon: "wrench",
    customMetadata: { owner: "Notre équipe" },
  };
  const data = { nodes: [], edges: [], tools: [tool] };
  const parsed = validateProject(JSON.parse(JSON.stringify(data)));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.project.tools, [tool]);
  assert.deepEqual(
    mergeResources(
      [tool],
      [{ id: "custom", description: "Nouvelle description" }],
    )[0].logo,
    logo,
  );
  const removed = mergeResources([tool], [{ id: "custom", logo: null }])[0];
  assert.equal(removed.logo, null);
  assert.deepEqual(removed.customMetadata, tool.customMetadata);
});
