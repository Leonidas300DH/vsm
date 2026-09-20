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
import { assignLanes } from './utils/lanes';

const VIEW_LABELS = { flow: 'flux', tools: 'outils', actors: 'acteurs', teams: 'équipes' };

// v2: palette and analysis start hidden; the key changed so stored v1 values no longer apply.
function usePanelPreference(key, initial) {
  const storageKey = `vsm.panel.v2.${key}`;
  const [value, setValue] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey)); return typeof saved === 'boolean' ? saved : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Layout remains usable without storage. */ } }, [storageKey, value]);
  return [value, setValue];
}

function Workspace() {
  const [sidebar, setSidebar] = usePanelPreference('sidebar', false);
  const [properties, setProperties] = usePanelPreference('properties', false);
  const [analysis, setAnalysis] = usePanelPreference('analysis', false);
  const [notice, setNotice] = useState('');
  const { nodes, setGraph, setFileHandle, selectedNodeId, orientation, viewMode, setOrientation, setViewMode, lastDeletion, undoDeletion, dismissDeletion } = useStore();
  const deletionLabel = lastDeletion
    ? (lastDeletion.nodes.length
        ? `${lastDeletion.nodes.length > 1 ? `${lastDeletion.nodes.length} étapes supprimées` : `Étape « ${lastDeletion.nodes[0].data?.label || lastDeletion.nodes[0].id} » supprimée`}${lastDeletion.edges.length ? ` avec ${lastDeletion.edges.length} connexion${lastDeletion.edges.length > 1 ? 's' : ''}` : ''}.`
        : `${lastDeletion.edges.length} connexion${lastDeletion.edges.length > 1 ? 's' : ''} supprimée${lastDeletion.edges.length > 1 ? 's' : ''}.`)
    : '';
  const { fitView, getNodes } = useReactFlow();
  const frame = () => requestAnimationFrame(() => requestAnimationFrame(() => fitView({ padding: 0.15, duration: 0, minZoom: 0.1, maxZoom: 1 })));

  // One entry point for every re-layout: measured nodes (without lane bands) + current preferences.
  const applyLayout = (nextOrientation, nextView) => {
    const graphNodes = getNodes().filter(n => n.type !== 'lane');
    if (!graphNodes.length) return;
    const { tools, actors, edges: currentEdges } = useStore.getState();
    const grouping = nextView === 'flow' ? null : assignLanes(graphNodes, currentEdges, nextView, { tools, actors });
    const result = layoutGraph(graphNodes, currentEdges, { orientation: nextOrientation, lanes: grouping?.lanes, laneLabels: grouping?.labels });
    if (result.error) return setNotice(result.error);
    useStore.setState({ nodes: result.nodes, laneBands: result.bands });
    const direction = nextOrientation === 'vertical' ? 'de haut en bas' : 'de gauche à droite';
    if (nextView === 'flow') {
      setNotice(`Disposition ${direction} · branches parallèles et convergence en fin de flux.`);
    } else {
      const count = grouping.labels.length;
      const multi = grouping.multi.length
        ? ` · ${grouping.multi.length} étape${grouping.multi.length > 1 ? 's' : ''} avec plusieurs ${VIEW_LABELS[nextView]}, placée${grouping.multi.length > 1 ? 's' : ''} dans le premier couloir : ${grouping.multi.map(m => m.label).join(', ')}`
        : '';
      setNotice(`Vue par ${VIEW_LABELS[nextView]} · ${count} couloir${count > 1 ? 's' : ''} ${direction}${multi}`);
    }
    frame();
  };
  const arrange = () => applyLayout(orientation, viewMode);
  const toggleOrientation = () => { const next = orientation === 'vertical' ? 'horizontal' : 'vertical'; setOrientation(next); applyLayout(next, viewMode); };
  const changeView = (next) => { setViewMode(next); applyLayout(orientation, next); };
  const loadExample = () => {
    if (nodes.length && !window.confirm('Remplacer la carte actuelle par l’exemple ? Enregistrez votre travail avant de continuer.')) return;
    const example = createExample();
    useStore.getState().mergeLibraries(example);
    setGraph(example.nodes, example.edges, example.title);
    setFileHandle(null);
    setNotice('KYC fictif · 100 dossiers/jour · Routages et temps illustratifs · Aucune décision réelle.');
    requestAnimationFrame(() => requestAnimationFrame(() => applyLayout(orientation, viewMode)));
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
        <select className="toolbar-select" aria-label="Vue" value={viewMode} onChange={e => changeView(e.target.value)} disabled={!nodes.length}>
          <option value="flow">Vue : flux</option>
          <option value="tools">Vue : outils</option>
          <option value="actors">Vue : acteurs</option>
          <option value="teams">Vue : équipes</option>
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
    {notice && !lastDeletion && <div className="workspace-notice" role="status">{notice}<button aria-label="Fermer le message" onClick={() => setNotice('')}><X size={13} /></button></div>}
    <main className="workspace-main">
      {sidebar && <Sidebar collapsed={false} onToggle={() => setSidebar(false)} onExpand={() => setSidebar(true)} />}
      <section className="canvas-column" aria-label="Carte de processus">
        <div className="canvas-stage"><VSMCanvas onInspect={() => setProperties(true)} />
          {!nodes.length && <div className="empty-canvas"><span className="empty-symbol">◇</span><h2>Dessinez votre flux.</h2><p>Glissez une étape depuis la palette<br />ou explorez un parcours KYC complet.</p><button onClick={loadExample}>Explorer l’exemple <ArrowRight size={15} /></button></div>}
          <div className="canvas-caption">{orientation === 'vertical' ? 'HAUT → BAS' : 'GAUCHE → DROITE'} <span>Glisser pour explorer · Molette pour zoomer</span></div>
        </div>
        {analysis && <Timeline collapsed={false} onToggle={() => setAnalysis(false)} />}
      </section>
      <div className="inspector-shell" hidden={!properties}><PropertiesPanel onClose={() => setProperties(false)} /></div>
      {!properties && <button className="inspector-tab" aria-label="Ouvrir l’inspecteur" onClick={() => setProperties(true)}><PanelRight size={16} /><span>Inspecteur</span></button>}
    </main>
    <footer className="statusbar"><span><i /> ESPACE LOCAL</span><span>{selectedNodeId ? 'Étape sélectionnée' : 'Sélectionnez une étape ou une connexion pour la modifier'}</span><span>VSM / PROCESS STUDIO</span></footer>
  </div>;
}
export default function App() { return <ReactFlowProvider><Workspace /></ReactFlowProvider>; }
