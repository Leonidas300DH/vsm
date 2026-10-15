import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vsm-release-"));
for (const file of [
  "src",
  "public",
  ".vercel",
  "package.json",
  "package-lock.json",
  "index.html",
  "vite.config.js",
  "eslint.config.js",
])
  fs.cpSync(file, path.join(dir, file), { recursive: true });
console.log(dir);
