import { useCallback, useMemo, useRef, useState } from 'react';
import ReactFlow, { ReactFlowProvider, Background, Controls, useNodesInitialized, getNodesBounds, getViewportForBounds } from 'reactflow';
import { useEffect } from 'react';
import { X, Rows2, Columns2, Link, Unlink, Scan, ChevronDown, ChevronUp } from 'lucide-react';
import useStore from '../store/useStore';
import { GraphContext } from '../store/graphContext';
import { nodeTypes, edgeTypes } from './graphTypes';
import { calculateMetrics } from '../utils/calculations';
import { scenarioComparison, affectedNodes } from '../services/comparison';
import { displayNumber as fmt } from '../services/analysis';

const changeLabels = { ajout: 'Ajouté', suppression: 'Retiré', modification: 'Modifié' };
function Ready({ onReady }) {
  const initialized = useNodesInitialized();
  useEffect(() => { if (initialized) onReady(); }, [initialized, onReady]);
  return null;
}
function ComparisonMap({ scenario, changes, selected, onSelect, onInit, onMove, onReady, detailMode, orientation, theme }) {
  const graph = useMemo(() => calculateMetrics(scenario.nodes, scenario.edges), [scenario]);
  const context = useMemo(() => ({ ...graph, tools: scenario.tools || [], actors: scenario.actors || [], knowledge: scenario.knowledge || [], orientation, detailMode, readOnly: true, focus: null }), [graph, scenario, orientation, detailMode]);
  const nodes = useMemo(() => graph.nodes.map(node => {
    const change = changes.find(c => c.kind === 'nodes' && c.id === node.id) || changes.find(c => affectedNodes(c, scenario).includes(node.id));
    return { ...node, selected: selected.includes(node.id), draggable: false, connectable: false, className: change ? 'comparison-changed' : '',
      data: { ...node.data, comparisonBadge: change && changeLabels[change.type] } };
  }), [graph, changes, scenario, selected]);
  const edges = useMemo(() => graph.edges.map(edge => ({ ...edge, type: 'flow', selected: false, className: changes.some(c => c.kind === 'edges' && c.id === edge.id) ? 'comparison-changed' : '', markerEnd: { type: 'arrowclosed' } })), [graph, changes]);
  return <GraphContext.Provider value={context}><ReactFlowProvider><ReactFlow
    nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
    onInit={onInit} onMove={onMove} onNodeClick={(_, node) => onSelect(node.id)}
    nodesDraggable={false} nodesConnectable={false} edgesUpdatable={false} deleteKeyCode={null}
    selectionKeyCode={null} multiSelectionKeyCode={null} minZoom={0.02} maxZoom={2} fitView fitViewOptions={{ padding: .12 }}>
    <Ready onReady={onReady}/><Background color={theme === 'light' ? '#c4d1da' : '#2b404d'} gap={24}/><Controls showInteractive={false}/>
  </ReactFlow></ReactFlowProvider></GraphContext.Provider>;
}

