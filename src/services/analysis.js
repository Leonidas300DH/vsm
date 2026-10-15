export const ANALYTIC_ENGINE = "analytic-1";
export const FORMULAS = {
  workload: "Σ(volume par catégorie × temps unitaire)",
  processing: "Σ temps unitaires des étapes traversées",
  waiting: "Σ attentes du parcours pour cette catégorie",
  lead: "Processing time + attentes du parcours",
  capacity: "Σ(effectif × minutes disponibles × affectation explicite)",
  utilization: "Charge / capacité sur la même période × 100",
};
const numeric = (v) =>
  v !== null &&
  v !== "" &&
  v !== undefined &&
  Number.isFinite(Number(v)) &&
  Number(v) >= 0
    ? Number(v)
    : null;
export function measure(data, key, value, { time = false } = {}) {
  const m = data.measurements?.[key];
  if (m?.status === "unknown") return null;
  const n = numeric(value);
  if (n === null) return null;
  if (!time) return n;
  const factor = { min: 1, h: 60, s: 1 / 60 }[m?.unit || "min"];
  return factor === undefined ? null : n * factor;
}
export function analyze(scenario) {
  const started = performance.now(),
    nodes = scenario.nodes,
    edges = scenario.edges;
  const map = new Map(nodes.map((n) => [n.id, n])),
    incoming = new Map(nodes.map((n) => [n.id, 0])),
    out = new Map(nodes.map((n) => [n.id, []]));
  const issues = [],
    add = (kind, id, message, formula) =>
      issues.push({ kind, id, message, formula });
  for (const e of edges) {
    if (!map.has(e.source) || !map.has(e.target)) {
      add("invalid-edge", e.id, "Connexion orpheline");
      continue;
    }
    out.get(e.source).push(e);
    incoming.set(e.target, incoming.get(e.target) + 1);
  }
  const queue = nodes.filter((n) => incoming.get(n.id) === 0).map((n) => n.id);
  for (let i = 0; i < queue.length; i++)
    for (const e of out.get(queue[i])) {
      incoming.set(e.target, incoming.get(e.target) - 1);
      if (!incoming.get(e.target)) queue.push(e.target);
    }
  const blocked = nodes.filter((n) => incoming.get(n.id) > 0).map((n) => n.id);
  blocked.forEach((id) =>
    add(
      "cycle",
      id,
      "Boucle ou dépendance à une boucle : calcul indisponible.",
    ),
  );
  const streams = new Map(nodes.map((n) => [n.id, new Map()])),
    results = [],
    terminals = [];
  const actorUsage = new Map();
  for (const node of nodes)
    for (const [actor, share] of Object.entries(
      node.data.actorAllocations || {},
    ))
      actorUsage.set(
        actor,
        (actorUsage.get(actor) || 0) + (numeric(share) || 0),
      );
  for (const [actor, share] of actorUsage)
    if (share > 1 + 1e-8)
      add(
        "allocation",
        actor,
        `Affectations partagées ${Math.round(share * 100)} % : disponibilité dépassée.`,
        FORMULAS.capacity,
      );
  for (const id of queue) {
    const node = map.get(id),
      d = node.data,
      stream = streams.get(id),
      isStart = node.type === "startEnd" && d.type === "start",
      isEnd = node.type === "startEnd" && d.type === "end";
    if (isStart)
      for (const item of d.volumeItems || []) {
        const v = measure(d, `volume:${item.id}`, item.value);
        stream.set(item.id, {
          volume: v,
          processing: 0,
          waiting: 0,
          maxLead: 0,
          path: [id],
          name: item.name,
        });
        if (v === null) add("unknown", id, `Volume inconnu : ${item.name}`);
      }
    let workload = 0,
      knownWorkload = 0,
      waitContribution = 0;
    const categoryResults = [];
    for (const [category, state] of stream) {
      const support =
        d.executionMode !== "step" && ["actor", "it"].includes(d.subtype);
      const unit =
        node.type === "process" && !support
          ? measure(d, `cycle:${category}`, d.cycleTimes?.[category], {
              time: true,
            })
          : 0;
      const wait =
        node.type === "process" && !support
          ? measure(d, "wait", d.wait_time, { time: true })
          : 0;
      const load =
        unit === null || state.volume === null ? null : unit * state.volume;
      if (load === null) {
        workload = null;
        add(
          "unknown",
          id,
          `Temps ou volume inconnu : ${state.name}`,
          FORMULAS.workload,
        );
      } else {
        knownWorkload += load;
        if (workload !== null) workload += load;
      }
      if (wait === null)
        add(
          "unknown-wait",
          id,
          `Attente non renseignée : ${state.name}`,
          FORMULAS.waiting,
        );
      if (wait !== null && state.volume !== null)
        waitContribution += wait * state.volume;
      state.processing =
        state.processing === null || unit === null
          ? null
          : state.processing + unit;
      state.waiting =
        state.waiting === null || wait === null ? null : state.waiting + wait;
      state.maxLead =
        state.maxLead === null || unit === null || wait === null
          ? null
          : state.maxLead + unit + wait;
      if (state.path.at(-1) !== id) state.path.push(id);
      categoryResults.push({
        category,
        ...state,
        unit,
        workload: load,
        lead:
          state.processing === null || state.waiting === null
            ? null
            : state.processing + state.waiting,
      });
    }
    let capacity = null;
    if (["it", "ai"].includes(d.subtype))
      capacity = measure(d, "capacity", d.technicalCapacity, { time: true });
    else if (d.actorAllocations && Object.keys(d.actorAllocations).length) {
      capacity = 0;
      for (const [actorId, share] of Object.entries(d.actorAllocations)) {
        const actor = scenario.actors?.find((a) => a.id === actorId);
        const available =
          actor &&
          measure(actor, "available", actor.availableTime, { time: true });
        const headcount = actor && measure(actor, "headcount", actor.headcount);
        if (
          available === null ||
          headcount === null ||
          !actor ||
          numeric(share) === null ||
          actorUsage.get(actorId) > 1
        ) {
          capacity = null;
          break;
        }
        capacity += available * headcount * Number(share);
      }
    } else if (measure(d, "staffing", d.staffing) !== null) {
      const available = measure(d, "available", d.availableTime, {
        time: true,
      });
      capacity = available === null ? null : available * measure(d, "staffing", d.staffing);
    }
    const utilization =
      capacity === null || workload === null
        ? null
        : capacity === 0
          ? workload > 0
            ? Infinity
            : 0
          : (workload / capacity) * 100;
    const result = {
      id,
      label: d.label || id,
      workload,
      knownWorkload,
      capacity,
      utilization,
      waitContribution,
      categories: categoryResults,
    };
    results.push(result);
    if (utilization > 100)
      add(
        "overload",
        id,
        `Surcharge : ${Number.isFinite(utilization) ? utilization.toFixed(1) + " %" : "capacité nulle"}`,
        FORMULAS.utilization,
      );
    if (waitContribution > 0)
      add(
        "waiting",
        id,
        `Attente déclarée : contribution pondérée ${waitContribution.toFixed(1)} min·dossiers`,
        FORMULAS.waiting,
      );
    if (isEnd || !out.get(id).length)
      terminals.push(...categoryResults.map((c) => ({ ...c, nodeId: id })));
    const links = out.get(id);
    for (const [category, state] of stream) {
      let specified = 0,
        automatic = 0;
      const percentages = links.map((e) => {
        const v =
          e.data?.routingType === "item"
            ? e.data.itemRouting?.[category]
            : e.data?.percentage;
        if (v === undefined || e.data?.routingType === "remaining") {
          automatic++;
          return undefined;
        }
        const n = measure(e.data || {}, `routing:${category}`, v);
        if (n !== null) specified += n;
        return n;
      });
      const invalid =
        percentages.some((p) => p === null) ||
        specified > 100 + 1e-8 ||
        (!automatic && links.length && Math.abs(specified - 100) > 1e-8);
      if (invalid)
        add(
          "routing",
          id,
          `Répartition invalide pour ${state.name} : ${specified} %. Les volumes descendants sont inconnus.`,
        );
      links.forEach((edge, index) => {
        const pct = invalid
          ? null
          : (percentages[index] ?? (100 - specified) / automatic);
        const v =
          pct === null || state.volume === null
            ? null
            : (state.volume * pct) / 100;
        if (v === 0) return;
        const edgeWait = measure(
          edge.data || {},
          `wait:${category}`,
          Object.hasOwn(edge.data?.itemData?.[category] || {}, "wait")
            ? edge.data.itemData[category].wait : edge.data?.wait_time,
          { time: true },
        );
        if (edgeWait === null)
          add(
            "unknown-wait",
            edge.id,
            `Attente de connexion non renseignée : ${state.name}`,
            FORMULAS.waiting,
          );
        if (edgeWait > 0) add("waiting", edge.id, `Attente ${state.name} : ${edgeWait} min par dossier`, FORMULAS.waiting);
        const waiting =
          state.waiting === null || edgeWait === null
            ? null
            : state.waiting + edgeWait;
        const maxLead =
          state.maxLead === null || edgeWait === null
            ? null
            : state.maxLead + edgeWait;
        const next = {
          ...state,
          volume: v,
          waiting,
          maxLead,
          path: [...state.path, edge.target],
        };
        const target = streams.get(edge.target),
          old = target.get(category);
        if (!old) {
          target.set(category, next);
          return;
        }
        const total = old.volume === null || v === null ? null : old.volume + v;
        const average = (a, b) =>
          a === null || b === null || total === null || !total
            ? null
            : (a * old.volume + b * v) / total;
        target.set(category, {
          ...next,
          volume: total,
          processing: average(old.processing, next.processing),
          waiting: average(old.waiting, next.waiting),
          maxLead:
            old.maxLead === null || maxLead === null
              ? null
              : Math.max(old.maxLead, maxLead),
          path: (old.maxLead ?? -1) > (maxLead ?? -1) ? old.path : next.path,
        });
      });
    }
  }
  const workload =
    blocked.length || results.some((r) => r.workload === null)
      ? null
      : results.reduce((sum, r) => sum + r.workload, 0);
  const complete =
    blocked.length === 0 &&
    issues.every(
      (i) =>
        ![
          "routing",
          "unknown",
          "unknown-wait",
          "invalid-edge",
          "allocation",
        ].includes(i.kind),
    );
  const completedVolume = terminals.some((c) => c.volume === null)
    ? null
    : terminals.reduce((sum, c) => sum + c.volume, 0);
  const average = (key) =>
    blocked.length > 0 ||
    issues.some((i) => ["routing", "invalid-edge"].includes(i.kind)) ||
    !completedVolume ||
    terminals.some((c) => c[key] === null)
      ? null
      : terminals.reduce((sum, c) => sum + c[key] * c.volume, 0) /
        completedVolume;
  const longest =
    terminals
      .filter((c) => c.maxLead !== null)
      .sort((a, b) => b.maxLead - a.maxLead)[0] || null;
  return {
    engine: ANALYTIC_ENGINE,
    workload,
    knownWorkload: results.reduce((sum, r) => sum + r.knownWorkload, 0),
    complete,
    completedVolume,
    processing: average("processing"),
    waiting: average("waiting"),
    lead: average("lead"),
    longest,
    longestIsPartial: !complete,
    nodes: results,
    terminals,
    issues,
    elapsedMs: performance.now() - started,
  };
}
export const displayNumber = (value) =>
  value === null || value === undefined
    ? "Inconnu"
    : Number.isFinite(value)
      ? value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })
      : "∞";
