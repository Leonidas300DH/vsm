import { useMemo, useState } from "react";
import {
  analyze,
  displayNumber as fmt,
  FORMULAS,
} from "../services/analysis.js";
import {
  activeScenario,
  duplicateScenario,
  compareScenarios,
} from "../services/project.js";
import { applySimulation, measurementRows } from "../services/simulation.js";
import useModalKeyboard from "./useModalKeyboard.js";
import useStore from "../store/useStore";
import { Templates, Review, Automation } from "./ReviewPanels.jsx";

export function Results({ scenario, onInspect }) {
  const r = useMemo(() => analyze(scenario), [scenario]);
  return (
    <>
      <p>
        Moteur analytique 1 ·{" "}
        {r.complete
          ? "Données complètes"
          : "Résultats incomplets : consulter les diagnostics"}{" "}
        · {r.elapsedMs.toFixed(1)} ms
      </p>
      <div className="metric-grid">
        {[
          ["Charge / période", r.workload],
          ["Processing / dossier", r.processing],
          ["Attente / dossier", r.waiting],
          ["Lead time / dossier", r.lead],
        ].map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{fmt(value)} min</strong>
          </article>
        ))}
      </div>
      <details>
        <summary>Contrats de calcul</summary>
        {Object.entries(FORMULAS).map(([k, v]) => (
          <p key={k}>
            <strong>{k}</strong> : {v}
          </p>
        ))}
        <p>
          Les convergences additionnent des volumes de parcours alternatifs.
          Aucune attente de file n’est déduite de la surcharge. Les capacités IT
          et agent sont déclarées séparément.
        </p>
      </details>
      <h3>Charge et capacités</h3>
      <table>
        <thead>
          <tr>
            <th>Étape</th>
            <th>Charge (min)</th>
            <th>Contribution</th>
            <th>Capacité (min/période)</th>
            <th>Utilisation</th>
          </tr>
        </thead>
        <tbody>
          {r.nodes.map((n) => (
            <tr key={n.id}>
              <td>
                <button onClick={() => onInspect(n.id)}>{n.label}</button>
              </td>
              <td>{fmt(n.workload)}</td>
              <td>{r.workload > 0 && n.workload !== null ? `${fmt(n.workload / r.workload * 100)} %` : "—"}</td>
              <td>{fmt(n.capacity)}</td>
              <td>{fmt(n.utilization)} %</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>
        Parcours le plus long{" "}
        {r.longestIsPartial ? "connu (analyse incomplète)" : ""}
      </h3>
      <p>
        {r.longest
          ? `${r.longest.path.map((id) => scenario.nodes.find((n) => n.id === id)?.data.label || id).join(" → ")} : ${fmt(r.longest.maxLead)} min`
          : "Indisponible avec les données actuelles."}
      </p>
      <h3>Diagnostics ({r.issues.length})</h3>
      {r.issues.map((issue, i) => (
        <details key={`${issue.kind}-${issue.id}-${i}`}>
          <summary>{issue.message}</summary>
          <p>
            {issue.formula ||
              "Vérifier la structure et les hypothèses du modèle."}
          </p>
          <button onClick={() => onInspect(issue.id, issue)}>
            Ouvrir les données · {issue.id}
          </button>
        </details>
      ))}
    </>
  );
}
export function Measures({ scenario, onSave }) {
  const [filter, setFilter] = useState("");
  const rows = measurementRows(scenario).filter((r) =>
    r.label.toLowerCase().includes(filter.toLowerCase()),
  );
  const edit = (row, field, value) => {
    const next = structuredClone(scenario);
    const data = next[row.kind].find((x) => x.id === row.id).data;
    data.measurements = {
      ...data.measurements,
      [row.key]: {
        status:
          row.value === undefined || row.value === null
            ? "unknown"
            : "estimated",
        unit: row.unit,
        scope: "par période",
        ...data.measurements?.[row.key],
        [field]: value,
      },
    };
    onSave(next);
  };
  return (
    <>
      <p>
        Les valeurs historiques sont conservées. Une mesure absente reste
        inconnue dans le moteur analytique. Déclarer zéro indique une absence
        d’attente observée ou explicitement supposée.
      </p>
      <input
        aria-label="Filtrer les mesures"
        placeholder="Filtrer par étape ou catégorie"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <table>
        <thead>
          <tr>
            <th>Mesure</th>
            <th>Valeur</th>
            <th>Unité</th>
            <th>Statut</th>
            <th>Périmètre / source</th>
            <th>Date / responsable</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const m =
              scenario[row.kind].find((x) => x.id === row.id).data
                .measurements?.[row.key] || {};
            return (
              <tr key={`${row.id}-${row.key}`}>
                <td>{row.label}</td>
                <td>
                  <input
                    aria-label={`Valeur ${row.label}`}
                    type="number"
                    min="0"
                    value={row.value ?? ""}
                    onChange={(e) =>
                      onSave(
                        applySimulation(scenario, [
                          {
                            ...row,
                            value:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          },
                        ]),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`Unité ${row.label}`}
                    value={m.unit || row.unit}
                    onChange={(e) => edit(row, "unit", e.target.value)}
                  />
                </td>
                <td>
                  <select
                    aria-label={`Statut ${row.label}`}
                    value={
                      m.status || (row.value == null ? "unknown" : "estimated")
                    }
                    onChange={(e) => edit(row, "status", e.target.value)}
                  >
                    <option value="measured">Mesuré</option>
                    <option value="estimated">Estimé</option>
                    <option value="unknown">Inconnu</option>
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`Périmètre ${row.label}`}
                    placeholder="Périmètre"
                    value={m.scope || ""}
                    onChange={(e) => edit(row, "scope", e.target.value)}
                  />
                  <input
                    aria-label={`Source ${row.label}`}
                    placeholder="Source"
                    value={m.source || ""}
                    onChange={(e) => edit(row, "source", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Date ${row.label}`}
                    type="date"
                    value={m.date || ""}
                    onChange={(e) => edit(row, "date", e.target.value)}
                  />
                  <input
                    aria-label={`Responsable ${row.label}`}
                    placeholder="Responsable"
                    value={m.owner || ""}
                    onChange={(e) => edit(row, "owner", e.target.value)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <h3>Affectations partagées</h3>
      <p>
        Chaque acteur possède un effectif et une disponibilité par période. Les
        fractions affectées aux étapes ne peuvent dépasser 100 % au total. Un
        rattachement visuel n’ajoute pas de capacité.
      </p>
      {(scenario.actors || []).map((actor) => (
        <fieldset key={actor.id}>
          <legend>{actor.name}</legend>
          {["headcount", "availableTime"].map((field) => (
            <label key={field}>
              {field === "headcount"
                ? "Effectif"
                : "Minutes disponibles / personne / période"}
              <input
                type="number"
                min="0"
                value={actor[field] ?? ""}
                onChange={(e) => {
                  const next = structuredClone(scenario);
                  next.actors.find((a) => a.id === actor.id)[field] =
                    e.target.value === "" ? null : Number(e.target.value);
                  onSave(next);
                }}
              />
            </label>
          ))}
          {scenario.nodes
            .filter((n) => n.data.actorsUsed?.includes(actor.id))
            .map((n) => (
              <label key={n.id}>
                {n.data.label} · fraction (0 à 1)
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={n.data.actorAllocations?.[actor.id] ?? ""}
                  onChange={(e) => {
                    const next = structuredClone(scenario);
                    const d = next.nodes.find((x) => x.id === n.id).data;
                    d.actorAllocations = {
                      ...d.actorAllocations,
                      [actor.id]:
                        e.target.value === "" ? null : Number(e.target.value),
                    };
                    onSave(next);
                  }}
                />
              </label>
            ))}
        </fieldset>
      ))}
    </>
  );
}
export function Scenarios({ project, onChange, onCompare }) {
  const [name, setName] = useState("Cible"),
    [compareId, setCompareId] = useState(project.actualScenarioId);
  const current = activeScenario(project),
    other = project.scenarios.find((s) => s.id === compareId) || current,
    changes = compareScenarios(other, current),
    a = analyze(other),
    b = analyze(current);
  return (
    <>
      <div className="studio-row">
        <input
          aria-label="Nom du nouveau scénario"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          disabled={!name.trim()}
          onClick={() => onChange(duplicateScenario(project, name.trim()))}
        >
          Dupliquer en scénario
        </button>
      </div>
      {project.scenarios.map((s) => (
        <div key={s.id} className="studio-row">
          <input
            aria-label={`Nom du scénario ${s.id}`}
            value={s.name}
            onChange={(e) =>
              onChange({
                ...project,
                scenarios: project.scenarios.map((x) =>
                  x.id === s.id ? { ...x, name: e.target.value } : x,
                ),
              })
            }
          />
          <span>
            {s.id === project.actualScenarioId ? "Référence actuel" : ""}{" "}
            {s.archived ? "· Archivé" : ""} · r{s.revision}
          </span>
          <button
            disabled={s.id === current.id}
            onClick={() => onChange({ ...project, activeScenarioId: s.id })}
          >
            Ouvrir
          </button>
          <button
            disabled={s.id === project.actualScenarioId}
            onClick={() => onChange({ ...project, actualScenarioId: s.id })}
          >
            Définir actuel
          </button>
          <button
            disabled={s.id === project.actualScenarioId || s.id === current.id}
            onClick={() =>
              onChange({
                ...project,
                scenarios: project.scenarios.map((x) =>
                  x.id === s.id ? { ...x, archived: !x.archived } : x,
                ),
              })
            }
          >
            {s.archived ? "Réactiver" : "Archiver"}
          </button>
        </div>
      ))}
      <h3>Comparer {current.name} à</h3>
      <select
        aria-label="Scénario de comparaison"
        value={compareId}
        onChange={(e) => setCompareId(e.target.value)}
      >
        {project.scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <table>
        <thead>
          <tr>
            <th>Indicateur</th>
            <th>{other.name}</th>
            <th>{current.name}</th>
            <th>Écart</th>
          </tr>
        </thead>
        <tbody>
          {["workload", "processing", "waiting", "lead"].map((k) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{fmt(a[k])}</td>
              <td>{fmt(b[k])}</td>
              <td>
                {fmt(a[k] === null || b[k] === null ? null : b[k] - a[k])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        {changes.length} différences métier. Les valeurs inconnues ne produisent
        pas de gain calculé.
      </p>
      <button
        onClick={() =>
          onCompare([...new Set(changes.flatMap(c => {
            if(c.kind === "nodes") return [c.id];
            if(c.kind === "edges") return [c.id,c.before?.source,c.before?.target,c.after?.source,c.after?.target].filter(Boolean);
            const field={tools:"toolsUsed",actors:"actorsUsed",knowledge:"knowledgeUsed"}[c.kind];
            return current.nodes.filter(n=>n.data[field]?.includes(c.id)).map(n=>n.id);
          }))])
        }
      >
        Mettre en évidence sur la carte
      </button>
      {changes.map((c) => (
        <details key={`${c.kind}:${c.id}`}>
          <summary>
            {c.label} · {c.type} ({c.kind})
          </summary>
          <pre>
            {JSON.stringify({ avant: c.before, après: c.after }, null, 2)}
          </pre>
        </details>
      ))}
    </>
  );
}
export function Simulation({ scenario, onSave, onInspect }) {
  const [changes, setChanges] = useState([]),
    [filter, setFilter] = useState(""),
    [name, setName] = useState("Simulation");
  const simulated = useMemo(
    () => applySimulation(scenario, changes),
    [scenario, changes],
  );
  const update = (row, value) =>
    setChanges((prev) => [
      ...prev.filter(
        (c) =>
          !(
            c.id === row.id &&
            c.field === row.field &&
            c.category === row.category
          ),
      ),
      { ...row, value },
    ]);
  return (
    <>
      <p>
        Exploration indépendante : le scénario source ne change pas. Les calculs
        sont déterministes ; aucune file d’attente n’est simulée.
      </p>
      <div className="studio-row">
        <input
          aria-label="Filtrer la simulation"
          placeholder="Étape ou mesure"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <input
          aria-label="Nom du scénario simulé"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={() => setChanges([])}>Réinitialiser</button>
        <button
          disabled={!changes.length || !name.trim()}
          onClick={() => onSave(simulated, name)}
        >
          Enregistrer en scénario
        </button>
      </div>
      <details open>
        <summary>{changes.length} hypothèses modifiées</summary>
        {changes.map((c) => (
          <p key={`${c.id}:${c.key}`}>
            {c.label} : {c.value ?? "Inconnu"}
          </p>
        ))}
      </details>
      <div className="simulation-fields">
        {measurementRows(simulated)
          .filter((r) => r.label.toLowerCase().includes(filter.toLowerCase()))
          .map((row) => (
            <label key={`${row.id}:${row.key}`}>
              <span>{row.label}</span>
              <input
                aria-label={row.label}
                type="number"
                min="0"
                value={row.value ?? ""}
                onChange={(e) =>
                  update(
                    row,
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </label>
          ))}
      </div>
      <Results scenario={simulated} onInspect={onInspect} />
    </>
  );
}
export default function AnalysisPanel({ onClose, onInspect, onPresent }) {
  useModalKeyboard(true,onClose);
  const s = useStore(),
    [tab, setTab] = useState("results");
  const project = s.getWorkspaceProject(),
    scenario = activeScenario(project);
  const saveScenario = (next) =>
    s.editWorkspace({
      ...project,
      scenarios: project.scenarios.map((x) =>
        x.id === scenario.id ? next : x,
      ),
    });
  return (
    <div className="studio-backdrop">
      <section
        className="studio-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Atelier VSM"
      >
        <header>
          <h2>Atelier · {scenario.name}</h2>
          <button aria-label="Fermer l’atelier" onClick={onClose}>
            ×
          </button>
        </header>
        <nav className="studio-tabs">
          {[
            ["results", "Calculs & diagnostics"],
            ["measures", "Hypothèses & sources"],
            ["scenarios", "Scénarios"],
            ["simulation", "Simulation"],
            ["templates", "Sous-processus"],
            ["review", "Revue & présentation"],
            ["automation", "Analyse Codex"],
          ].map(([id, title]) => (
            <button
              key={id}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {title}
            </button>
          ))}
        </nav>
        {tab === "results" && (
          <Results scenario={scenario} onInspect={onInspect} />
        )}{" "}
        {tab === "measures" && (
          <Measures scenario={scenario} onSave={saveScenario} />
        )}{" "}
        {tab === "scenarios" && (
          <Scenarios
            project={project}
            onChange={s.editWorkspace}
            onCompare={(ids) => {
              useStore.setState({ comparisonIds: ids });
              onClose();
            }}
          />
        )}{" "}
        {tab === "simulation" && (
          <Simulation
            key={scenario.id}
            scenario={scenario}
            onInspect={onInspect}
            onSave={(next, name) => {
              s.editWorkspace(duplicateScenario(project, name, next));
              setTab("scenarios");
            }}
          />
        )}
        {tab === "templates" && (
          <Templates
            project={project}
            scenario={scenario}
            onChange={s.editWorkspace}
          />
        )}{" "}
        {tab === "review" && (
          <Review
            project={project}
            scenario={scenario}
            onSave={saveScenario}
            onPresent={onPresent}
          />
        )}{" "}
        {tab === "automation" && (
          <Automation
            project={project}
            scenario={scenario}
            onChange={s.editWorkspace}
            onInspect={onInspect}
          />
        )}
      </section>
    </div>
  );
}
