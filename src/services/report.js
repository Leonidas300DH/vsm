import { jsPDF } from "jspdf";
import { analyze, displayNumber } from "./analysis.js";
import { activeScenario, compareScenarios } from "./project.js";
import { measurementRows } from "./simulation.js";
const text = (v) =>
  String(v ?? "Inconnu")
    .replace(/[→]/g, " > ")
    .replace(/[–—]/g, "-")
    .replace(/∞/g, "infini")
    .replace(/[\u202f\u00a0]/g, " ");
export function createReport(
  project,
  { logos = {}, overviewImage = null } = {},
) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" }),
    margin = 16,
    width = 178,
    bottom = 276;
  let y = 24;
  const page = () => {
    pdf.addPage();
    y = 24;
  };
  const room = (h) => {
    if (y + h > bottom) page();
  };
  const paragraph = (value, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text(value), width);
    for (const line of lines) {
      room(size * 0.45 + 2);
      pdf.text(line, margin, y);
      y += size * 0.45 + 1;
    }
    y += 3;
  };
  const title = (value) => {
    room(18);
    paragraph(value, 15, true);
  };
  const table = (headers, rows, widths) => {
    const draw = (values, header = false) => {
      pdf.setFont("helvetica", header ? "bold" : "normal");
      pdf.setFontSize(9);
      const cells = values.map((v, i) =>
        pdf.splitTextToSize(text(v), widths[i] - 4),
      );
      const count = Math.max(...cells.map((c) => c.length));
      for (let start = 0; start < count;) {
        let lines = Math.min(count - start, Math.floor((bottom - y - 5) / 4));
        if (lines < 1) {
          page();
          if (!header) draw(headers, true);
          continue;
        }
        const height = lines * 4 + 5;
        let x = margin;
        cells.forEach((cell, i) => {
          pdf.setDrawColor(190);
          pdf.rect(x, y, widths[i], height);
          pdf.text(cell.slice(start, start + lines), x + 2, y + 4);
          x += widths[i];
        });
        y += height;
        start += lines;
        if (start < count) {
          page();
          if (!header) draw(headers, true);
        }
      }
    };
    room(18);
    draw(headers, true);
    for (const row of rows) {
      if (y + 14 > bottom) {
        page();
        draw(headers, true);
      }
      draw(row);
    }
    y += 8;
  };
  const current = activeScenario(project),
    result = analyze(current);
  title(project.title || "VSM Studio");
  paragraph(
    `Scénario : ${current.name} | Révision : ${current.revision} | Moteur analytique 1`,
    10,
  );
  paragraph(
    `Export du ${new Date().toLocaleDateString("fr-FR")}. ${result.complete ? "Données complètes." : "Analyse incomplète : valeurs inconnues conservées."}`,
  );
  if (overviewImage) {
    room(110);
    pdf.addImage(overviewImage, "PNG", margin, y, width, 95);
    y += 102;
  } else {
    paragraph("La carte est reproduite sur les pages suivantes à une échelle lisible. Les numéros renvoient aux fiches détaillées et les connexions inter-pages sont listées sous chaque vue.");
  }

  table(
    ["Indicateur", "Minutes"],
    [
      ["Charge / période", displayNumber(result.workload)],
      ["Processing / dossier", displayNumber(result.processing)],
      ["Attente / dossier", displayNumber(result.waiting)],
      ["Lead time / dossier", displayNumber(result.lead)],
    ],
    [120, 58],
  );
  const reference = project.scenarios.find(
    (s) => s.id === project.actualScenarioId,
  );
  if (reference) {
    title("Comparaison avec la référence actuel");
    const base = analyze(reference);
    table(
      ["Indicateur", "Actuel", "Scénario", "Écart"],
      ["workload", "processing", "waiting", "lead"].map((k) => [
        k,
        displayNumber(base[k]),
        displayNumber(result[k]),
        displayNumber(
          base[k] === null || result[k] === null ? null : result[k] - base[k],
        ),
      ]),
      [70, 36, 36, 36],
    );
    const changes = compareScenarios(reference, current);
    paragraph(`${changes.length} changements métier.`);
    for (const c of changes) paragraph(`${c.kind} : ${c.label} - ${c.type}`, 9);
  }
  if (!overviewImage && current.nodes.length) {
    // Fixed readable scale; tile the map instead of shrinking long value streams.
    const scale = 0.07, tileWidth = 148, tileHeight = 120;
    const minX = Math.min(...current.nodes.map(n => n.position.x));
    const minY = Math.min(...current.nodes.map(n => n.position.y));
    const tiles = new Map(), locations = new Map();
    current.nodes.forEach((n,index) => {
      const px=(n.position.x-minX)*scale, py=(n.position.y-minY)*scale;
      const col=Math.floor(px/tileWidth), row=Math.floor(py/tileHeight), key=`${col}:${row}`;
      const point={node:n,index:index+1,key,col,row,x:px-col*tileWidth,y:py-row*tileHeight};
      locations.set(n.id,point);
      if(!tiles.has(key))tiles.set(key,[]);
      tiles.get(key).push(point);
    });
    const ordered=[...tiles.values()].sort((a,b)=>a[0].col-b[0].col||a[0].row-b[0].row);
    ordered.forEach((points,tileIndex)=>{
      page(); title(`Carte d’ensemble ${tileIndex+1}/${ordered.length}`);
      paragraph(`Colonne ${points[0].col+1} · Bande ${points[0].row+1}. Lecture de gauche à droite.`,9);
      const top=y+4, key=points[0].key;
      pdf.setDrawColor(105,135,150);
      for(const e of current.edges){
        const from=locations.get(e.source),to=locations.get(e.target);
        if(from?.key===key&&to?.key===key)pdf.line(margin+from.x+24,top+from.y+5,margin+to.x,top+to.y+5);
      }
      for(const point of points){
        const colors={it:[205,239,218],ai:[210,230,252],actor:[255,224,185]};
        pdf.setFillColor(...(colors[point.node.data.subtype]||[230,235,239]));
        pdf.rect(margin+point.x,top+point.y,24,10,"FD");
        pdf.setFont("helvetica","bold");pdf.setFontSize(10);
        pdf.text(String(point.index),margin+point.x+10,top+point.y+6.5);
      }
      y=top+Math.max(...points.map(p=>p.y))+20;
      table(["Étape","Libellé","Étapes suivantes"],points.map(p=>[
        String(p.index),p.node.data.label||p.node.data.type||p.node.id,
        current.edges.filter(e=>e.source===p.node.id).map(e=>{
          const to=locations.get(e.target); return to?`${to.index}${to.key!==key?" (autre vue)":""}`:"Référence absente";
        }).join(", ")||"Fin",
      ]),[20,110,48]);
    });
  }
  current.nodes.forEach((n, index) => {
    page();
    title(`${index + 1}. ${n.data.label || n.id}`);
    paragraph(`${n.id} | ${n.data.subtype || n.data.type || "Étape"}`);
    if (n.data.description) paragraph(n.data.description);
    const calc = result.nodes.find((r) => r.id === n.id);
    if (calc)
      table(
        ["Catégorie", "Volume", "C/T min", "Charge min"],
        calc.categories.map((c) => [
          c.name,
          displayNumber(c.volume),
          displayNumber(c.unit),
          displayNumber(c.workload),
        ]),
        [70, 36, 36, 36],
      );
    if (calc)
      paragraph(
        `Capacité : ${displayNumber(calc.capacity)} min/période. Utilisation : ${displayNumber(calc.utilization)} %.`,
      );
    for (const [kind, field, label] of [
      ["tools", "toolsUsed", "Outils"],
      ["actors", "actorsUsed", "Acteurs"],
      ["knowledge", "knowledgeUsed", "Connaissances"],
    ]) {
      const resources = (current[kind] || []).filter((r) =>
        n.data[field]?.includes(r.id),
      );
      if (!resources.length) continue;
      title(label);
      for (const r of resources) {
        room(22);
        if (logos[r.id]) {
          pdf.addImage(logos[r.id], "PNG", margin, y, 10, 10);
          pdf.setFontSize(10);
          pdf.text(text(r.name), margin + 14, y + 6);
          y += 15;
        } else paragraph(r.name, 10, true);
        if (r.description) paragraph(r.description, 9);
      }
    }
    const measures = measurementRows(current).filter(
      (r) => r.kind === "nodes" && r.id === n.id,
    );
    if (measures.length) {
      title("Hypothèses et sources");
      table(
        ["Mesure", "Valeur / statut", "Source / responsable / date"],
        measures.map((r) => {
          const m = n.data.measurements?.[r.key] || {};
          return [
            r.label,
            `${r.value ?? "Inconnu"} ${m.unit || r.unit} | ${m.status || (r.value == null ? "unknown" : "estimated")}`,
            `${m.scope || "Périmètre non documenté"}\n${m.source || "Source non documentée"}\n${m.owner || ""} ${m.date || ""}`,
          ];
        }),
        [62, 46, 70],
      );
    }
    const outgoing = current.edges.filter((e) => e.source === n.id);
    if (outgoing.length) {
      title("Connexions sortantes");
      for (const e of outgoing) {
        paragraph(
          `${e.id} > ${current.nodes.find((x) => x.id === e.target)?.data.label || e.target}`,
          10,
          true,
        );
        table(
          ["Catégorie / champ", "Valeur"],
          measurementRows(current)
            .filter((r) => r.kind === "edges" && r.id === e.id)
            .map((r) => [r.label, `${r.value ?? "Inconnu"} ${r.unit}`]),
          [130, 48],
        );
      }
    }
    if (n.data.attachments?.length)
      paragraph(
        `Documents référencés : ${n.data.attachments.map((a) => a.name || a.id).join(", ")}`,
        9,
      );
  });
  page();
  title("Commentaires sélectionnés");
  const ids = new Set([...current.nodes, ...current.edges].map((x) => x.id));
  for (const c of current.comments || []) {
    if (c.includeInReport === false) continue;
    paragraph(
      `${c.status === "resolved" ? "Résolu" : "Ouvert"} | ${c.target.id} ${!ids.has(c.target.id) ? "(référence supprimée)" : ""}${c.target.measureKey ? " | " + c.target.measureKey : ""}`,
      10,
      true,
    );
    paragraph(c.text);
    paragraph(`${c.author || "Auteur non renseigné"} | ${c.createdAt}`, 9);
  }
  title("Diagnostics");
  for (const i of result.issues)
    paragraph(`${i.id} : ${i.message}${i.formula ? " - " + i.formula : ""}`, 9);
  for (let i = 1; i <= pdf.getNumberOfPages(); i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text("VSM STUDIO | " + text(current.name), margin, 12);
    pdf.text(`${i} / ${pdf.getNumberOfPages()}`, 194, 289, { align: "right" });
    pdf.setTextColor(0);
  }
  return pdf;
}
export async function exportReport(project) {
  const { resolveToolBrand } = await import("../utils/toolBrands.js");
  const logos = {};
  for (const tool of activeScenario(project).tools || []) {
    const brand = resolveToolBrand(tool.icon, tool.name),
      src = tool.logo || (brand && `/tool-logos/${brand.file}`);
    if (!src) continue;
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error(`Logo indisponible : ${tool.name}`));
      image.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    const ratio = Math.min(128 / img.width, 128 / img.height);
    ctx.drawImage(
      img,
      (128 - img.width * ratio) / 2,
      (128 - img.height * ratio) / 2,
      img.width * ratio,
      img.height * ratio,
    );
    logos[tool.id] = canvas.toDataURL("image/png");
  }
  return {
    url: URL.createObjectURL(createReport(project, { logos }).output("blob")),
    name: `${project.title}.pdf`,
  };
}
