import { useState, useEffect } from "react";
import ReactFlow, {
  ReactFlowProvider,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  useNodesInitialized,
} from "reactflow";
import { X, Plus, Minus, Maximize2, Save } from "lucide-react";
import { GraphContext } from "../store/graphContext";
import { useGraphState } from "../store/graphContext";
import { nodeTypes, edgeTypes } from "./graphTypes";
import PropertiesPanel from "./PropertiesPanel";
import useModalKeyboard from "./useModalKeyboard";
import { uid } from "../services/project";
import { groupCollisions, layoutGroups } from "../services/groupProjection";
import { applyGroupCommand, summarizeGroup } from "../services/groups";
import { analyze, displayNumber as fmt } from "../services/analysis";
import { calculateMetrics } from "../utils/calculations";
import { startDecomposition } from "../services/decomposition";
import { resourceKinds } from "../utils/resources";
function FrameDraft({ count }) {
  const ready = useNodesInitialized();
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (ready && count) fitView({padding:.2, maxZoom:1, duration:150});
  }, [ready, count, fitView]);
  return null;
}
function DraftControls() {
  const {zoomIn, zoomOut, fitView} = useReactFlow();
  return <div className="canvas-selection-tool nodrag" role="toolbar" aria-label="Navigation des sous-étapes">
    <button aria-label="Zoom avant" onClick={() => zoomIn()}><Plus size={16}/></button>
    <button aria-label="Zoom arrière" onClick={() => zoomOut()}><Minus size={16}/></button>
    <button aria-label="Cadrer les sous-étapes" onClick={() => fitView({padding:.2,maxZoom:1})}><Maximize2 size={16}/></button>
  </div>;
}
export default function DecompositionEditor({
  scenario,
  nodeId,
  execute,
  onClose,
}) {
  const live = useGraphState();
  const [referenceScenario] = useState(() => structuredClone(scenario));
  const [original] = useState(() =>
    structuredClone(scenario.nodes.find((n) => n.id === nodeId)),
  );
  const [draft, setDraft] = useState(() => startDecomposition(scenario, nodeId));
  const [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [accept, setAccept] = useState(false),
    [review, setReview] = useState(false);
  const change = (fn) => {
    setDraft((old) => fn(structuredClone(old)));
    setSaved(false);
    setReview(false);
  };
  const analysis = analyze(scenario),
    categories = analysis.nodes.find((n) => n.id === nodeId)?.categories || [];
  const boundary = scenario.edges.filter(
    (e) => e.source === nodeId || e.target === nodeId,
  );
  const patch = (id, data) =>
    change((d) => {
      const n = d.nodes.find((n) => n.id === id);
      n.data = { ...n.data, ...data };
      return d;
    });
  const add = () =>
    change((d) => {
      const id = uid(),
        last = d.nodes.at(-1);
      d.nodes.push({
        id,
        type: "process",
        position: {
          x: original.position.x + d.nodes.length * 900,
          y: original.position.y,
        },
        data: {
          label: `Sous-étape ${d.nodes.length + 1}`,
          cycleTimes: Object.fromEntries(
            categories.map((c) => [c.category, null]),
          ),
          wait_time: null,
          executionMode: "step",
        },
      });
      if (last)
        d.edges.push({
          id: uid(),
          source: last.id,
          target: id,
          type: "flow",
          data: { routingType: "global", percentage: 100, wait_time: 0 },
        });
      for (const e of boundary) {
        if (e.target === nodeId && !d.inputs[e.id]) d.inputs[e.id] = id;
        if (e.source === nodeId) d.outputs[e.id] = id;
      }
      return d;
    });
  let candidate = null,
    candidateError = "",
    requiresArrange = false;
  try {
    candidate = applyGroupCommand(scenario, {
      type: "activateDraft",
      nodeId,
      draft,
      acceptIncomplete: true,
    });
    const old = new Set(groupCollisions(scenario));
    requiresArrange = groupCollisions(candidate).some((hit) => !old.has(hit));
    if (requiresArrange) candidate = layoutGroups(candidate);
  } catch (e) {
    candidateError = e.message;
    candidate = null;
  }
  const result = candidate && analyze(candidate);
  const referenceSummary = summarizeGroup(referenceScenario, nodeId);
  const detailSummary = candidate && summarizeGroup(candidate, nodeId, result);
  const resourceNames = (summary, kind) =>
    summary?.resources[kind].map((r) => r.name).join(", ") || "Aucun";
  const documentNames = (nodes) =>
    [
      ...new Map(
        nodes
          .flatMap((n) => n.data.attachments || [])
          .map((a) => [a.id || a.name, a.name || a.id]),
      ).values(),
    ].join(", ") || "Aucun";
  const computed = candidate
    ? calculateMetrics(candidate.nodes, candidate.edges)
    : { nodes: draft.nodes, edges: draft.edges };
  const selectedNode = draft.nodes.find((n) => n.selected);
  const resourceSave = (kind, r) => {
    const id = r.id || uid();
    change((d) => {
      d[kind] = d[kind].filter((x) => x.id !== id).concat({ ...r, id });
      return d;
    });
    return id;
  };
  const context = {
    ...live,
    ...draft,
    scenarioScoped: true,
    isDecomposition: true,
    readOnly: false,
    orientation: "horizontal",
    selectedItemId: null,
    setSelectedItem: () => {},
    nodes: draft.nodes.map((n) => ({
      ...computed.nodes.find((c) => c.id === n.id),
      ...n,
      data: { ...computed.nodes.find((c) => c.id === n.id)?.data, ...n.data, process_time_total: result?.nodes.find(c => c.id === n.id)?.workload ?? null },
    })),
    edges: draft.edges.map(e => ({...e, data: {...e.data, ...computed.edges.find(c => c.id === e.id)?.data}})),
    beginInteraction: () => {},
    updateNodeData: patch,
    updateEdgeData: (id, data) =>
      change((d) => {
        const e = d.edges.find((e) => e.id === id);
        e.data = { ...e.data, ...data };
        return d;
      }),
    addNextNode: add,
    deleteNode: (id) =>
      change((d) => {
        d.nodes = d.nodes.filter((n) => n.id !== id);
        d.edges = d.edges.filter((e) => e.source !== id && e.target !== id);
        return d;
      }),
    saveResource: resourceSave,
    deleteResource: () => {
      throw new Error("Gérez les bibliothèques depuis la carte principale.");
    },
    attachResource: (id, kind, rid) =>
      patch(id, {
        [resourceKinds[kind].field]: [
          ...new Set([
            ...(draft.nodes.find((n) => n.id === id).data[
              resourceKinds[kind].field
            ] || []),
            rid,
          ]),
        ],
      }),
    detachResource: (id, kind, rid) =>
      patch(id, {
        [resourceKinds[kind].field]: (
          draft.nodes.find((n) => n.id === id).data[
            resourceKinds[kind].field
          ] || []
        ).filter((x) => x !== rid),
      }),
    saveAndAttachResource: (kind, r, id) => {
      const rid = r.id || uid();
      change((d) => {
        d[kind] = d[kind].filter((x) => x.id !== rid).concat({ ...r, id: rid });
        const n = d.nodes.find((n) => n.id === id);
        n.data[resourceKinds[kind].field] = [
          ...new Set([...(n.data[resourceKinds[kind].field] || []), rid]),
        ];
        return d;
      });
      return rid;
    },
  };
  const activate = async () => {
    try {
      await execute({ type: "activateDraft", nodeId, draft, acceptIncomplete: accept, arrange: requiresArrange });
      onClose();
    } catch (e) { setError(e.message); }
  };
  const save = async () => {
    try {
      await execute({ type: "saveDraft", nodeId, draft });
      setSaved(true);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  };
  const close = () => {
    if (
      saved ||
      window.confirm(
        "Fermer le détail ? Les changements non enregistrés du brouillon seront perdus.",
      )
    )
      onClose();
  };
  useModalKeyboard(true, close);
  return (
    <div
      className="decomposition-editor studio-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Décomposer une étape"
    >
      <header>
        <strong>
          {original.data.label} <span>· Détail en construction</span>
        </strong>
        <button onClick={add}>
          <Plus size={15} /> Ajouter une sous-étape
        </button>
        <button onClick={save}>
          <Save size={15} /> Enregistrer le brouillon
        </button>
        <button aria-label="Fermer le détail" onClick={close}>
          <X size={18} />
        </button>
      </header>
      <p className="draft-notice">
        Référence conservée : le détail ne remplace les calculs actuels qu’après
        validation. {saved ? "Brouillon enregistré." : ""}
      </p>
      <div className="draft-workspace">
        <div className="draft-map">
          <GraphContext.Provider value={context}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={context.nodes}
                edges={context.edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                minZoom={0.1}
                onNodesChange={(changes) =>
                  change((d) => {
                    d.nodes = applyNodeChanges(changes, d.nodes);
                    d.edges = d.edges.filter(
                      (e) =>
                        d.nodes.some((n) => n.id === e.source) &&
                        d.nodes.some((n) => n.id === e.target),
                    );
                    return d;
                  })
                }
                onEdgesChange={(changes) =>
                  change((d) => {
                    d.edges = applyEdgeChanges(changes, d.edges);
                    return d;
                  })
                }
                onConnect={(c) =>
                  change((d) => {
                    d.edges.push({
                      ...c,
                      id: uid(),
                      type: "flow",
                      data: { percentage: 100, wait_time: 0 },
                    });
                    return d;
                  })
                }
              >
                <FrameDraft count={draft.nodes.length}/>
                <Background />
                <DraftControls />
              </ReactFlow>
            </ReactFlowProvider>
          </GraphContext.Provider>
          {!draft.nodes.length && (
            <div className="draft-empty">
              <button onClick={add}><Plus size={16}/>Créer la première sous-étape</button>
              <br />
              Aucun temps n’est réparti automatiquement.
            </div>
          )}
        </div>
        {(selectedNode || draft.edges.some(e => e.selected)) && <GraphContext.Provider value={context}>
          <PropertiesPanel
            onClose={() =>
              change((d) => {
                d.nodes.forEach((n) => (n.selected = false));
                d.edges.forEach((e) => (e.selected = false));
                return d;
              })
            }
          />
        </GraphContext.Provider>}
      </div>
      <div className="draft-boundaries">
        {boundary.map((e) => {
          const incoming = e.target === nodeId,
            field = incoming ? "inputs" : "outputs";
          return (
            <label key={`${field}:${e.id}`}>
              {incoming ? "Depuis" : "Vers"} · {scenario.nodes.find(n => n.id === (incoming ? e.source : e.target))?.data.label || e.id}
              <select
                aria-label={`${incoming ? "Entrée" : "Sortie"} ${e.id}`}
                value={draft[field][e.id] || ""}
                onChange={(event) =>
                  change((d) => {
                    d[field][e.id] = event.target.value;
                    return d;
                  })
                }
              >
                <option value="">Choisir une sous-étape</option>
                {draft.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.data.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      {selectedNode && (
        <small className="draft-notice">
          Les ressources existantes sont accessibles sous la carte sélectionnée.
          {!!original.data.attachments?.length && (
            <button
              onClick={() =>
                patch(selectedNode.id, {
                  attachments: [
                    ...new Map(
                      [
                        ...(selectedNode.data.attachments || []),
                        ...structuredClone(original.data.attachments),
                      ].map((a) => [a.id || a.name, a]),
                    ).values(),
                  ],
                })
              }
            >
              Réutiliser les pièces jointes de référence
            </button>
          )}
        </small>
      )}
      {error && (
        <p role="alert" className="subprocess-warning">
          {error}
        </p>
      )}
      <footer>
        <button
          onClick={() => {
            if (
              window.confirm(
                "Abandonner le brouillon ? L’étape initiale sera conservée.",
              )
            ) {
              execute({ type: "discardDraft", nodeId })
                .then(onClose)
                .catch((e) => setError(e.message));
            }
          }}
        >
          Abandonner le brouillon
        </button>
        <div className="draft-completion">
          <span>Charge : {fmt(referenceSummary.workload)} → {fmt(detailSummary?.workload)} · Lead time : {fmt(referenceSummary.lead)} → {fmt(detailSummary?.lead)}</span>
          {candidate && !result.complete && <label><input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)}/>Accepter les indicateurs inconnus</label>}
          {requiresArrange && <small>Les étapes seront espacées automatiquement. Annuler reste disponible.</small>}
        </div>
        <button onClick={() => setReview(!review)} aria-expanded={review}>Voir les écarts</button>
        <button className="draft-apply" disabled={!candidate || (!result.complete && !accept)} onClick={activate}>
          Utiliser ces sous-étapes
        </button>
      </footer>
      {review && (
        <section className="draft-review">
          <header><h3>Avant / après activation</h3><button aria-label="Fermer les écarts" onClick={() => setReview(false)}><X size={16}/></button></header>
          {candidateError ? (
            <p role="alert">{candidateError}</p>
          ) : (
            <>
              <table>
                <thead>
                  <tr>
                    <th>Étape · indicateur</th>
                    <th>Référence actuelle</th>
                    <th>Avec le détail</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["workload", "Charge"],
                    ["processing", "Processing / dossier"],
                    ["waiting", "Attente / dossier"],
                    ["lead", "Lead time / dossier"],
                  ].map(([k, label]) => (
                    <tr key={k}>
                      <th>{label}</th>
                      <td>{fmt(referenceSummary[k])}</td>
                      <td>{fmt(detailSummary[k])}</td>
                    </tr>
                  ))}
                  {["inputs", "outputs"].flatMap((side) =>
                    [
                      ...new Set(
                        [...referenceSummary[side], ...detailSummary[side]].map(
                          (c) => c.category,
                        ),
                      ),
                    ].map((id) => (
                      <tr key={`${side}:${id}`}>
                        <th>
                          {side === "inputs" ? "Entrées" : "Sorties"} ·{" "}
                          {
                            [
                              ...referenceSummary[side],
                              ...detailSummary[side],
                            ].find((c) => c.category === id)?.name
                          }
                        </th>
                        <td>
                          {fmt(
                            referenceSummary[side].find(
                              (c) => c.category === id,
                            )?.volume,
                          )}
                        </td>
                        <td>
                          {fmt(
                            detailSummary[side].find((c) => c.category === id)
                              ?.volume,
                          )}
                        </td>
                      </tr>
                    )),
                  )}
                  {Object.entries({
                    tools: "Outils",
                    actors: "Acteurs",
                    knowledge: "Connaissances",
                  }).map(([kind, label]) => (
                    <tr key={kind}>
                      <th>{label}</th>
                      <td>{resourceNames(referenceSummary, kind)}</td>
                      <td>{resourceNames(detailSummary, kind)}</td>
                    </tr>
                  ))}
                  <tr>
                    <th>Documents</th>
                    <td>{documentNames([original])}</td>
                    <td>{documentNames(draft.nodes)}</td>
                  </tr>
                </tbody>
              </table>
              <p>
                {requiresArrange
                  ? "Un réagencement horizontal est nécessaire pour éviter les chevauchements. Il sera appliqué avec le détail et pourra être annulé."
                  : "Les positions existantes sont conservées."}
              </p>
              <p>
                Les ressources et documents de l’étape initiale restent dans sa
                référence. Rattachez-les aux sous-étapes qui les utilisent.
              </p>
              {!result.complete && (
                <label>
                  <input
                    type="checkbox"
                    checked={accept}
                    onChange={(e) => setAccept(e.target.checked)}
                  />{" "}
                  J’accepte que les indicateurs incomplets restent inconnus.
                </label>
              )}
              <button
                disabled={!result.complete && !accept}
                onClick={activate}
              >
                Activer ce détail
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
