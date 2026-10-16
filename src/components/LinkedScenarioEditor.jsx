import { useEffect, useEffectEvent, useRef, useState } from 'react';
import ReactFlow, { ReactFlowProvider, Background, Controls, getNodesBounds, getViewportForBounds, useNodesInitialized } from 'reactflow';
import { Link, Unlink, Pause, Play, X, Undo2, Redo2, Scan, Plus, ArrowDownToLine, PanelRight, Settings2 } from 'lucide-react';
import useStore from '../store/useStore';
import { GraphContext } from '../store/graphContext';
import { nodeTypes, edgeTypes } from './graphTypes';
import PropertiesPanel from './PropertiesPanel';
import useModalKeyboard from './useModalKeyboard';
import { calculateMetrics } from '../utils/calculations';
import { resourceKinds } from '../utils/resources';
import { needsLinkedPreview } from '../services/linkedEditing';
import { signature, uid } from '../services/project';
import { scenarioComparison } from '../services/comparison';
import { displayNumber } from '../services/analysis';

const fieldLabels = { label: 'Nom', description: 'Description', cycleTimes: 'Temps unitaires', volumeItems: 'Catégories et volumes', wait_time: 'Attente', percentage: 'Répartition (%)', itemRouting: 'Répartition par catégorie', itemData: 'Attentes et inventaires', toolsUsed: 'Outils rattachés', actorsUsed: 'Acteurs rattachés', knowledgeUsed: 'Connaissances rattachées', attachments: 'Pièces jointes', subtype: 'Exécution', executionMode: 'Rôle', position: 'Position', name: 'Nom', logo: 'Logo', icon: 'Icône', availableTime: 'Temps disponible', batchSize: 'Taille du lot' };
function PreviewChanges({ changes }) {
  const format = (value, key) => {
    if (value == null) return '—';
    if (key === 'logo') return value ? 'Logo personnalisé' : 'Aucun logo';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return text.length > 180 ? text.slice(0, 180) + '…' : text;
  };
  return <div className="linked-preview-changes">{changes.map(c => {
    const clean = value => value ? JSON.parse(signature(value)) : {};
    const before = clean(c.before?.data || c.before), after = clean(c.after?.data || c.after);
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => !['id', 'labelItems', 'volume'].includes(k) && signature(before[k]) !== signature(after[k]));
    return <details key={`${c.kind}:${c.id}`} open={changes.length < 4}><summary>{c.label} · {c.type === 'ajout' ? 'Ajout' : c.type === 'suppression' ? 'Suppression' : 'Modification'}</summary><table><thead><tr><th>Champ</th><th>Avant</th><th>Après</th></tr></thead><tbody>{keys.map(key => <tr key={key}><th>{fieldLabels[key] || key}</th><td>{format(before[key], key)}</td><td>{format(after[key], key)}</td></tr>)}</tbody></table></details>;
  })}</div>;
}

function Ready({ onReady }) {
  const ready = useNodesInitialized();
  const readyCallback = useEffectEvent(onReady);
  useEffect(() => { if (ready) readyCallback(); }, [ready]);
  return null;
}
function LinkedMap({ scenario, context, selection, onSelect, onInit, onMove, onReady, execute }) {
  const [drag, setDrag] = useState(null);
  const nodes = context.nodes.map(n => ({ ...n, selected: selection?.kind === 'nodes' && selection.id === n.id, draggable: !n.data.positionLocked, ...(drag?.id === n.id ? { position: drag.position } : {}) }));
  const edges = context.edges.map(e => ({ ...e, type: 'flow', selected: selection?.kind === 'edges' && selection.id === e.id, markerEnd: { type: 'arrowclosed' } }));
  return <GraphContext.Provider value={context}><ReactFlowProvider><ReactFlow
    nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onInit={onInit} onMove={onMove}
    onNodeClick={(_, node) => onSelect('nodes', node.id)} onEdgeClick={(_, edge) => onSelect('edges', edge.id)}
    onNodeDragStart={(_, node) => onSelect('nodes', node.id)} onNodeDrag={(_, node) => setDrag({ id: node.id, position: node.position })}
    onNodeDragStop={(_, node) => { setDrag(null); execute(scenario.id, { type: 'move', id: node.id, position: node.position }); }}
    onConnect={connection => execute(scenario.id, { type: 'insert', edges: [{ ...connection, id: uid(), type: 'flow', data: { routingType: 'global', percentage: 100 } }] })}
    deleteKeyCode={null} multiSelectionKeyCode={null} selectionKeyCode={null} minZoom={.02} maxZoom={2} fitView fitViewOptions={{ padding: .15 }}>
    <Ready onReady={onReady}/><Background color={context.theme === 'light' ? '#c4d1da' : '#2b404d'} gap={24}/><Controls showInteractive={false}/>
  </ReactFlow></ReactFlowProvider></GraphContext.Provider>;
}

