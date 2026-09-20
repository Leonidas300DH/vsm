import { useState, useEffect } from 'react';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import { PanelLeft, PanelRight, ChartNoAxesCombined, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, Columns3, Scan, FlaskConical, ArrowRight, X } from 'lucide-react';
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import Timeline from './components/Timeline';
import VSMCanvas from './components/VSMCanvas';
import Header from './components/Header';
import useStore from './store/useStore';
import { createExample } from './data/example';
import { layoutGraph } from './utils/layout';
import { focusOptions, focusedNodeIds } from './utils/focus';

// v2: palette and analysis start collapsed (thin rail with a handle); the key changed so stored v1 values no longer apply.
function usePanelPreference(key, initial) {
  const storageKey = `vsm.panel.v2.${key}`;
  const [value, setValue] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey)); return typeof saved === 'boolean' ? saved : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Layout remains usable without storage. */ } }, [storageKey, value]);
  return [value, setValue];
}

const FOCUS_KIND_LABEL = { tool: 'Outil', actor: 'Acteur', team: 'Équipe' };

function Workspace() {
  const [sidebar, setSidebar] = usePanelPreference('sidebar', false);
  const [properties, setProperties] = usePanelPreference('properties', false);
  const [analysis, setAnalysis] = usePanelPreference('analysis', false);
  const [notice, setNotice] = useState('');
  const { nodes, setGraph, setFileHandle, selectedNodeId, orientation, setOrientation, lastDeletion, undoDeletion, dismissDeletion, tools, actors, focus, setFocus } = useStore();
  const { fitView, getNodes } = useReactFlow();
  const frame = () => requestAnimationFrame(() => requestAnimationFrame(() => fitView({ padding: 0.15, duration: 0, minZoom: 0.1, maxZoom: 1 })));

  const deletionLabel = lastDeletion
    ? (lastDeletion.nodes.length
        ? `${lastDeletion.nodes.length > 1 ? `${lastDeletion.nodes.length} étapes supprimées` : `Étape « ${lastDeletion.nodes[0].data?.label || lastDeletion.nodes[0].id} » supprimée`}${lastDeletion.edges.length ? ` avec ${lastDeletion.edges.length} connexion${lastDeletion.edges.length > 1 ? 's' : ''}` : ''}.`
        : `${lastDeletion.edges.length} connexion${lastDeletion.edges.length > 1 ? 's' : ''} supprimée${lastDeletion.edges.length > 1 ? 's' : ''}.`)
    : '';

  // Focus picker: tools, internal actors, external teams. Value encodes kind and id.
  const options = focusOptions({ tools, actors });
  const focusValue = focus ? `${focus.kind}:${focus.id}` : '';
  const focusCount = focus ? focusedNodeIds(nodes, focus, { actors }).size : 0;
  const changeFocus = (value) => {
    if (!value) return setFocus(null);
    const kind = value.slice(0, value.indexOf(':'));
    const id = value.slice(value.indexOf(':') + 1);
    const option = [...options.tools, ...options.actors, ...options.teams].find(o => o.kind === kind && o.id === id);
    setFocus(option ? { kind, id, label: option.label } : null);
  };

  // One entry point for every re-layout: measured nodes + current orientation.
  const applyLayout = (nextOrientation) => {
    const graphNodes = getNodes();
    if (!graphNodes.length) return;
    const result = layoutGraph(graphNodes, useStore.getState().edges, { orientation: nextOrientation });
    if (result.error) return setNotice(result.error);
    useStore.setState({ nodes: result.nodes });
    setNotice(`Disposition ${nextOrientation === 'vertical' ? 'de haut en bas' : 'de gauche à droite'} · branches parallèles et convergence en fin de flux.`);
    frame();
  };
  const arrange = () => applyLayout(orientation);
  // Cards change shape with the orientation (resources below vs. beside): lay out after they are re-measured.
  const toggleOrientation = () => {
    const next = orientation === 'vertical' ? 'horizontal' : 'vertical';
    setOrientation(next);
    requestAnimationFrame(() => requestAnimationFrame(() => applyLayout(next)));
  };
  const loadExample = () => {
    if (nodes.length && !window.confirm('Remplacer la carte actuelle par l’exemple ? Enregistrez votre travail avant de continuer.')) return;
    const example = createExample();
    useStore.getState().mergeLibraries(example);
    setGraph(example.nodes, example.edges, example.title);
    setFileHandle(null);
    setFocus(null);
    setNotice('KYC fictif · 100 dossiers/jour · Routages et temps illustratifs · Aucune décision réelle.');
    requestAnimationFrame(() => requestAnimationFrame(() => applyLayout(orientation)));
  };
  return <div className="workspace">
    <Header>
    <div className="workspace-toolbar">
      <div className="toolbar-group">
        <button onClick={loadExample}><FlaskConical size={14} /> Exemple</button>
        <button onClick={arrange} disabled={!nodes.length}><Columns3 size={14} /> Aligner</button>
        <button onClick={toggleOrientation} disabled={!nodes.length} aria-label="Basculer l’orientation" title="Basculer entre lecture horizontale et verticale">
          {orientation === 'vertical' ? <AlignVerticalSpaceAround size={14} /> : <AlignHorizontalSpaceAround size={14} />} {orientation === 'vertical' ? 'Vertical' : 'Horizontal'}
        </button>
        <select className="toolbar-select" aria-label="Focus" title="Mettre en évidence les étapes qui utilisent un outil, un acteur ou une équipe" value={focusValue} onChange={e => changeFocus(e.target.value)} disabled={!nodes.length}>
          <option value="">Focus : aucun</option>
          {options.tools.length > 0 && <optgroup label="Outils">{options.tools.map(o => <option key={`tool:${o.id}`} value={`tool:${o.id}`}>{o.label}</option>)}</optgroup>}
          {options.actors.length > 0 && <optgroup label="Acteurs">{options.actors.map(o => <option key={`actor:${o.id}`} value={`actor:${o.id}`}>{o.label}</option>)}</optgroup>}
          {options.teams.length > 0 && <optgroup label="Équipes">{options.teams.map(o => <option key={`team:${o.id}`} value={`team:${o.id}`}>{o.label}</option>)}</optgroup>}
        </select>
        <button onClick={frame}><Scan size={14} /> Vue globale</button>
        {selectedNodeId && <button onClick={() => fitView({ nodes:[{id:selectedNodeId}], padding:0.5, maxZoom:1, duration:200 })}>Centrer l’étape</button>}
        <span className="toolbar-divider" />
        <button aria-label="Palette" aria-pressed={sidebar} onClick={() => setSidebar(!sidebar)}><PanelLeft size={16} /></button>
        <button aria-label="Analyse" aria-pressed={analysis} onClick={() => setAnalysis(!analysis)}><ChartNoAxesCombined size={16} /></button>
        <button aria-label="Inspecteur" aria-pressed={properties} onClick={() => setProperties(!properties)}><PanelRight size={16} /></button>
      </div>
    </div>
    </Header>
    {lastDeletion && <div className="workspace-notice is-undo" role="status">{deletionLabel}<button className="notice-action" onClick={undoDeletion}>Annuler</button><button aria-label="Fermer le message" onClick={dismissDeletion}><X size={13} /></button></div>}
    {focus && !lastDeletion && <div className="workspace-notice is-focus" role="status">{FOCUS_KIND_LABEL[focus.kind]} « {focus.label} » · {focusCount} étape{focusCount > 1 ? 's' : ''} concernée{focusCount > 1 ? 's' : ''} · le reste est estompé<button className="notice-action" onClick={() => setFocus(null)}>Retirer le focus</button></div>}
    {notice && !lastDeletion && !focus && <div className="workspace-notice" role="status">{notice}<button aria-label="Fermer le message" onClick={() => setNotice('')}><X size={13} /></button></div>}
    <main className="workspace-main">
      <Sidebar collapsed={!sidebar} onToggle={() => setSidebar(!sidebar)} onExpand={() => setSidebar(true)} />
      <section className="canvas-column" aria-label="Carte de processus">
        <div className="canvas-stage"><VSMCanvas onInspect={() => setProperties(true)} />
          {!nodes.length && <div className="empty-canvas"><span className="empty-symbol">◇</span><h2>Dessinez votre flux.</h2><p>Glissez une étape depuis la palette<br />ou explorez un parcours KYC complet.</p><button onClick={loadExample}>Explorer l’exemple <ArrowRight size={15} /></button></div>}
          <div className="canvas-caption">{orientation === 'vertical' ? 'HAUT → BAS' : 'GAUCHE → DROITE'} <span>Glisser pour explorer · Molette pour zoomer</span></div>
        </div>
        <Timeline collapsed={!analysis} onToggle={() => setAnalysis(!analysis)} />
      </section>
      <div className="inspector-shell" hidden={!properties}><PropertiesPanel onClose={() => setProperties(false)} /></div>
      {!properties && <button className="inspector-tab" aria-label="Ouvrir l’inspecteur" onClick={() => setProperties(true)}><PanelRight size={16} /><span>Inspecteur</span></button>}
    </main>
    <footer className="statusbar"><span><i /> ESPACE LOCAL</span><span>{selectedNodeId ? 'Étape sélectionnée' : 'Sélectionnez une étape ou une connexion pour la modifier'}</span><span>VSM / PROCESS STUDIO</span></footer>
  </div>;
}
export default function App() { return <ReactFlowProvider><Workspace /></ReactFlowProvider>; }
