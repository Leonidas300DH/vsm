import { useMemo, useState, useRef, useEffect, useEffectEvent } from "react";
import ReactFlow, { ReactFlowProvider, SelectionMode } from "reactflow";
import {
  Layers,
  X,
  ChevronRight,
  ArrowLeft,
  Ungroup,
  Trash2,
  Maximize2,
  Scan,
  Plus,
  Minus,
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
  groupingUnits,
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
    [selecting, setSelecting] = useState(false),
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
    selectingRectangle = useRef(false),
    [drag, setDrag] = useState(null);
  const readOnly = groupReadOnly || state.readOnly;
  const visibleSelection = selection.filter(
    (id) =>
      scenario.nodes.some((n) => n.id === id) ||
      scenario.groups?.some((g) => g.id === id),
  );
  const clearSelection = () => {
    setSelection([]);
    props.onNodesChange?.(scenario.nodes.filter((n) => n.selected).map((n) => ({ id: n.id, type: "select", selected: false })));
  };
  const cancelSelection = () => {
    setSelecting(false);
    clearSelection();
    setError("");
  };
  let selectionIssue = "";
  if (selecting && visibleSelection.length > 1) {
    try { groupingSelection(scenario, visibleSelection); }
    catch (e) { selectionIssue = e.message; }
  }
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
          groupCollisions(next, { collapsed: [...collapsed, command.id], focusId }).some(
            (hit) => !old.has(hit),
          )
        ) {
          const arranged = layoutGroups(next);
          if (groupCollisions(arranged, {collapsed:[...collapsed,command.id],focusId}).some(hit => !old.has(hit)))
            throw new Error("Les ressources ou connexions de la synthèse se chevauchent. Espacez les étapes voisines avant de regrouper.");
          setPending({ ...command, arrange: true, next: arranged });
          return;
        }
      }
      await state.applyGroupCommand(command);
      setError("");
      setPending(null);
      setSelection([]);
      if (command.type === "group") {
        cancelSelection();
        setInspected(null);
        setView({collapsed: [...new Set([...collapsed, command.id])]});
        setTimeout(() => instance.current?.fitView({nodes:[{id:command.id}], padding:.35, maxZoom:1, duration:200}), 100);
      }
      if (command.expandId)
        setView({
          collapsed: collapsed.filter((id) => id !== command.expandId),
        });
      if (command.collapseId)
        setView({ collapsed: [...new Set([...collapsed, command.collapseId])], ...(command.viewFocusId !== undefined ? {focusId:command.viewFocusId} : {}) });
    } catch (e) {
      setError(e.message);
    }
  };
  const focus = (id) => {
    cancelSelection();
    setInspected(null);
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
    const nextFocus = id === focusId ? projection.parents.get(id) || null : focusId;
    const next = collapsed.includes(id) && id !== focusId
      ? collapsed.filter((x) => x !== id)
      : [...new Set([...collapsed, id])];
    const old = new Set(groupCollisions(scenario, { collapsed, focusId }));
    if (
      groupCollisions(scenario, { collapsed: next, focusId:nextFocus }).some(
        (hit) => !old.has(hit),
      )
    ) {
      try {
        if (readOnly)
          throw new Error(
            "Ce niveau nécessite un réagencement dans son onglet éditable.",
          );
        const arranged = layoutGroups(scenario);
        if (groupCollisions(arranged, { collapsed: next, focusId:nextFocus }).length)
          throw new Error(
            "Des connexions se superposent à ce niveau. Réagencez les étapes concernées avant de changer la vue.",
          );
        setPending({
          type: "layoutGroups",
          next: arranged,
          expandId: next.includes(id) ? undefined : id,
          collapseId: next.includes(id) ? id : undefined,
          viewFocusId: nextFocus,
        });
      } catch (e) {
        setError(e.message);
      }
      return;
    }
    setView({ collapsed: next, focusId:nextFocus });
    setInspected(null);
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
    decompose: readOnly ? undefined : setDraftId,
    toggle,
    focus,
    inspect: (id) => {
      setInspected(id);
      setName(scenario.groups.find((g) => g.id === id).name);
    },
  };
  const displayNodes = projection.nodes.filter(n => n.id !== focusId).map((n) => ({
    ...n,
    ...(n.type === "subprocess" && !n.data.collapsed
      ? { style: { ...n.style, pointerEvents: "none" }, dragHandle: ".subprocess-node > header" }
      : {}),
    ...(selecting ? { draggable: false, connectable: false, selectable: n.id !== focusId } : {}),
    selected:
      selecting ? visibleSelection.includes(n.id) : n.selected || visibleSelection.includes(n.id) || groupSelection === n.id,
    ...(drag && drag.ids.has(n.id)
      ? { position: { x: n.position.x + drag.dx, y: n.position.y + drag.dy } }
      : {}),
  }));
  const nodesChanged = (changes) => {
    const selectedChanges = changes.filter((c) => c.type === "select");
    if (selectedChanges.length && (!selecting || selectingRectangle.current))
      setSelection((old) => {
        const ids = new Set(old);
        selectedChanges.forEach((c) =>
          c.selected ? ids.add(c.id) : ids.delete(c.id),
        );
        return groupingUnits([...ids], projection.parents, focusId);
      });
    props.onNodesChange?.(
      changes.filter((c) => scenario.nodes.some((n) => n.id === c.id) && !(selecting && c.type === "select")),
    );
  };
  return (
    <GroupUIContext.Provider value={ui}>
      <div className={`grouped-flow ${selecting ? "is-selecting" : ""}`} onKeyDown={(event) => {
        if (event.key === "Escape" && selecting && !pending) {
          event.stopPropagation();
          cancelSelection();
        }
      }}>
        <ReactFlow
          {...props}
          nodes={displayNodes}
          edges={projection.edges}
          onInit={(api) => {
            instance.current = api;
            props.onInit?.(api);
          }}
          onNodesChange={nodesChanged}
          onEdgeClick={selecting ? undefined : props.onEdgeClick}
          onEdgesChange={selecting ? undefined : props.onEdgesChange}
          multiSelectionKeyCode="Shift"
          selectionKeyCode="Shift"
          selectionOnDrag={selecting}
          selectionMode={SelectionMode.Full}
          zoomOnDoubleClick={false}
          panOnDrag={selecting ? [1, 2] : props.panOnDrag}
          nodesDraggable={selecting ? false : props.nodesDraggable}
          nodesConnectable={selecting ? false : props.nodesConnectable}
          elevateNodesOnSelect={false}
          deleteKeyCode={readOnly || selecting ? null : props.deleteKeyCode}
          onNodeClick={(event, node) => {
            if (selecting) {
              setSelection(old => groupingUnits(old.includes(node.id) ? old.filter(id => id !== node.id) : [...old,node.id], projection.parents, focusId));
              return;
            }
            if (node.type === "subprocess") {
              onGroupSelect?.(node.id);

              if (!event.shiftKey) setSelection([node.id]);
            } else {
              if (!event.shiftKey) setSelection([node.id]);
              props.onNodeClick?.(event, node);
            }
          }}
          onNodeDoubleClick={(event, node) => {
            if (selecting || event.target.closest('button,input,select,a')) return;
            event.stopPropagation();
            if (node.type === "subprocess") focus(node.id);
            else if (!readOnly && node.type === "process") setDraftId(node.id);
          }}
          onSelectionStart={() => {selectingRectangle.current = true;}}
          onSelectionEnd={() => {selectingRectangle.current = false;}}
          onPaneClick={(event) => {
            setSelection([]);
            setInspected(null);
            if (!selecting) props.onPaneClick?.(event);
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
          <nav className="group-breadcrumb" aria-label="Niveaux du VSM">
            <button className="group-back" onClick={() => toggle(focusId)} title="Revenir à la synthèse"><ArrowLeft size={16}/>Retour</button>
            <button onClick={() => focus(null)}>Carte entière</button>
            {ancestors.map((a) => (
              <span key={a.id}>
                <ChevronRight size={12} />
                <button onClick={() => focus(a.id)}>{a.name}</button>
              </span>
            ))}
          </nav>
        )}
        <div className="canvas-selection-tool nodrag" role="toolbar" aria-label="Outils de la carte">
            {!readOnly && <>
            <button aria-pressed={selecting} onClick={() => {
              if (selecting) cancelSelection();
              else {
                clearSelection();
                setInspected(null);
                setError("");
                setName("Nouveau groupe");
                setSelecting(true);
                props.onPaneClick?.();
              }
            }}><Scan size={17} /> Sélection</button><span className="canvas-control-divider"/></>}
            <button title="Zoom avant" aria-label="Zoom avant" onClick={() => instance.current?.zoomIn()}><Plus size={16}/></button>
            <button title="Zoom arrière" aria-label="Zoom arrière" onClick={() => instance.current?.zoomOut()}><Minus size={16}/></button>
            <button title="Cadrer la carte" aria-label="Cadrer la carte" onClick={() => instance.current?.fitView({padding:.12, minZoom:.02,maxZoom:1,duration:200})}><Maximize2 size={16}/></button>
          </div>
        {!readOnly && selecting && (
          <div className="group-selection selection-confirm nodrag" role="region" aria-label="Regrouper la sélection">
            <span aria-live="polite">{visibleSelection.length ? `${visibleSelection.length} élément${visibleSelection.length > 1 ? "s" : ""} sélectionné${visibleSelection.length > 1 ? "s" : ""}` : "Cliquez sur les étapes ou tracez un rectangle"}</span>
            {visibleSelection.length > 1 && <input aria-label="Nom du groupe à créer" value={name} onChange={(event) => setName(event.target.value)} />}
            <button className="confirm-group" disabled={visibleSelection.length < 2 || !!selectionIssue || !name.trim()} onClick={() => execute({type: "group", id: uid(), ids: visibleSelection, name})}><Layers size={15} /> Regrouper</button>
            <button onClick={cancelSelection}>Annuler</button>
            {selectionIssue && <small role="status">{selectionIssue}</small>}
          </div>
        )}
        {!readOnly && !selecting && visibleSelection.length > 1 && (
          <div className="group-selection nodrag">
            <span>
              {visibleSelection.length} sélectionnée
              {visibleSelection.length > 1 ? "s" : ""}
            </span>
              <button
                onClick={() => execute({type:"group", id:uid(), ids:visibleSelection, name:"Nouveau groupe"})}
              >
                <Layers size={15} /> Regrouper
              </button>
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
              if (command.type === "activateDraft") {
                setView({collapsed:[...new Set([...collapsed, command.nodeId])]});
                setTimeout(() => instance.current?.fitView({nodes:[{id:command.nodeId}],padding:.35,maxZoom:1,duration:200}),100);
              }
              if (state.flushWorkspace) await state.flushWorkspace();
            }}
            onClose={() => setDraftId(null)}
          />
        )}
      </div>
    </GroupUIContext.Provider>
  );
}
