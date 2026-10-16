import { useMemo, useState, useRef, useEffect, useEffectEvent } from "react";
import ReactFlow, { ReactFlowProvider } from "reactflow";
import {
  Layers,
  X,
  ChevronRight,
  Ungroup,
  Trash2,
  Maximize2,
} from "lucide-react";
import { useGraphState } from "../store/graphContext";
import { GroupUIContext } from "../store/groupContext";
import {
  projectGroups,
  layoutGroups,
  groupCollisions,
} from "../services/groupProjection";
import {
  summarizeGroup,
  groupLeaves,
  groupingSelection,
  applyGroupCommand,
} from "../services/groups";
import { analyze, displayNumber as fmt } from "../services/analysis";
import { uid } from "../services/project";
import DecompositionEditor from "./DecompositionEditor";
import "./groups.css";
function PlacementPreview({ scenario, nodeTypes, edgeTypes }) {
  const graph = projectGroups(scenario);
  return (
    <div
      className="group-placement-preview"
      aria-label="Aperçu graphique du réagencement"
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          fitView
          minZoom={0.01}
          fitViewOptions={{ padding: 0.1 }}
        />
      </ReactFlowProvider>
    </div>
  );
}
export default function GroupedFlow({
  groupScenario,
  groupReadOnly,
  groupSelection,
  onGroupSelect,
  ...props
}) {
  const state = useGraphState();
  const scenario = useMemo(
    () => ({
      ...state.scenarioExtra,
      ...groupScenario,
      nodes: props.nodes,
      edges: props.edges,
      tools: groupScenario?.tools || state.tools,
      actors: groupScenario?.actors || state.actors,
      knowledge: groupScenario?.knowledge || state.knowledge,
    }),
    [
      state.scenarioExtra,
      groupScenario,
      props.nodes,
      props.edges,
      state.tools,
      state.actors,
      state.knowledge,
    ],
  );
  const key = `vsm.groups.${state.workspaceProject?.id || "scoped"}.${scenario.id || "active"}`;
  const [views, setViews] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vsm.groupViews") || "{}");
    } catch {
      return {};
    }
  });
  const view = views[key] || {},
    collapsed = useMemo(() => view.collapsed || [], [view.collapsed]),
    focusId = scenario.groups?.some((g) => g.id === view.focusId)
      ? view.focusId
      : null;
  const [selection, setSelection] = useState([]),
    [inspected, setInspected] = useState(null),
    [error, setError] = useState(""),
    [draftId, setDraftId] = useState(null),
    [pending, setPending] = useState(null),
    [name, setName] = useState("");
  const [connection, setConnection] = useState(null),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const instance = useRef(null),
    dragStart = useRef(null),
    [drag, setDrag] = useState(null);
  const readOnly = groupReadOnly || state.readOnly;
  const visibleSelection = selection.filter(
    (id) =>
      scenario.nodes.some((n) => n.id === id) ||
      scenario.groups?.some((g) => g.id === id),
  );
  const setView = (updates) =>
    setViews((old) => {
      const next = { ...old, [key]: { ...old[key], ...updates } };
      try {
        localStorage.setItem("vsm.groupViews", JSON.stringify(next));
      } catch {
        /* View remains in session. */
      }
      return next;
    });
  const projection = useMemo(
    () => projectGroups(scenario, { collapsed, focusId }),
    [scenario, collapsed, focusId],
  );
  const summaries = useMemo(() => {
    const analysis = analyze(scenario);
    return new Map(
      (scenario.groups || []).map((g) => [
        g.id,
        summarizeGroup(scenario, g.id, analysis),
      ]),
    );
  }, [scenario]);
  const execute = async (command) => {
    try {
      if (readOnly) throw new Error("Cette carte est en lecture seule.");
      if (command.type === "group" && !command.arrange) {
        const next = applyGroupCommand(scenario, command),
          old = new Set(groupCollisions(scenario, { collapsed, focusId }));
        if (
          groupCollisions(next, { collapsed, focusId }).some(
            (hit) => !old.has(hit),
          )
        ) {
          const arranged = layoutGroups(next);
          setPending({ ...command, arrange: true, next: arranged });
          return;
        }
      }
      await state.applyGroupCommand(command);
      setError("");
      setPending(null);
      setSelection([]);
      if (command.expandId)
        setView({
          collapsed: collapsed.filter((id) => id !== command.expandId),
        });
      if (command.collapseId)
        setView({ collapsed: [...collapsed, command.collapseId] });
    } catch (e) {
      setError(e.message);
    }
  };
  const focus = (id) => {
    setView({ focusId: id });
    setTimeout(
      () =>
        instance.current?.fitView({
          padding: 0.12,
          minZoom: 0.02,
          maxZoom: 1,
          duration: 200,
        }),
      80,
    );
  };
  const toggle = (id) => {
    const next = collapsed.includes(id)
      ? collapsed.filter((x) => x !== id)
      : [...collapsed, id];
    const old = new Set(groupCollisions(scenario, { collapsed, focusId }));
    if (
      groupCollisions(scenario, { collapsed: next, focusId }).some(
        (hit) => !old.has(hit),
      )
    ) {
      try {
        if (readOnly)
          throw new Error(
            "Ce niveau nécessite un réagencement dans son onglet éditable.",
          );
        const arranged = layoutGroups(scenario);
        if (groupCollisions(arranged, { collapsed: next, focusId }).length)
          throw new Error(
            "Des connexions se superposent à ce niveau. Réagencez les étapes concernées avant de changer la vue.",
          );
        setPending({
          type: "layoutGroups",
          next: arranged,
          expandId: collapsed.includes(id) ? id : undefined,
          collapseId: collapsed.includes(id) ? undefined : id,
        });
      } catch (e) {
        setError(e.message);
      }
      return;
    }
    setView({ collapsed: next });
    setTimeout(
      () =>
        instance.current?.fitView({
          nodes: [{ id }],
          padding: 0.2,
          minZoom: 0.02,
          maxZoom: 1,
          duration: 200,
        }),
      80,
    );
  };
  const reveal = useEffectEvent((id) => {
    if (
      !scenario.nodes.some((n) => n.id === id) &&
      !scenario.groups?.some((g) => g.id === id)
    )
      return;
    const ancestors = [];
    let cursor = projection.parents.get(id);
    while (cursor) {
      ancestors.push(cursor);
      cursor = projection.parents.get(cursor);
    }
    setView({
      focusId: null,
      collapsed: collapsed.filter((g) => !ancestors.includes(g)),
    });
    setTimeout(
      () =>
        instance.current?.fitView({
          nodes: [{ id }],
          padding: 0.5,
          maxZoom: 1,
          duration: 200,
        }),
      80,
    );
  });
  useEffect(() => {
    const listener = (e) => reveal(e.detail);
    window.addEventListener("vsm:reveal", listener);
    return () => window.removeEventListener("vsm:reveal", listener);
  }, []);
  const g = scenario.groups?.find((g) => g.id === inspected),
    summary = g && summaries.get(g.id);
  const ancestors = [];
  let cursor = focusId;
  while (cursor) {
    const group = scenario.groups?.find((g) => g.id === cursor);
    if (!group) break;
    ancestors.unshift(group);
    cursor = projection.parents.get(cursor);
  }
  const ui = {
    summaries,
    toggle,
    focus,
    inspect: (id) => {
      setInspected(id);
      setName(scenario.groups.find((g) => g.id === id).name);
    },
  };
  const single =
    visibleSelection.length === 1 &&
    scenario.nodes.find(
      (n) => n.id === visibleSelection[0] && n.type === "process",
    );
  const displayNodes = projection.nodes.map((n) => ({
    ...n,
    selected:
      n.selected || visibleSelection.includes(n.id) || groupSelection === n.id,
    ...(drag && drag.ids.has(n.id)
      ? { position: { x: n.position.x + drag.dx, y: n.position.y + drag.dy } }
      : {}),
  }));
  const nodesChanged = (changes) => {
    const selectedChanges = changes.filter((c) => c.type === "select");
    if (selectedChanges.length)
      setSelection((old) => {
        const ids = new Set(old);
        selectedChanges.forEach((c) =>
          c.selected ? ids.add(c.id) : ids.delete(c.id),
        );
        return [...ids];
      });
    props.onNodesChange?.(
      changes.filter((c) => scenario.nodes.some((n) => n.id === c.id)),
    );
  };
  return (
    <GroupUIContext.Provider value={ui}>
      <div className="grouped-flow">
        <ReactFlow
          {...props}
          nodes={displayNodes}
          edges={projection.edges}
          onInit={(api) => {
            instance.current = api;
            props.onInit?.(api);
          }}
          onNodesChange={nodesChanged}
          multiSelectionKeyCode="Shift"
          selectionKeyCode="Shift"
          deleteKeyCode={readOnly ? null : props.deleteKeyCode}
          onNodeClick={(event, node) => {
            if (node.type === "subprocess") {
              onGroupSelect?.(node.id);
              ui.inspect(node.id);
              if (!event.shiftKey) setSelection([node.id]);
            } else {
              if (!event.shiftKey) setSelection([node.id]);
              props.onNodeClick?.(event, node);
            }
          }}
          onPaneClick={(event) => {
            setSelection([]);
            setInspected(null);
            props.onPaneClick?.(event);
          }}
          onNodeDragStart={(event, node) => {
            if (node.type === "subprocess") {
              dragStart.current = { id: node.id, ...node.position };
            } else props.onNodeDragStart?.(event, node);
          }}
          onNodeDrag={(event, node) => {
            if (node.type === "subprocess" && dragStart.current) {
              const ids = new Set([
                node.id,
                ...groupLeaves(scenario, node.id),
                ...(scenario.groups || [])
                  .filter((g) =>
                    groupLeaves(scenario, g.id).every((id) =>
                      groupLeaves(scenario, node.id).includes(id),
                    ),
                  )
                  .map((g) => g.id),
              ]);
              setDrag({
                ids,
                dx: node.position.x - dragStart.current.x,
                dy: node.position.y - dragStart.current.y,
              });
            } else props.onNodeDrag?.(event, node);
          }}
          onNodeDragStop={(event, node) => {
            if (node.type === "subprocess" && dragStart.current) {
              const dx = node.position.x - dragStart.current.x,
                dy = node.position.y - dragStart.current.y;
              if (Math.abs(dx) + Math.abs(dy) > 0.01)
                execute({ type: "moveGroup", id: node.id, dx, dy });
              setDrag(null);
              dragStart.current = null;
            } else props.onNodeDragStop?.(event, node);
          }}
          onConnect={(c) => {
            if (
              scenario.groups?.some(
                (g) => g.id === c.source || g.id === c.target,
              )
            ) {
              setConnection(c);
              setFrom(
                scenario.nodes.some((n) => n.id === c.source) ? c.source : "",
              );
              setTo(
                scenario.nodes.some((n) => n.id === c.target) ? c.target : "",
              );
            } else props.onConnect?.(c);
          }}
        >
          {props.children}
        </ReactFlow>
        {focusId && (
          <nav className="group-breadcrumb">
            <button onClick={() => focus(null)}>Carte entière</button>
            {ancestors.map((a) => (
              <span key={a.id}>
                <ChevronRight size={12} />
                <button onClick={() => focus(a.id)}>{a.name}</button>
              </span>
            ))}
          </nav>
        )}
        {!readOnly && (visibleSelection.length > 1 || single) && (
          <div className="group-selection nodrag">
            <span>
              {visibleSelection.length} sélectionnée
              {visibleSelection.length > 1 ? "s" : ""}
            </span>
            {visibleSelection.length > 1 ? (
              <button
                onClick={() => {
                  try {
                    groupingSelection(scenario, visibleSelection);
                    setName("Nouveau sous-processus");
                    setPending({
                      type: "group",
                      id: uid(),
                      ids: visibleSelection,
                    });
                    setError("");
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                <Layers size={15} /> Regrouper
              </button>
            ) : (
              <button onClick={() => setDraftId(single.id)}>
                Détailler en sous-étapes
              </button>
            )}
          </div>
        )}
        {error && (
          <div role="alert" className="group-message">
            {error}
            <button
              aria-label="Fermer le diagnostic"
              onClick={() => setError("")}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {g && (
          <aside className="group-inspector nodrag nowheel">
            <header>
              <Layers size={17} />
              <strong>Sous-processus</strong>
              <button
                aria-label="Fermer l’inspecteur du groupe"
                onClick={() => setInspected(null)}
              >
                <X size={16} />
              </button>
            </header>
            <label>
              Nom
              <input
                aria-label="Nom du groupe"
                value={name}
                readOnly={readOnly}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (!readOnly && name.trim() && name !== g.name)
                    execute({ type: "renameGroup", id: g.id, name });
                }}
              />
            </label>
            <p>{summary.count} étapes · Synthèse calculée depuis le détail.</p>
            <dl>
              {[
                ["Charge", summary.workload],
                ["Processing / dossier", summary.processing],
                ["Attente / dossier", summary.waiting],
                ["Lead time / dossier", summary.lead],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{fmt(v)} min</dd>
                </div>
              ))}
            </dl>
            <details>
              <summary>Volumes aux frontières, par catégorie</summary>
              {[
                ["Entrées", summary.inputs],
                ["Sorties", summary.outputs],
              ].map(([label, rows]) => (
                <div key={label}>
                  <strong>{label}</strong>
                  {rows.map((c) => (
                    <p key={c.category}>
                      {c.name} : {fmt(c.volume)}
                    </p>
                  ))}
                </div>
              ))}
              <small>
                Flux de passages. Une réentrée peut compter le même dossier
                plusieurs fois.
              </small>
            </details>
            <details>
              <summary>Étapes et formules</summary>
              <p>
                Charge = Σ volume × temps unitaire. Lead time = processing +
                attentes internes. Délais pondérés par les routages.
              </p>
              {summary.rows.map((n) => (
                <p key={n.id}>
                  {n.label} : {fmt(n.workload)} min de charge
                </p>
              ))}
            </details>
            {Object.entries(summary.resources).map(([kind, rows]) => (
              <details key={kind}>
                <summary>
                  {
                    {
                      tools: "Outils",
                      actors: "Acteurs",
                      knowledge: "Connaissances",
                    }[kind]
                  }{" "}
                  · {rows.length}
                </summary>
                {rows.map((r) => (
                  <p key={r.id}>
                    <strong>{r.name}</strong>
                    <br />
                    {r.usedBy.map((n) => n.name).join(", ")}
                  </p>
                ))}
              </details>
            ))}
            {summary.issues.map((i, j) => (
              <p className="subprocess-warning" key={j}>
                {i.message}
              </p>
            ))}
            {g.reference && (
              <details>
                <summary>Étape initiale conservée</summary>
                <pre>{JSON.stringify(g.reference.data, null, 2)}</pre>
              </details>
            )}
            <button onClick={() => focus(g.id)}>
              <Maximize2 size={14} /> Ouvrir le détail
            </button>
            {!readOnly && (
              <>
                <button
                  onClick={() => {
                    setPending({ type: "ungroup", id: g.id });
                  }}
                >
                  <Ungroup size={14} /> Dissocier le groupe
                </button>
                <button
                  onClick={() => setPending({ type: "deleteGroup", id: g.id })}
                >
                  <Trash2 size={14} /> Supprimer le contenu…
                </button>
                <button
                  onClick={() => {
                    try {
                      const next = layoutGroups(scenario);
                      setPending({ type: "layoutGroups", next });
                    } catch (e) {
                      setError(e.message);
                    }
                  }}
                >
                  Prévisualiser le réagencement
                </button>
              </>
            )}
          </aside>
        )}
        {pending && (
          <div className="group-dialog-backdrop">
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Confirmer le sous-processus"
              className="group-dialog"
            >
              <h3>
                {pending.type === "group"
                  ? "Regrouper les étapes"
                  : pending.type === "ungroup"
                    ? "Dissocier le groupe"
                    : pending.type === "layoutGroups"
                      ? "Réagencement horizontal"
                      : "Supprimer le groupe et son contenu"}
              </h3>
              {pending.arrange && (
                <p>
                  Un réagencement est nécessaire pour éviter les chevauchements.
                  Il sera appliqué dans la même opération annulable.
                </p>
              )}
              {pending.type === "group" ? (
                <label>
                  Nom
                  <input
                    autoFocus
                    aria-label="Nom du sous-processus"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              ) : pending.type === "layoutGroups" ? (
                <div className="group-layout-preview">
                  {pending.next.nodes.map((n) => (
                    <p key={n.id}>
                      {n.data.label} : ({Math.round(n.position.x)},{" "}
                      {Math.round(n.position.y)})
                    </p>
                  ))}
                </div>
              ) : (
                <>
                  <p>
                    {pending.type === "ungroup"
                      ? "Seul le cadre sera retiré. Les étapes, ressources et connexions seront conservées."
                      : "Ces étapes et leurs connexions seront retirées. Les bibliothèques restent conservées. Cette opération est annulable."}
                  </p>
                  <ul>
                    {groupLeaves(scenario, pending.id).map((id) => (
                      <li key={id}>
                        {scenario.nodes.find((n) => n.id === id)?.data.label}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {pending.next && (
                <PlacementPreview
                  scenario={pending.next}
                  nodeTypes={props.nodeTypes}
                  edgeTypes={props.edgeTypes}
                />
              )}
              <footer>
                <button onClick={() => setPending(null)}>Annuler</button>
                <button
                  onClick={() =>
                    execute({
                      ...pending,
                      ...(pending.type === "group" ? { name } : {}),
                    })
                  }
                >
                  Appliquer
                </button>
              </footer>
            </section>
          </div>
        )}
        {connection && (
          <div className="group-dialog-backdrop">
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Choisir les sous-étapes"
              className="group-dialog"
            >
              <h3>Relier les étapes internes</h3>
              {[
                ["Source", connection.source, from, setFrom],
                ["Destination", connection.target, to, setTo],
              ].map(([label, id, value, set]) => (
                <label key={label}>
                  {label}
                  <select
                    aria-label={label}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  >
                    <option value="">Choisir une étape</option>
                    {groupLeaves(scenario, id).map((key) => (
                      <option key={key} value={key}>
                        {scenario.nodes.find((n) => n.id === key)?.data.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <footer>
                <button onClick={() => setConnection(null)}>Annuler</button>
                <button
                  disabled={!from || !to}
                  onClick={() => {
                    props.onConnect?.({
                      ...connection,
                      source: from,
                      target: to,
                      sourceHandle: null,
                      targetHandle: null,
                    });
                    setConnection(null);
                  }}
                >
                  Relier
                </button>
              </footer>
            </section>
          </div>
        )}
        {draftId && (
          <DecompositionEditor
            scenario={scenario}
            nodeId={draftId}
            execute={async (command) => {
              await state.applyGroupCommand(command);
              if (state.flushWorkspace) await state.flushWorkspace();
            }}
            onClose={() => setDraftId(null)}
          />
        )}
      </div>
    </GroupUIContext.Provider>
  );
}
