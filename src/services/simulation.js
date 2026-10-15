import { clone } from "./project.js";
export function applySimulation(source, changes) {
  const result = clone(source);
  const categories = [...new Set(source.nodes.flatMap(n => n.data.volumeItems || []).map(c => c.id))];
  for (const change of changes) {
    const { kind, id, field, category, value } = change;
    const target = result[kind]?.find((x) => x.id === id);
    if (!target) throw new Error(`Objet absent : ${id}`);
    if (
      value !== null &&
      (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    )
      throw new Error("Valeur positive ou inconnue attendue.");
    if (["volume","cycle","routing","wait"].includes(field) && !categories.includes(category))
      throw new Error("Catégorie absente");
    const n = value === null ? null : Number(value),
      d = target.data;
    if (kind === "nodes" && field === "volume") {
      const item = d.volumeItems?.find((i) => i.id === category);
      if (!item) throw new Error("Catégorie absente");
      item.value = n;
    } else if (kind === "nodes" && field === "cycle")
      d.cycleTimes = { ...d.cycleTimes, [category]: n };
    else if (
      kind === "nodes" &&
      ["wait_time", "staffing", "availableTime", "technicalCapacity"].includes(
        field,
      )
    )
      d[field] = n;
    else if (kind === "edges" && field === "wait") {
      d.itemData = {
        ...d.itemData,
        [category]: { ...d.itemData?.[category], wait: n },
      };
    } else if (kind === "edges" && field === "routing") {
      const previous = d.routingType === "item" ? d.itemRouting : Object.fromEntries(categories.map(c => [c,d.percentage]));
      d.routingType = "item";
      d.itemRouting = { ...previous, [category]: n };
    } else throw new Error("Modification non autorisée");
    const key = ["volume","cycle","routing","wait"].includes(field) ? `${field}:${category}` : ({wait_time:"wait",availableTime:"available",technicalCapacity:"capacity",staffing:"staffing"})[field];
    d.measurements = {...d.measurements,[key]:{...d.measurements?.[key],status:n===null?"unknown":"estimated"}};
  }
  return result;
}
export function measurementRows(scenario) {
  const categories = [
    ...new Map(
      scenario.nodes
        .flatMap((n) => n.data.volumeItems || [])
        .map((i) => [i.id, i]),
    ).values(),
  ];
  return scenario.nodes
    .flatMap((n) =>
      n.type === "startEnd"
        ? (n.data.volumeItems || []).map((c) => ({
            kind: "nodes",
            id: n.id,
            field: "volume",
            category: c.id,
            key: `volume:${c.id}`,
            label: `${n.data.label || n.id} · Volume ${c.name}`,
            value: c.value,
            unit: "dossiers",
          }))
        : [
            ...categories.map((c) => ({
              kind: "nodes",
              id: n.id,
              field: "cycle",
              category: c.id,
              key: `cycle:${c.id}`,
              label: `${n.data.label} · C/T ${c.name}`,
              value: n.data.cycleTimes?.[c.id],
              unit: "min",
            })),
            ...[
              "wait_time",
              "availableTime",
              ...(["it", "ai"].includes(n.data.subtype)
                ? ["technicalCapacity"]
                : ["staffing"]),
            ].map((field) => ({
              kind: "nodes",
              id: n.id,
              field,
              key: {
                wait_time: "wait",
                availableTime: "available",
                technicalCapacity: "capacity",
                staffing: "staffing",
              }[field],
              label: `${n.data.label} · ${{ wait_time: "Attente", availableTime: "Temps disponible", technicalCapacity: "Capacité technique (minutes de traitement / période)", staffing: "Effectif" }[field]}`,
              value: n.data[field],
              unit: field === "staffing" ? "personnes" : "min",
            })),
          ],
    )
    .concat(
      scenario.edges.flatMap((e) =>
        categories.flatMap((c) => [
          {
            kind: "edges",
            id: e.id,
            field: "routing",
            category: c.id,
            key: `routing:${c.id}`,
            label: `${e.source} → ${e.target} · Routage ${c.name}`,
            value:
              e.data.routingType === "item"
                ? e.data.itemRouting?.[c.id]
                : e.data.percentage,
            unit: "%",
          },
          {
            kind: "edges",
            id: e.id,
            field: "wait",
            category: c.id,
            key: `wait:${c.id}`,
            label: `${e.source} → ${e.target} · Attente ${c.name}`,
            value: Object.hasOwn(e.data.itemData?.[c.id] || {}, "wait")
                ? e.data.itemData[c.id].wait : e.data.wait_time,
            unit: "min",
          },
        ]),
      ),
    );
}
