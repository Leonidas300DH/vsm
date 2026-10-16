import { useState } from "react";
import { createTemplate, insertTemplate } from "../services/templates.js";
import { uid } from "../services/project.js";
import { downloadJSON } from "../services/portable.js";
import {
  analysisPackage,
  validateProposal,
  previewProposal,
  acceptProposal,
} from "../services/proposals.js";
import LocalAI from "./LocalAI.jsx";
import { Results } from "./AnalysisPanel.jsx";

export function Templates({ project, scenario, onChange }) {
  const [name, setName] = useState("Sous-processus"),
    [selected, setSelected] = useState(
      scenario.nodes.filter((n) => n.selected).map((n) => n.id),
    ),
    [mapping, setMapping] = useState({}),
    [parameters, setParameters] = useState({}),
    [error, setError] = useState("");
  const categories = [
    ...new Map(
      scenario.nodes
        .flatMap((n) => n.data.volumeItems || [])
        .map((c) => [c.id, c]),
    ).values(),
  ];
  const run = (fn) => {
    try {
      setError("");
      fn();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <p>
        Enregistrez un ensemble d’étapes avec ses ressources. Une insertion crée
        des identifiants indépendants ; les ports externes restent à raccorder
        explicitement.
      </p>
      <div className="studio-row">
        <input
          aria-label="Nom du modèle"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          disabled={!name.trim() || !selected.length}
          onClick={() =>
            run(() =>
              onChange({
                ...project,
                templates: [
                  ...(project.templates || []),
                  createTemplate(scenario, selected, name),
                ],
              }),
            )
          }
        >
          Enregistrer le modèle
        </button>
      </div>
      <details>
        <summary>Sélection ({selected.length})</summary>
        {[...scenario.nodes, ...(scenario.groups || []).map(g=>({...g,data:{label:g.name}}))].map((n) => (
          <label key={n.id}>
            <input
              type="checkbox"
              checked={selected.includes(n.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, n.id]
                    : selected.filter((id) => id !== n.id),
                )
              }
            />
            {n.data.label || n.id}
          </label>
        ))}
      </details>
      {error && <p role="alert">{error}</p>}
      {(project.templates || []).map((t) => (
        <fieldset key={t.id}>
          <legend>
            {t.name} · {t.nodes.length} étapes
          </legend>
          <p>
            Source {t.provenance.scenarioId} · r{t.provenance.revision}
          </p>
          {t.categories.map((c) => (
            <label key={c.id}>
              {c.name}
              <select
                aria-label={`Correspondance ${t.name} ${c.name}`}
                value={mapping[`${t.id}:${c.id}`] || ""}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    [`${t.id}:${c.id}`]: e.target.value,
                  })
                }
              >
                <option value="">Choisir explicitement</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <details>
            <summary>Paramètres d’insertion</summary>
            {(t.parameters || []).map((p) => (
              <label key={`${p.id}:${p.key}`}>
                {p.label}
                <input
                  type="number"
                  min="0"
                  value={
                    Object.hasOwn(parameters[t.id]||{},`${p.id}:${p.key}`)?parameters[t.id][`${p.id}:${p.key}`]??"":p.value??""
                  }
                  onChange={(e) =>
                    setParameters({
                      ...parameters,
                      [t.id]: {
                        ...parameters[t.id],
                        [`${p.id}:${p.key}`]:
                          e.target.value === "" ? null : Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </details>
          <p>
            Ports :{" "}
            {t.boundary.map((b) => `${b.direction} ${b.nodeId}`).join(", ") ||
              "Aucun port externe"}
          </p>
          <button
            onClick={() =>
              run(() => {
                const map = Object.fromEntries(
                  t.categories.map((c) => [c.id, mapping[`${t.id}:${c.id}`]]),
                );
                const next = insertTemplate(
                  scenario,
                  t,
                  map,
                  {
                    x:
                      Math.max(0, ...scenario.nodes.map((n) => n.position.x)) +
                      1000,
                    y: 0,
                  },
                  parameters[t.id] || {},
                );
                onChange({
                  ...project,
                  scenarios: project.scenarios.map((s) =>
                    s.id === scenario.id ? next.scenario : s,
                  ),
                });
              })
            }
          >
            Insérer une copie indépendante
          </button>
        </fieldset>
      ))}
    </>
  );
}
export function Review({ project, scenario, onSave, onPresent }) {
  const [target, setTarget] = useState(scenario.nodes[0]?.id || ""),
    [measureKey, setMeasureKey] = useState(""),
    [text, setText] = useState(""),
    [author, setAuthor] = useState(""),
    [error, setError] = useState(""),
    [report, setReport] = useState(null);
  const objects = [...scenario.nodes, ...scenario.edges, ...(scenario.groups || []).map(g => ({...g,data:{label:g.name}}))],
    comments = scenario.comments || [],
    presentation = scenario.presentation || [];
  const changeComment = (id, updates) =>
    onSave({
      ...scenario,
      comments: comments.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    });
  return (
    <>
      <h3>Commentaires</h3>
      <label>
        Objet
        <select
          aria-label="Objet du commentaire"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          {objects.map((o) => (
            <option key={o.id} value={o.id}>
              {o.source ? `${o.source} → ${o.target}` : o.data.label || o.id}
            </option>
          ))}
        </select>
      </label>
      <label>
        Hypothèse (facultatif)
        <input
          value={measureKey}
          onChange={(e) => setMeasureKey(e.target.value)}
          placeholder="cycle:retail, wait…"
        />
      </label>
      <input
        aria-label="Auteur du commentaire"
        placeholder="Auteur"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
      />
      <textarea
        aria-label="Commentaire"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        disabled={!text.trim() || !target}
        onClick={() => {
          onSave({
            ...scenario,
            comments: [
              ...comments,
              {
                id: uid(),
                target: { id: target, measureKey },
                text,
                author,
                status: "open",
                createdAt: new Date().toISOString(),
                includeInReport: true,
              },
            ],
          });
          setText("");
        }}
      >
        Ajouter le commentaire
      </button>
      {comments.map((c) => (
        <article className="review-comment" key={c.id}>
          <strong>
            {objects.find((o) => o.id === c.target.id)?.data.label ||
              c.target.id}{" "}
            {!objects.some((o) => o.id === c.target.id) &&
              "· Référence supprimée"}{" "}
            {c.target.measureKey}
          </strong>
          <p>{c.text}</p>
          <small>
            {c.author} · {c.status === "resolved" ? "Résolu" : "Ouvert"}
          </small>
          <div className="studio-row">
            <button
              onClick={() =>
                changeComment(c.id, {
                  status: c.status === "resolved" ? "open" : "resolved",
                })
              }
            >
              {c.status === "resolved" ? "Rouvrir" : "Résoudre"}
            </button>
            <label>
              <input
                type="checkbox"
                checked={c.includeInReport !== false}
                onChange={(e) =>
                  changeComment(c.id, { includeInReport: e.target.checked })
                }
              />
              Inclure dans le PDF
            </label>
          </div>
        </article>
      ))}
      <h3>Parcours de présentation</h3>
      <div className="studio-row">
        <select
          aria-label="Étape à présenter"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          {[...scenario.nodes, ...(scenario.groups || []).map(g=>({...g,data:{label:g.name}}))].map((n) => (
            <option key={n.id} value={n.id}>
              {n.data.label || n.id}
            </option>
          ))}
        </select>
        <button
          disabled={!scenario.nodes.some((n) => n.id === target) && !scenario.groups?.some(g=>g.id===target)}
          onClick={() =>
            onSave({
              ...scenario,
              presentation: [...presentation, { id: uid(), nodeId: target }],
            })
          }
        >
          Ajouter au parcours
        </button>
        <button
          disabled={!presentation.length}
          onClick={() => onPresent(presentation)}
        >
          Présenter
        </button>
      </div>
      {presentation.map((p, index) => (
        <div className="studio-row" key={p.id}>
          <span>
            {index + 1}.{" "}
            {scenario.nodes.find((n) => n.id === p.nodeId)?.data.label || scenario.groups?.find(g=>g.id===p.nodeId)?.name ||
              "Référence supprimée"}
          </span>
          <button
            disabled={!index}
            aria-label={`Monter ${index + 1}`}
            onClick={() => {
              const order = [...presentation];
              [order[index - 1], order[index]] = [
                order[index],
                order[index - 1],
              ];
              onSave({ ...scenario, presentation: order });
            }}
          >
            ↑
          </button>
          <button
            disabled={index === presentation.length - 1}
            aria-label={`Descendre ${index + 1}`}
            onClick={() => {
              const order = [...presentation];
              [order[index + 1], order[index]] = [
                order[index],
                order[index + 1],
              ];
              onSave({ ...scenario, presentation: order });
            }}
          >
            ↓
          </button>
          <button
            onClick={() =>
              onSave({
                ...scenario,
                presentation: presentation.filter((x) => x.id !== p.id),
              })
            }
          >
            Retirer
          </button>
        </div>
      ))}
      <h3>Rapport paginé</h3>
      <p>
        Vue d’ensemble, fiches détaillées, logos, hypothèses, comparaison à
        l’actuel et commentaires sélectionnés.
      </p>
      <button
        onClick={async () => {
          try {
            setError("");
            const { exportReport } = await import("../services/report.js");
            if (report) URL.revokeObjectURL(report.url);
            setReport(await exportReport(project));
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        Exporter le rapport PDF
      </button>
      {report && (
        <a className="report-download" href={report.url} download={report.name}>
          Télécharger le PDF préparé
        </a>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function Automation({ project, scenario, onChange, onInspect }) {
  const [constraints, setConstraints] = useState(""),
    [resources, setResources] = useState(true),
    [raw, setRaw] = useState(""),
    [candidate, setCandidate] = useState(null),
    [error, setError] = useState(""),
    [showPackage, setShowPackage] = useState(false);
  const pack = analysisPackage(scenario, constraints, resources);
  const validate = () => {
    try {
      const value = JSON.parse(raw);
      const result = validateProposal(value, scenario);
      if (!result.ok) throw new Error(result.errors.join("\n"));
      setCandidate({ value, scenario: previewProposal(value, scenario) });
      setError("");
    } catch (e) {
      setError(e.message);
      setCandidate(null);
    }
  };
  return (
    <>
      <p>
        Codex travaille à la demande depuis le dossier exporté. Les pièces
        jointes, logos et champs supplémentaires sont exclus. Vérifiez
        ci-dessous les descriptions et sources avant transmission.
      </p>
      <textarea
        aria-label="Contraintes d’automatisation"
        placeholder="Contraintes, objectifs, règles de supervision…"
        value={constraints}
        onChange={(e) => setConstraints(e.target.value)}
      />
      <label>
        <input
          type="checkbox"
          checked={resources}
          onChange={(e) => setResources(e.target.checked)}
        />
        Inclure les descriptions des ressources
      </label>
      <button onClick={() => setShowPackage(!showPackage)}>
        Voir exactement le dossier d’analyse
      </button>
      {showPackage && <pre>{JSON.stringify(pack, null, 2)}</pre>}
      <div className="studio-row">
        <button onClick={() => downloadJSON(pack, "vsm-analyse-codex.json")}>
          Exporter le dossier Codex
        </button>
        <button
          onClick={() =>
            downloadJSON(pack.proposalTemplate, "vsm-proposition-exemple.json")
          }
        >
          Télécharger le contrat d’exemple
        </button>
      </div>
      <p>
        Dans Codex : « Analyse ce dossier VSM, compare les options humain, IT et
        agent. Produis un JSON conforme à proposalTemplate, avec les
        changements, hypothèses, coûts, supervision et exceptions. Ne modifie
        pas la carte source. »
      </p>
      <LocalAI
        pack={pack}
        onResponse={(value) => {
          setRaw(value);
          setCandidate(null);
        }}
      />
      <h3>Réimporter une proposition</h3>
      <input
        type="file"
        aria-label="Importer une proposition"
        accept=".json"
        onChange={async (e) => {
          const f = e.target.files[0];
          if (f) {
            setRaw(await f.text());
            setCandidate(null);
          }
        }}
      />
      <textarea
        aria-label="JSON de proposition"
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setCandidate(null);
        }}
      />
      <button onClick={validate}>Valider et prévisualiser</button>
      {error && <p role="alert">{error}</p>}
      {candidate && (
        <>
          <h3>{candidate.value.name}</h3>
          {candidate.value.proposals.map((p) => (
            <article key={p.id}>
              <h4>{p.rationale}</h4>
              <table>
                <tbody>
                  {Object.entries(p.alternatives).map(([k, v]) => (
                    <tr key={k}>
                      <th>{k}</th>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>Hypothèses : {p.assumptions.join(" ; ")}</p>
              <p>
                Coûts : {p.costs.amount ?? "Inconnu"} {p.costs.currency}/
                {p.costs.period} · {p.costs.basis}
              </p>
              <p>
                Supervision : {p.supervision} · Exceptions : {p.exceptions}
              </p>
              <pre>{JSON.stringify(p.changes, null, 2)}</pre>
            </article>
          ))}
          <Results scenario={candidate.scenario} onInspect={onInspect} />
          <button
            onClick={() => {
              onChange(acceptProposal(project, candidate.value));
              setCandidate(null);
              setRaw("");
            }}
          >
            Valider la création d’une cible
          </button>
        </>
      )}
    </>
  );
}
