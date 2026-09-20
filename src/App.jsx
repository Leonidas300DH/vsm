import { useState, useEffect } from 'react';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import { PanelLeft, PanelRight, ChartNoAxesCombined, AlignHorizontalSpaceAround, Scan, FlaskConical, ArrowRight, X } from 'lucide-react';
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import Timeline from './components/Timeline';
import VSMCanvas from './components/VSMCanvas';
import Header from './components/Header';
import useStore from './store/useStore';
import { createExample } from './data/example';
import { horizontalLayout } from './utils/layout';

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
  const { nodes, edges, setGraph, setFileHandle, selectedNodeId } = useStore();
  const { fitView, getNodes } = useReactFlow();
  const frame = () => requestAnimationFrame(() => requestAnimationFrame(() => fitView({ padding: 0.15, duration: 0, minZoom: 0.1, maxZoom: 1 })));
  const loadExample = () => {
    if (nodes.length && !window.confirm('Remplacer la carte actuelle par l’exemple ? Enregistrez votre travail avant de continuer.')) return;
    const example = createExample();
    useStore.getState().mergeLibraries(example);
    setGraph(example.nodes, example.edges, example.title);
    setFileHandle(null);
    setNotice('KYC fictif · 100 dossiers/jour · Routages et temps illustratifs · Aucune décision réelle.');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const result = horizontalLayout(getNodes(), useStore.getState().edges);
      if (result.nodes) useStore.setState({ nodes: result.nodes });
      frame();
    }));
  };
  const arrange = () => {
    const result = horizontalLayout(getNodes(), edges);
    if (result.error) return setNotice(result.error);
    useStore.setState({ nodes: result.nodes });
    setNotice('Disposition de gauche à droite · branches parallèles et convergence à droite.');
    frame();
  };
  return <div className="workspace">
    <Header>
    <div className="workspace-toolbar">
      <div className="toolbar-group">
        <button onClick={loadExample}><FlaskConical size={14} /> Exemple</button>
        <button onClick={arrange} disabled={!nodes.length}><AlignHorizontalSpaceAround size={14} /> Aligner</button>
        <button onClick={frame}><Scan size={14} /> Vue globale</button>
        {selectedNodeId && <button onClick={() => fitView({ nodes:[{id:selectedNodeId}], padding:0.5, maxZoom:1, duration:200 })}>Centrer l’étape</button>}
        <span className="toolbar-divider" />
        <button aria-label="Palette" aria-pressed={sidebar} onClick={() => setSidebar(!sidebar)}><PanelLeft size={16} /></button>
        <button aria-label="Analyse" aria-pressed={analysis} onClick={() => setAnalysis(!analysis)}><ChartNoAxesCombined size={16} /></button>
        <button aria-label="Inspecteur" aria-pressed={properties} onClick={() => setProperties(!properties)}><PanelRight size={16} /></button>
      </div>
    </div>
    </Header>
    {notice && <div className="workspace-notice" role="status">{notice}<button aria-label="Fermer le message" onClick={() => setNotice('')}><X size={13} /></button></div>}
    <main className="workspace-main">
      {sidebar && <Sidebar collapsed={false} onToggle={() => setSidebar(false)} onExpand={() => setSidebar(true)} />}
      <section className="canvas-column" aria-label="Carte de processus">
        <div className="canvas-stage"><VSMCanvas onInspect={() => setProperties(true)} />
          {!nodes.length && <div className="empty-canvas"><span className="empty-symbol">◇</span><h2>Dessinez votre flux.</h2><p>Glissez une étape depuis la palette<br />ou explorez un parcours KYC complet.</p><button onClick={loadExample}>Explorer l’exemple <ArrowRight size={15} /></button></div>}
          <div className="canvas-caption">GAUCHE → DROITE <span>Glisser pour explorer · Molette pour zoomer</span></div>
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
