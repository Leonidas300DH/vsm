import { useState, useEffect } from 'react';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import { PanelLeft, PanelRight, ChartNoAxesCombined, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, Columns3, Scan, Settings2, ArrowRight, X, Sun, Moon } from 'lucide-react';
import Sidebar from './components/Sidebar';
import PropertiesPanel from './components/PropertiesPanel';
import Timeline from './components/Timeline';
import VSMCanvas from './components/VSMCanvas';
import ToolbarPopover from './components/ToolbarPopover';
import useModalKeyboard from './components/useModalKeyboard.js';
import WorkspaceTools from './components/WorkspaceTools';
import useStore from './store/useStore';
import { createExample } from './data/example';
import { proposeLayout } from './services/placement';
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
  const [layoutPreview,setLayoutPreview]=useState(null);
  useModalKeyboard(Boolean(layoutPreview),()=>setLayoutPreview(null));
  const { nodes, setFileHandle, selectedNodeId, orientation, setOrientation, lastDeletion, undoDeletion, dismissDeletion, tools, actors, focus, setFocus, theme, setTheme } = useStore();
  const { fitView, getNodes, getZoom } = useReactFlow();
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
  const applyLayout = (nextOrientation, preview=false) => {
    const zoom=getZoom();
    const graphNodes = getNodes().map(n=>{
      const element=document.querySelector(`.react-flow__node[data-id="${CSS.escape(n.id)}"]`);
      const source=element?.querySelector('.react-flow__handle.source'),target=element?.querySelector('.react-flow__handle.target');
      if(!element||!source||!target)return n;
      const box=element.getBoundingClientRect();
      const offset=port=>{const rect=port.getBoundingClientRect();return {x:(rect.x+rect.width/2-box.x)/zoom,y:(rect.y+rect.height/2-box.y)/zoom};};
      return {...n,width:box.width/zoom,height:box.height/zoom,layoutMetrics:{sourceOffset:offset(source),targetOffset:offset(target)}};
    });
    if (!graphNodes.length) return;
    const result = proposeLayout(graphNodes, useStore.getState().edges, { orientation: nextOrientation, sizes:useStore.getState().edgeLabelSizes });
    if (result.error) return setNotice(result.error+(result.conflicts?.length?" Éléments : "+[...new Set(result.conflicts)].map(id=>graphNodes.find(n=>n.id===id)?.data.label||id).join(", "):""));
    if(preview){setLayoutPreview(result);return;}
    useStore.setState({ nodes: result.nodes });
    setNotice(`Disposition ${nextOrientation === 'vertical' ? 'de haut en bas' : 'de gauche à droite'} · branches parallèles et convergence en fin de flux.`);
    frame();
  };
  const arrange = () => applyLayout(orientation,true);
  // Cards change shape with the orientation (resources below vs. beside): lay out after they are re-measured.
  const toggleOrientation = () => {
    const next = orientation === 'vertical' ? 'horizontal' : 'vertical';
    setOrientation(next);
    requestAnimationFrame(() => requestAnimationFrame(() => applyLayout(next)));
  };
  const loadExample = async () => {
    if (nodes.length && !window.confirm('Remplacer la carte actuelle par l’exemple ? Enregistrez votre travail avant de continuer.')) return;
    const example = createExample();
    await useStore.getState().replaceWorkspace(example);
    setFileHandle(null);
    setFocus(null);
    setNotice('KYC fictif · 100 dossiers/jour · Routages et temps illustratifs · Aucune décision réelle.');
    requestAnimationFrame(() => requestAnimationFrame(() => applyLayout(orientation)));
  };
  return <div className="workspace" data-detail={useStore.getState().detailMode}>
    {useStore.getState().saveStatus==='loading'&&<div className="studio-backdrop" role="status">Récupération de votre projet local…</div>}
    <WorkspaceTools onExample={loadExample} onArrange={arrange} onInspect={(id,diagnostic)=>{const state=useStore.getState();useStore.setState({selectedNodeId:state.nodes.some(n=>n.id===id)?id:null,selectedStepId:id,selectedItemId:null,nodes:state.nodes.map(n=>({...n,selected:n.id===id})),edges:state.edges.map(e=>({...e,selected:e.id===id})),inspectionDiagnostic:diagnostic});setProperties(true);}}>
      <button onClick={arrange} disabled={!nodes.length}><Columns3 size={15} /> Aligner</button>
      <button onClick={frame} title="Afficher toute la carte"><Scan size={15} /> Vue globale</button>
      {selectedNodeId && <button onClick={() => fitView({ nodes:[{id:selectedNodeId}], padding:0.5, maxZoom:1, duration:200 })}>Centrer l’étape</button>}
      <div className="view-controls">
        <ToolbarPopover label="Affichage" icon={<Settings2 size={15} />} align="right" active={Boolean(focus)}>
          <span className="menu-section-label">Disposition</span>
          <button onClick={toggleOrientation} disabled={!nodes.length} aria-label="Basculer l’orientation">
            {orientation === 'vertical' ? <AlignVerticalSpaceAround size={16} /> : <AlignHorizontalSpaceAround size={16} />} Lecture {orientation === 'vertical' ? 'verticale' : 'horizontale'}
          </button>
          <label className="view-focus">Mettre en évidence
            <select aria-label="Focus" value={focusValue} onChange={e => changeFocus(e.target.value)} disabled={!nodes.length}>
              <option value="">Aucun focus</option>
              {options.tools.length > 0 && <optgroup label="Outils">{options.tools.map(o => <option key={`tool:${o.id}`} value={`tool:${o.id}`}>{o.label}</option>)}</optgroup>}
              {options.actors.length > 0 && <optgroup label="Acteurs">{options.actors.map(o => <option key={`actor:${o.id}`} value={`actor:${o.id}`}>{o.label}</option>)}</optgroup>}
              {options.teams.length > 0 && <optgroup label="Équipes">{options.teams.map(o => <option key={`team:${o.id}`} value={`team:${o.id}`}>{o.label}</option>)}</optgroup>}
            </select>
          </label>
          <div className="menu-separator" />
          <span className="menu-section-label">Panneaux</span>
          <button aria-label="Palette" aria-pressed={sidebar} onClick={() => setSidebar(!sidebar)}><PanelLeft size={16} />Palette<span className="panel-state">{sidebar ? 'Visible' : 'Repliée'}</span></button>
          <button aria-label="Analyse" aria-pressed={analysis} onClick={() => setAnalysis(!analysis)}><ChartNoAxesCombined size={16} />Analyse<span className="panel-state">{analysis ? 'Visible' : 'Repliée'}</span></button>
          <button aria-label="Inspecteur" aria-pressed={properties} onClick={() => setProperties(!properties)}><PanelRight size={16} />Inspecteur<span className="panel-state">{properties ? 'Visible' : 'Replié'}</span></button>
          <div className="menu-separator" />
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}{theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair'}</button>
        </ToolbarPopover>
      </div>
    </WorkspaceTools>
    {layoutPreview&&<div className="studio-backdrop"><section className="studio-dialog" role="dialog" aria-label="Aperçu du placement"><h2>Proposition de placement</h2><p>{layoutPreview.nodes.length} étapes · aucun chevauchement détecté · {Math.round(layoutPreview.elapsedMs)} ms. Appliquer reste annulable.</p><svg viewBox={`${Math.min(...layoutPreview.nodes.map(n=>n.position.x))-30} ${Math.min(...layoutPreview.nodes.map(n=>n.position.y))-30} ${Math.max(...layoutPreview.nodes.map(n=>n.position.x))-Math.min(...layoutPreview.nodes.map(n=>n.position.x))+400} ${Math.max(...layoutPreview.nodes.map(n=>n.position.y))-Math.min(...layoutPreview.nodes.map(n=>n.position.y))+550}`} style={{width:'100%',height:250}}>{layoutPreview.nodes.map(n=><g key={n.id}><rect x={n.position.x} y={n.position.y} width={n.width||300} height={n.height||300} fill="none" stroke="#8fbfd1" strokeWidth="8"/><text x={n.position.x} y={n.position.y+40} fill="currentColor" fontSize="30">{n.data.label}</text></g>)}</svg><div className="studio-row"><button onClick={()=>{useStore.setState({nodes:layoutPreview.nodes});setLayoutPreview(null);frame();}}>Appliquer le placement</button><button onClick={()=>setLayoutPreview(null)}>Conserver la carte</button></div></section></div>}
    {lastDeletion && <div className="workspace-notice is-undo" role="status">{deletionLabel}<button className="notice-action" onClick={undoDeletion}>Annuler</button><button aria-label="Fermer le message" onClick={dismissDeletion}><X size={13} /></button></div>}
    {focus && !lastDeletion && <div className="workspace-notice is-focus" role="status">{FOCUS_KIND_LABEL[focus.kind]} « {focus.label} » · {focusCount} étape{focusCount > 1 ? 's' : ''} concernée{focusCount > 1 ? 's' : ''} · le reste est estompé<button className="notice-action" onClick={() => setFocus(null)}>Retirer le focus</button></div>}
    {notice && !lastDeletion && !focus && <div className="workspace-notice" role="status">{notice}<button aria-label="Fermer le message" onClick={() => setNotice('')}><X size={13} /></button></div>}
    <main className="workspace-main">
      <Sidebar collapsed={!sidebar} onToggle={() => setSidebar(!sidebar)} onExpand={() => setSidebar(true)} />
      <section className="canvas-column" aria-label="Carte de processus">
        <div className="canvas-stage"><VSMCanvas onInspect={() => {setProperties(true);useStore.setState({inspectionDiagnostic:null});}} />
          {!nodes.length && <div className="empty-canvas"><span className="empty-symbol">◇</span><h2>Dessinez votre flux.</h2><p>Glissez une étape depuis la palette<br />ou explorez un parcours KYC complet.</p><button onClick={loadExample}>Explorer l’exemple <ArrowRight size={15} /></button></div>}
          <div className="canvas-caption">{orientation === 'vertical' ? 'HAUT → BAS' : 'GAUCHE → DROITE'} <span>Glisser pour explorer · Molette pour zoomer</span></div>
        </div>
        <Timeline collapsed={!analysis} onToggle={() => setAnalysis(!analysis)} />
      </section>
      <div className="inspector-shell" hidden={!properties}><>{useStore.getState().inspectionDiagnostic&&<div className="inspection-diagnostic"><strong>{useStore.getState().inspectionDiagnostic.message}</strong><p>{useStore.getState().inspectionDiagnostic.formula}</p></div>}<PropertiesPanel onClose={() => setProperties(false)} /></></div>
      {!properties && <button className="inspector-tab" aria-label="Ouvrir l’inspecteur" onClick={() => setProperties(true)}><PanelRight size={16} /><span>Inspecteur</span></button>}
    </main>
    <footer className="statusbar"><span><i /> ESPACE LOCAL</span><span>{selectedNodeId ? 'Étape sélectionnée' : 'Sélectionnez une étape ou une connexion pour la modifier'}</span><span>VSM / PROCESS STUDIO</span></footer>
  </div>;
}
export default function App() { return <ReactFlowProvider><Workspace /></ReactFlowProvider>; }