export default function ScenarioComparison({ project, onClose, onLinkedEdit }) {
  const { orientation, detailMode, theme } = useStore();
  const available = project.scenarios.filter(s => !s.archived || s.id === project.actualScenarioId || s.id === project.activeScenarioId);
  const [leftId, setLeft] = useState(project.actualScenarioId);
  const [rightId, setRight] = useState(project.activeScenarioId !== project.actualScenarioId ? project.activeScenarioId : available.find(s => s.id !== project.actualScenarioId).id);
  const [split, setSplit] = useState(50);
  const closeButton = useRef(null);
  const [layout, setLayout] = useState('stacked'), [linked, setLinked] = useState(true), [details, setDetails] = useState(false), [selected, setSelected] = useState([]);
  const instances = useRef([]), panels = useRef([]), ready = useRef([false, false]);
  const a = available.find(s => s.id === leftId), b = available.find(s => s.id === rightId);
  const result = useMemo(() => scenarioComparison(project.scenarios.find(s => s.id === leftId), project.scenarios.find(s => s.id === rightId)), [project, leftId, rightId]);
  const fit = useCallback(() => {
    if (!instances.current[0] || !instances.current[1] || !panels.current[0] || !panels.current[1]) return;
    const all = instances.current.flatMap(i => i.getNodes());
    if (!all.length) return;
    const rect = getNodesBounds(all);
    const size = panels.current.map(p => p.getBoundingClientRect());
    const viewport = getViewportForBounds(rect, Math.min(...size.map(s => s.width)), Math.min(...size.map(s => s.height)), .02, 1, .15);
    instances.current.forEach(i => i.setViewport(viewport));
  }, []);
  const readyLeft = useCallback(() => { ready.current[0] = true; if (ready.current[1]) fit(); }, [fit]);
  const readyRight = useCallback(() => { ready.current[1] = true; if (ready.current[0]) fit(); }, [fit]);
  const move = (index, viewport) => {
    if (!linked) return;
    const other = instances.current[1 - index];
    if (!other) return;
    const current = other.getViewport();
    if (Math.abs(current.x - viewport.x) + Math.abs(current.y - viewport.y) + Math.abs(current.zoom - viewport.zoom) > .001) other.setViewport(viewport);
  };
  const focusNodes = ids => {
    setSelected(ids);
    const all = instances.current.flatMap(i => i?.getNodes().filter(n => ids.includes(n.id)) || []);
    if (!all.length) return;
    const bounds = getNodesBounds(all), size = panels.current.map(p => p.getBoundingClientRect());
    const viewport = getViewportForBounds(bounds, Math.min(...size.map(s => s.width)), Math.min(...size.map(s => s.height)), .02, .8, .3);
    instances.current.forEach(i => i.setViewport(viewport));
  };
  const changeSide = (side, id) => {
    if ((side === 0 && id === rightId) || (side === 1 && id === leftId)) ready.current = [false, false];
    else ready.current[side] = false;
    setSelected([]);
    if (side === 0) { setLeft(id); if (id === rightId) setRight(leftId); }
    else { setRight(id); if (id === leftId) setLeft(rightId); }
  };
  useEffect(() => {
    const previous = document.activeElement;
    closeButton.current?.focus();
    const escape = e => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); if (previous?.isConnected) previous.focus(); };
  }, [onClose]);
  return <section className="scenario-comparison" aria-label="Comparaison des scénarios" data-layout={layout}>
    <header className="comparison-toolbar">
      <strong>Comparer</strong><button onClick={onLinkedEdit}><Link size={15}/>Édition liée</button><span className="comparison-readonly">Lecture seule</span>
      <button title="Cartes superposées" aria-label="Cartes superposées" aria-pressed={layout === 'stacked'} onClick={() => { setLayout('stacked'); requestAnimationFrame(fit); }}><Rows2 size={16}/></button>
      <button title="Cartes côte à côte" aria-label="Cartes côte à côte" aria-pressed={layout === 'side'} onClick={() => { setLayout('side'); requestAnimationFrame(fit); }}><Columns2 size={16}/></button>
      <button aria-pressed={linked} onClick={() => { setLinked(!linked); if (!linked) fit(); }}>{linked ? <Link size={15}/> : <Unlink size={15}/>}<span>{linked ? 'Navigation liée' : 'Navigation libre'}</span></button>
      <button onClick={fit} title="Cadrer les deux cartes" aria-label="Cadrer les deux cartes"><Scan size={16}/></button>
      <button ref={closeButton} className="comparison-close" onClick={onClose}><X size={16}/>Fermer</button>
    </header>
    <div className="comparison-maps" style={layout === 'stacked' ? { gridTemplateRows: `${split}fr 6px ${100 - split}fr` } : { gridTemplateColumns: `${split}fr 6px ${100 - split}fr` }}>
      {[a, b].map((scenario, i) => <section className="comparison-pane" key={i} aria-label={`Carte ${i === 0 ? 'A' : 'B'}`}>
        <div className="comparison-pane-header"><b>{i === 0 ? 'A' : 'B'}</b><select aria-label={`Scénario ${i === 0 ? 'A' : 'B'}`} value={scenario.id} onChange={e => changeSide(i, e.target.value)}>{available.map(s => <option key={s.id} value={s.id}>{s.name}{s.id === project.actualScenarioId ? ' · Référence' : ''}</option>)}</select><span>{scenario.nodes.length} étapes</span></div>
        <div className="comparison-map" ref={el => { panels.current[i] = el; }}>
          <ComparisonMap key={scenario.id} scenario={scenario} changes={result.changes} selected={selected} onSelect={id => focusNodes([id])}
            onInit={instance => { instances.current[i] = instance; }} onMove={(_, viewport) => move(i, viewport)} onReady={i === 0 ? readyLeft : readyRight} detailMode={detailMode} orientation={orientation} theme={theme}/>
          {!scenario.nodes.length && <span className="comparison-empty">Carte vide</span>}
        </div>
      </section>)}
      <div className="comparison-divider" role="separator" tabIndex={0} aria-label="Redimensionner les cartes" aria-orientation={layout === 'stacked' ? 'horizontal' : 'vertical'} aria-valuenow={split} aria-valuemin={20} aria-valuemax={80}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          const box = e.currentTarget.parentElement.getBoundingClientRect();
          const value = layout === 'stacked' ? 100 * (e.clientY - box.top) / box.height : 100 * (e.clientX - box.left) / box.width;
          setSplit(Math.round(Math.max(20, Math.min(80, value))));
        }}
        onKeyDown={e => { if (['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.key)) { e.preventDefault(); setSplit(value => Math.max(20, Math.min(80, value + (['ArrowUp', 'ArrowLeft'].includes(e.key) ? -5 : 5)))); } }}/>

    </div>
    <div className="comparison-summary"><button aria-expanded={details} onClick={() => setDetails(!details)}>{details ? <ChevronDown size={15}/> : <ChevronUp size={15}/>} {result.changes.length} différence{result.changes.length === 1 ? '' : 's'} · Indicateurs et détails</button><span>Écarts B − A · cliquer une étape pour la retrouver dans les deux cartes</span></div>
    {details && <div className="comparison-details">
      <table><thead><tr><th>Indicateur</th><th>{a.name}</th><th>{b.name}</th><th>Écart</th><th>%</th></tr></thead><tbody>{result.metrics.map(m => <tr key={m.key}><th>{m.label}</th><td>{fmt(m.before)} min</td><td>{fmt(m.after)} min</td><td>{fmt(m.delta)} min</td><td>{m.percent == null ? '—' : `${fmt(m.percent)} %`}</td></tr>)}</tbody></table>
      <p>Charge sur la période du scénario ; délais par dossier pondérés selon les routages. Les données inconnues restent inconnues. Les capacités et hypothèses sont consultables dans l’Atelier de chaque onglet.</p>
      {result.changes.length === 0 ? <p>Aucune différence métier.</p> : <div className="comparison-change-list">{result.changes.map(c => <button key={`${c.kind}:${c.id}`} onClick={() => focusNodes([...new Set([...affectedNodes(c, a), ...affectedNodes(c, b)])])}><span className="change-badge">{changeLabels[c.type]}</span>{c.label}<small>{c.kind === 'nodes' ? 'Étape' : c.kind === 'edges' ? 'Connexion' : c.kind === 'tools' ? 'Outil' : c.kind === 'actors' ? 'Acteur' : 'Connaissance'}</small></button>)}</div>}
    </div>}
  </section>;
}
