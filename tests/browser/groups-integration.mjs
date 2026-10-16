const { chromium, webkit } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import fs from "node:fs";
const url = process.env.QA_URL || "http://127.0.0.1:4174/",
  kind = process.env.QA_BROWSER || "chrome";
const browser = await (kind === "chrome" ? chromium : webkit).launch({
  headless: true,
  ...(kind === "chrome" ? { channel: "chrome" } : {}),
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1100 },
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [],
  warnings = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) warnings.push(m.text());
});
page.on("dialog", (d) => d.accept());
const check = (s) => {
  checks.push(s);
  console.log("PASS", s);
};
try {
  await page.goto(url);
  await page.getByRole("button", { name: "Projet", exact: true }).click();
  await page
    .getByRole("button", { name: "Charger l’exemple KYC", exact: true })
    .click();
  await page
    .getByLabel("Ouvrir le détail Constituer le dossier KYC", { exact: true })
    .waitFor();
  await page
    .getByLabel("Ouvrir le détail Collecte documentaire", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collecte documentaire", exact: true })
    .waitFor();
  await page.waitForTimeout(350);
  await page.screenshot({ path: `/tmp/vsm-groups-${kind}-kyc-detail.png` });
  check("KYC nested frame and breadcrumb focus");
  await page
    .getByRole("button", { name: "Carte entière", exact: true })
    .click();
  await page.waitForTimeout(400);
  await page
    .getByLabel("Replier Constituer le dossier KYC", { exact: true })
    .click();
  await page
    .getByLabel("Déplier Constituer le dossier KYC", { exact: true })
    .waitFor();
  assert.equal(
    await page.locator('.react-flow__node[data-id="intake"]').count(),
    0,
  );
  await page
    .getByLabel("Déplier Constituer le dossier KYC", { exact: true })
    .click();
  await page.locator('.react-flow__node[data-id="intake"]').waitFor();
  check("Nested collapse and restore on KYC");
  // Actual PDF download and structurally portable project.
  await page.getByRole("button", { name: "Projet", exact: true }).click();
  await page
    .getByRole("button", { name: "Exporter le rapport PDF", exact: true })
    .click();
  const dl = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Télécharger PDF", exact: true })
    .click();
  const download = await dl;
  const pdf = await download.path();
  assert.ok(fs.statSync(pdf).size > 5000);
  fs.copyFileSync(pdf, `/tmp/vsm-groups-${kind}-report.pdf`);
  await page.getByRole("button", { name: "Projet", exact: true }).click();
  check("PDF downloaded with hierarchy sections");
  await page.getByRole("button", { name: "Projet", exact: true }).click();
  await page
    .getByRole("button", { name: "Projets & historique", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Exporter.*versions/i })
    .waitFor()
    .catch(() => {});
  const vsmDownload = page.waitForEvent("download");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Exporter.*versions/i })
    .click();
  const vsm = await vsmDownload;
  assert.ok(fs.statSync(await vsm.path()).size > 1000);
  const exported = JSON.parse(
    await page.getByLabel("Contenu VSM exporté").inputValue(),
  );
  assert.equal(exported.scenarios[0].groups.length, 3);
  assert.equal(exported.meta.version, "3.1");
  fs.writeFileSync(
    `/tmp/vsm-groups-${kind}-export.vsm`,
    JSON.stringify(exported),
  );
  await page.keyboard.press("Escape");
  check("Portable VSM 3.1 contains nested groups");
  await page.getByRole("tab", { name: "Baseline" }).dblclick();
  await page.getByRole("dialog").getByRole("textbox").fill("Current State");
  await page.getByRole("button", { name: "Renommer", exact: true }).click();
  for (const name of ["Future State", "Today"]) {
    await page
      .getByRole("button", { name: "Créer un onglet", exact: true })
      .click();
    await page.getByRole("dialog").getByRole("textbox").fill(name);
    await page
      .getByRole("button", { name: "Créer la copie", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Édition liée", exact: true }).click();
  await page.getByRole("button", { name: "1 enfant(s)", exact: true }).click();
  await page.getByLabel("Today", { exact: true }).check();
  await page.getByRole("button", { name: "2 enfant(s)", exact: true }).click();
  await page
    .getByRole("button", { name: "Édition liée en pause", exact: true })
    .click();
  const pane = (name) =>
    page.getByRole("region", { name: `Carte ${name}`, exact: true });
  await pane("Current State")
    .getByLabel("Inspecter Collecte documentaire", { exact: true })
    .click();
  await pane("Current State").getByLabel("Nom du groupe").fill("Collecte liée");
  await pane("Current State").getByLabel("Nom du groupe").blur();
  await page
    .getByRole("button", { name: "Appliquer aux scénarios listés" })
    .click();
  for (const name of ["Current State", "Future State", "Today"])
    await pane(name)
      .getByLabel("Replier Collecte liée", { exact: true })
      .waitFor();
  check("Group rename preview propagates to selected linked children");
  await pane("Future State")
    .locator(".subprocess-node header")
    .filter({ hasText: "Collecte liée" })
    .click();
  await pane("Future State")
    .getByLabel("Nom du groupe")
    .fill("Collecte indépendante");
  await pane("Future State").getByLabel("Nom du groupe").blur();
  await page
    .getByRole("button", { name: "Appliquer aux scénarios listés" })
    .click();
  await pane("Future State")
    .getByLabel("Replier Collecte indépendante", { exact: true })
    .waitFor();
  await pane("Current State")
    .getByLabel("Replier Collecte liée", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Annuler l’opération", exact: true })
    .click();
  await pane("Future State")
    .getByLabel("Replier Collecte liée", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Rétablir l’opération", exact: true })
    .click();
  await pane("Future State")
    .getByLabel("Replier Collecte indépendante", { exact: true })
    .waitFor();
  check("Child group edit detaches; undo redo remain independent");
  await page.screenshot({ path: `/tmp/vsm-groups-${kind}-linked.png` });
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  fs.writeFileSync(
    `/tmp/vsm-groups-${kind}-integration.json`,
    JSON.stringify({ url, checks, errors, warnings }, null, 2),
  );
} catch (e) {
  await page.screenshot({
    path: `/tmp/vsm-groups-${kind}-integration-failure.png`,
  });
  console.error(e);
  console.error(errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
