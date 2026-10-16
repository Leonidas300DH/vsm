import { fileURLToPath } from "node:url";
const { chromium, webkit } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import fs from "node:fs";
import assert from "node:assert/strict";
const kind = process.env.QA_BROWSER || "chrome",
  url = process.env.QA_URL || "http://127.0.0.1:4174/";
const browser = await (kind === "chrome" ? chromium : webkit).launch({
  headless: true,
  ...(kind === "chrome" ? { channel: "chrome" } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("dialog", (d) => {
  console.log("DIALOG", d.message());
  return d.accept();
});
const check = (s) => {
  checks.push(s);
  console.log("PASS", s);
};
const n = (id) => page.locator(`.react-flow__node[data-id="${id}"]`).first();
const persist = () =>
  page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Enregistré"]') ||
      document.body.innerText.includes("Enregistré"),
  );
try {
  await page.goto(url);
  await page.getByRole("button", { name: "Projet", exact: true }).waitFor();
  await page
    .locator('.studio-backdrop[role="status"]')
    .waitFor({ state: "hidden" });
  await page
    .locator('input[type=file][accept=".json,.vsm"]')
    .setInputFiles(
      fileURLToPath(new URL("../fixtures/groups.vsm", import.meta.url)),
    );
  await n("p0").waitFor();
  await n("p0").click();
  await n("p1").click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "Regrouper", exact: true }).click();
  await page.getByLabel("Nom du sous-processus").fill("Vérification KYC");
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  await page.getByLabel("Replier Vérification KYC", { exact: true }).waitFor();
  check("Connected selection creates a visible frame");
  await page.getByLabel("Replier Vérification KYC", { exact: true }).click();
  await page.locator(".subprocess-node.is-collapsed").waitFor();
  assert.equal(await n("p0").count(), 0);
  assert.match(await page.locator(".subprocess-summary").innerText(), /30/);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/tmp/vsm-groups-${kind}-collapsed.png` });
  check("Collapsed summary preserves charge and hides only its descendants");
  await page.getByLabel("Déplier Vérification KYC", { exact: true }).click();
  await n("p0").waitFor();
  await page.getByLabel("Inspecter Vérification KYC", { exact: true }).click();
  await page.getByLabel("Nom du groupe").fill("Contrôles KYC");
  await page.getByLabel("Nom du groupe").blur();
  await page.getByLabel("Replier Contrôles KYC", { exact: true }).waitFor();
  check("Rename group");
  await page.getByLabel("Fermer l’inspecteur du groupe").click();
  await page.getByLabel("Ouvrir le détail Contrôles KYC").click();
  await page
    .getByRole("button", { name: "Carte entière", exact: true })
    .waitFor();
  assert.equal(await n("out").count(), 0);
  await page
    .getByRole("button", { name: "Carte entière", exact: true })
    .click();
  await n("out").waitFor();
  check("Focus and breadcrumb return");
  await page.getByLabel("Inspecter Contrôles KYC", { exact: true }).click();
  await page
    .getByRole("button", { name: "Dissocier le groupe", exact: true })
    .click();
  await page.getByRole("button", { name: "Appliquer", exact: true }).click();
  assert.equal(await page.locator(".subprocess-node").count(), 0);
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await page.getByLabel("Replier Contrôles KYC", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Rétablir", exact: true }).click();
  assert.equal(await page.locator(".subprocess-node").count(), 0);
  check("Dissociate, undo and redo");
  await n("p0").click();
  await page
    .getByRole("button", { name: "Détailler en sous-étapes", exact: true })
    .click();
  const draft = page.getByRole("dialog", {
    name: "Décomposer une étape",
    exact: true,
  });
  await draft.getByRole("button", { name: "Ajouter une sous-étape" }).click();
  await draft.getByRole("button", { name: "Ajouter une sous-étape" }).click();
  await draft.locator(".react-flow__node").first().click();
  await draft
    .getByRole("button", { name: "Réutiliser les pièces jointes de référence" })
    .click();
  await draft.getByText("Procedure.txt", { exact: true }).first().waitFor();
  check("Reference document explicitly attached to a chosen substep");
  await draft.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await draft.getByText("Brouillon enregistré.", { exact: false }).waitFor();
  await draft.getByLabel("Fermer le détail").click();
  await page.reload();
  await n("p0").waitFor();
  await n("p0").click();
  await page
    .getByRole("button", { name: "Détailler en sous-étapes", exact: true })
    .click();
  assert.equal(await draft.locator(".react-flow__node").count(), 2);
  check("Draft survives reload without replacing original");
  await draft
    .getByRole("button", { name: "Vérifier les écarts", exact: true })
    .click();
  await draft
    .getByLabel("J’accepte que les indicateurs incomplets restent inconnus.")
    .check();
  await draft
    .getByRole("button", { name: "Activer ce détail", exact: true })
    .click();
  await page.getByLabel("Replier Étape 0", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await n("p0").waitFor();
  assert.equal(
    await page.getByLabel("Replier Étape 0", { exact: true }).count(),
    0,
  );
  await page.getByRole("button", { name: "Rétablir", exact: true }).click();
  await page.getByLabel("Replier Étape 0", { exact: true }).waitFor();
  check("Explicit incomplete activation and whole transaction undo redo");
  await page.screenshot({ path: `/tmp/vsm-groups-${kind}-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `/tmp/vsm-groups-${kind}-mobile.png` });
  assert.deepEqual(errors, []);
  check("No runtime errors");
  fs.writeFileSync(
    `/tmp/vsm-groups-${kind}-qa.json`,
    JSON.stringify({ url, checks, errors }, null, 2),
  );
} catch (e) {
  await page.screenshot({ path: `/tmp/vsm-groups-${kind}-failure.png` });
  console.error(e);
  console.error(errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