function useScenarioContext(scenario, state, session, selection, execute, detach, group, setNotice) {
    if (!scenario) return null;
    const graph = calculateMetrics(scenario.nodes, scenario.edges);
    const chosen = selection && (selection.scenarioId === scenario.id || (selection.scenarioId === session.masterId && session.linkedIds.includes(scenario.id))) ? selection : null;
    const update = (kind, id, data) => execute(scenario.id, { type: 'patch', kind, id, updates: { data } });
    const getNode = id => useStore.getState().getWorkspaceProject().scenarios.find(s => s.id === scenario.id).nodes.find(n => n.id === id);
    return {
      ...graph, tools: scenario.tools || [], actors: scenario.actors || [], knowledge: scenario.knowledge || [],
      nodes: graph.nodes.map(n => ({ ...n, selected: chosen?.kind === 'nodes' && chosen.id === n.id })),
      edges: graph.edges.map(e => ({ ...e, selected: chosen?.kind === 'edges' && chosen.id === e.id })),
      orientation: state.orientation, detailMode: state.detailMode, theme: state.theme, focus: null, readOnly: false, scenarioScoped: true,
      selectedItemId: null, setSelectedItem: () => {}, beginInteraction: () => detach(scenario.id),
      updateNodeData: (id, data) => update('nodes', id, data), updateEdgeData: (id, data) => update('edges', id, data),
      deleteNode: id => execute(scenario.id, { type: 'remove', kind: 'nodes', id }),
      addNextNode: id => {
        const from = getNode(id), nodeId = uid();
        const right = Math.max(...scenario.nodes.map(n => n.position.x + (n.width || 300))) + 700;
        execute(scenario.id, { type: 'insert', nodes: [{ id: nodeId, type: 'process', position: { x: right, y: from.position.y }, data: { label: 'Nouvelle étape', cycleTimes: {} } }], edges: [{ id: uid(), source: id, target: nodeId, type: 'flow', data: { routingType: 'global', percentage: 100 } }] });
      },
      saveResource: (kind, resource) => {
        const id = resource.id || uid();
        // Synchronous, so the existing library can attach the saved resource immediately.
        detach(scenario.id);
        useStore.getState().applyLinkedEdit(scenario.id, { type: 'resource', kind, entry: { ...resource, id } }, { group: group.current });
        setNotice('Ressource enregistrée dans les scénarios concernés.');
        return id;
      },
      saveAndAttachResource: (kind, resource, nodeId) => {
        const id = resource.id || uid();
        detach(scenario.id);
        useStore.getState().applyLinkedEdit(scenario.id, { type: 'resource', kind, entry: { ...resource, id }, nodeId });
        setNotice('Ressource enregistrée et rattachée. Une seule opération annulable.');
        return id;
      },
      deleteResource: (kind, id) => { execute(scenario.id, { type: 'remove', kind, id }); return true; },
      attachResource: (id, kind, resourceId) => update('nodes', id, { [resourceKinds[kind].field]: [...new Set([...(getNode(id).data[resourceKinds[kind].field] || []), resourceId])] }),
      detachResource: (id, kind, resourceId) => update('nodes', id, { [resourceKinds[kind].field]: (getNode(id).data[resourceKinds[kind].field] || []).filter(x => x !== resourceId) }),
    };
  }

function ScopedMap({ scenario, state, session, selection, execute, detach, group, setNotice, mapSelection, ...props }) {
  const context = useScenarioContext(scenario, state, session, selection, execute, detach, group, setNotice);
  return <LinkedMap scenario={scenario} context={context} selection={mapSelection} execute={execute} {...props}/>;
}

export default function LinkedScenarioEditor({ onClose }) {
  const state = useStore(), project = state.workspaceProject, session = state.linkedEditSession;
  const [selection, setSelection] = useState(null), [inspector, setInspector] = useState(false);
  const [navigation, setNavigation] = useState(true), [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState('Édition liée en pause. Choisissez les enfants puis activez la propagation.');
  const [error, setError] = useState(''), [pending, setPending] = useState(null), [deltas, setDeltas] = useState(false);
  useModalKeyboard(Boolean(pending), () => setPending(null));
  const instances = useRef({}), containers = useRef({}), group = useRef(null), closeRef = useRef(null);
  const available = project.scenarios.filter(s => !s.archived);
  const visible = [session.masterId, ...session.childIds].map(id => available.find(s => s.id === id)).filter(Boolean);
  const master = visible[0];
  const configure = updates => { state.configureLinkedEditing(updates); group.current = null; setError(''); };
  const detach = id => {
    const live = useStore.getState().linkedEditSession;
    if (id !== live.masterId && live.linkedIds.includes(id)) {
      useStore.getState().configureLinkedEditing({ linkedIds: live.linkedIds.filter(x => x !== id) });
      setNotice(`${available.find(s => s.id === id)?.name} est maintenant indépendant. Les autres liens restent actifs.`);
    }
  };
  const select = (scenarioId, kind, id) => {
    detach(scenarioId); setSelection({ scenarioId, kind, id }); setInspector(true);
    // Keep the selected step readable on large maps, as in the comparison view.
    requestAnimationFrame(() => {
      const origin = instances.current[scenarioId];
      if (!origin) return;
      const edge = kind === 'edges' && origin.getEdges().find(e => e.id === id);
      const ids = edge ? [edge.source, edge.target] : [id];
      const targets = Object.entries(instances.current).filter(([key]) => containers.current[key] && (navigation || key === scenarioId));
      const nodes = targets.flatMap(([, instance]) => instance.getNodes().filter(n => ids.includes(n.id)));
      if (!nodes.length) return;
      const sizes = targets.map(([key]) => containers.current[key].getBoundingClientRect());
      const viewport = getViewportForBounds(getNodesBounds(nodes), Math.min(...sizes.map(s => s.width)), Math.min(...sizes.map(s => s.height)), .02, .85, .25);
      targets.forEach(([, instance]) => instance.setViewport(viewport));
    });
  };
  const geometry = () => Object.fromEntries(Object.entries(instances.current).map(([id, instance]) => [id, Object.fromEntries(instance.getNodes().map(n => [n.id, { width: n.width, height: n.height, layoutMetrics: n.layoutMetrics }]))]));
  const execute = (originId, command, confirmed = false) => {
    setError('');
    try {
      detach(originId);
      if (needsLinkedPreview(command) && !confirmed) {
        const result = useStore.getState().previewLinkedEdit(originId, command, geometry());
        setPending({ originId, command, result, signature: signature(useStore.getState().getWorkspaceProject()) });
        return;
      }
      const result = useStore.getState().applyLinkedEdit(originId, command, { confirmed, group: group.current, geometry: geometry() });
      const children = result.report.filter(r => r.scenarioId !== originId).length;
      setNotice(`${children ? `Répliqué dans ${children} scénario(s)` : 'Modification locale'}${result.missing.length ? ` · ${result.missing.join(' ; ')}` : ''}.`);
    } catch (err) { setError(err.message); }
  };
  const fit = () => {
    const maps = Object.entries(instances.current).filter(([id]) => containers.current[id]);
    if (!maps.length) return;
    const nodes = maps.flatMap(([, i]) => i.getNodes());
    if (!nodes.length) return;
    const sizes = maps.map(([id]) => containers.current[id].getBoundingClientRect());
    const viewport = getViewportForBounds(getNodesBounds(nodes), Math.min(...sizes.map(x => x.width)), Math.min(...sizes.map(x => x.height)), .02, .9, .15);
    maps.forEach(([, i]) => i.setViewport(viewport));
  };
  const move = (id, viewport) => {
    if (!navigation) return;
    for (const [key, instance] of Object.entries(instances.current)) if (key !== id && containers.current[key]) {
      const old = instance.getViewport();
      if (Math.abs(old.x - viewport.x) + Math.abs(old.y - viewport.y) + Math.abs(old.zoom - viewport.zoom) > .001) instance.setViewport(viewport);
    }
  };
  const selectedScenario = available.find(s => s.id === selection?.scenarioId);
  const selectedContext = useScenarioContext(selectedScenario, state, session, selection, execute, detach, group, setNotice);
  const comparisons = deltas ? project.scenarios.filter(s => session.childIds.includes(s.id)).map(s => ({ scenario: s, ...scenarioComparison(master, s) })) : [];
  const history = redo => { group.current = null; state[redo ? 'redoBusiness' : 'undoBusiness'](); setNotice(redo ? 'Opération rétablie sur tous les scénarios concernés.' : 'Opération annulée sur tous les scénarios concernés.'); setError(''); };
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);
  return <section className="linked-editor" aria-label="Édition liée des scénarios" onFocusCapture={e => { if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) group.current = uid(); }} onBlurCapture={() => { group.current = null; }} onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); if (pending) setPending(null); else if (settings) setSettings(false); else onClose(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) { e.preventDefault(); history(e.shiftKey); }
  }}>
    <header className="linked-toolbar" inert={Boolean(pending)}>
      <strong>Édition liée</strong>
      <label>Maître <select aria-label="VSM maître" value={session.masterId} onChange={e => { const old = session.masterId; configure({ masterId: e.target.value, childIds: session.childIds.filter(id => id !== e.target.value).concat(old), linkedIds: [] }); setSelection(null); setNotice('Nouveau maître choisi. Reliez les enfants souhaités puis activez l’édition liée.'); }}>{available.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <button aria-expanded={settings} onClick={() => setSettings(!settings)}><Settings2 size={15}/>{session.childIds.length} enfant(s)</button>
      <button className="linked-active" aria-pressed={session.active} onClick={() => { configure({ active: !session.active }); setNotice(session.active ? 'Propagation en pause. Les modifications restent locales.' : 'Propagation active du maître vers les enfants liés.'); }}>{session.active ? <Pause size={15}/> : <Play size={15}/>}<span>{session.active ? 'Édition liée active' : 'Édition liée en pause'}</span></button>
      <button title="Navigation liée" aria-label="Navigation liée" aria-pressed={navigation} onClick={() => setNavigation(!navigation)}>{navigation ? <Link size={15}/> : <Unlink size={15}/>}</button>
      <button title="Cadrer les cartes" aria-label="Cadrer les cartes" onClick={fit}><Scan size={15}/></button>
      <button title="Annuler" aria-label="Annuler l’opération" disabled={!state.canUndo} onClick={() => history(false)}><Undo2 size={15}/></button>
      <button title="Rétablir" aria-label="Rétablir l’opération" disabled={!state.canRedo} onClick={() => history(true)}><Redo2 size={15}/></button>
      <button title="Inspecteur" aria-label="Inspecteur" aria-pressed={inspector} onClick={() => setInspector(!inspector)}><PanelRight size={15}/></button>
      <button ref={closeRef} className="linked-close" onClick={onClose}><X size={15}/>Fermer</button>
    </header>
    {settings && <div className="linked-settings"><b>Afficher les enfants</b>{available.filter(s => s.id !== session.masterId).map(s => <label key={s.id}><input type="checkbox" checked={session.childIds.includes(s.id)} onChange={e => configure({ childIds: e.target.checked ? [...session.childIds, s.id] : session.childIds.filter(id => id !== s.id), linkedIds: e.target.checked ? [...session.linkedIds, s.id] : session.linkedIds.filter(id => id !== s.id) })}/>{s.name}</label>)}<label><input type="checkbox" checked={session.positions} onChange={e => configure({ positions: e.target.checked })}/>Lier aussi les positions</label><small>Relier reprend les prochaines modifications. Réaligner nécessite un aperçu. Cliquer un enfant le rend indépendant.</small></div>}
    <div className="linked-body" inert={Boolean(pending)}>
      <div className="linked-maps">
        {visible.map((scenario, index) => {
          const isMaster = index === 0, isLinked = session.linkedIds.includes(scenario.id);
          const chosen = selection && (selection.scenarioId === scenario.id || (selection.scenarioId === session.masterId && isLinked)) ? selection : null;
          const missing = chosen && !scenario[chosen.kind].some(x => x.id === chosen.id);
          return <section className={`linked-pane ${isMaster ? 'is-master' : ''}`} data-scenario-id={scenario.id} key={scenario.id} aria-label={`Carte ${scenario.name}`}>
            <header className="linked-pane-header"><b className="linked-role">{isMaster ? 'MAÎTRE' : isLinked ? 'LIÉ' : 'INDÉPENDANT'}</b><strong>{scenario.name}</strong>{missing && <span className="linked-missing">Élément absent de ce scénario</span>}
              {!isMaster && <><button aria-label={`${isLinked ? 'Délier' : 'Relier'} ${scenario.name}`} aria-pressed={isLinked} onClick={() => { configure({ linkedIds: isLinked ? session.linkedIds.filter(id => id !== scenario.id) : [...session.linkedIds, scenario.id] }); setNotice(isLinked ? `${scenario.name} est indépendant.` : `${scenario.name} est lié pour les prochaines modifications ; ses différences actuelles sont conservées.`); }}>{isLinked ? <Link size={13}/> : <Unlink size={13}/>} {isLinked ? 'Délier' : 'Relier'}</button><button onClick={() => execute(master.id, { type: 'realign', childIds: [scenario.id] })} title="Prévisualiser le réalignement des éléments communs"><ArrowDownToLine size={13}/>Réaligner…</button></>}
              <button className="linked-add" aria-label={`Ajouter une étape dans ${scenario.name}`} onClick={() => execute(scenario.id, { type: 'insert', nodes: [{ id: uid(), type: 'process', position: { x: Math.max(0, ...scenario.nodes.map(n => n.position.x + (n.width || 300))) + 700, y: 0 }, data: { label: 'Nouvelle étape', cycleTimes: {} } }] })}><Plus size={14}/></button>
            </header>
            <div className="comparison-map" ref={el => { containers.current[scenario.id] = el; }}>
              <ScopedMap scenario={scenario} state={state} session={session} selection={selection} detach={detach} group={group} setNotice={setNotice} mapSelection={chosen} onSelect={(kind, id) => select(scenario.id, kind, id)} onInit={instance => { instances.current[scenario.id] = instance; }} onReady={fit} onMove={(event, viewport) => { if (event) move(scenario.id, viewport); }} execute={execute}/>
            </div>
          </section>;
        })}
      </div>
      {inspector && <div className="linked-inspector" aria-label="Inspecteur du scénario">
        <header><b>{selectedScenario ? selectedScenario.name : 'Inspecteur'}</b><span>{selectedScenario?.id === session.masterId ? (session.active ? 'Maître · propagation active' : 'Maître · édition locale') : selectedScenario ? 'Enfant indépendant' : 'Sélectionnez une étape ou une connexion'}</span></header>
        {selectedScenario ? <GraphContext.Provider value={selectedContext}><PropertiesPanel onClose={() => setInspector(false)}/>{selection?.kind === 'edges' && <button onClick={() => execute(selection.scenarioId, { type: 'remove', kind: 'edges', id: selection.id })}>Supprimer la connexion…</button>}</GraphContext.Provider> : <p>La sélection sur le maître retrouve le même élément chez ses enfants liés. Cliquer un enfant le délie.</p>}
      </div>}
    </div>
    <div className="linked-status"><span role={error ? 'alert' : 'status'} className={error ? 'linked-error' : ''}>{error || notice}</span><button aria-expanded={deltas} onClick={() => setDeltas(!deltas)}>Écarts</button><small>{state.saveStatus === 'saved' ? 'Enregistré' : state.saveStatus === 'pending' || state.saveStatus === 'saving' ? 'Sauvegarde…' : state.saveError || state.saveStatus}</small></div>
    {deltas && <div className="comparison-details linked-deltas"><table><thead><tr><th>Enfant − maître</th><th>Différences</th>{comparisons[0]?.metrics.map(m => <th key={m.key}>{m.label}</th>)}</tr></thead><tbody>{comparisons.map(c => <tr key={c.scenario.id}><th>{c.scenario.name}</th><td>{c.changes.length}</td>{c.metrics.map(m => <td key={m.key}>{displayNumber(m.delta)} min</td>)}</tr>)}</tbody></table></div>}
    {pending && <div className="studio-backdrop linked-preview"><div className="studio-dialog" role="dialog" aria-modal="true" aria-label="Vérifier les modifications"><header><h2>Vérifier les modifications</h2><button aria-label="Fermer l’aperçu" onClick={() => setPending(null)}><X size={16}/></button></header>
      {pending.result.report.map(r => <section key={r.scenarioId}><p><strong>{r.name}</strong><br/>{r.description}</p><PreviewChanges changes={r.changes}/></section>)}
      {pending.result.missing.map(m => <p key={m}>{m}</p>)}
      {!pending.result.report.length && <p>Aucune modification à appliquer.</p>}
      <p>Une seule opération annulable. Aucun scénario non listé ne sera modifié.</p>
      <button onClick={() => setPending(null)}>Annuler</button><button disabled={!pending.result.report.length} onClick={() => {
        if (signature(useStore.getState().getWorkspaceProject()) !== pending.signature) { setPending(null); setError('Le projet a changé. Ouvrez à nouveau l’aperçu.'); return; }
        execute(pending.originId, pending.command, true); setPending(null);
      }}>Appliquer aux scénarios listés</button>
    </div></div>}
  </section>;
}
