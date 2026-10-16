import { useState, useRef, useEffect } from 'react';
import { Plus, Copy, Pencil, Star, Archive, MoreHorizontal, Columns2, Play, Link } from 'lucide-react';
import useStore from '../store/useStore';
import { renameScenario, archiveScenario } from '../services/project';
import ToolbarPopover from './ToolbarPopover';
import useModalKeyboard from './useModalKeyboard';

export default function ScenarioTabs({ onCompare, onSwitch, onLinkedEdit }) {
  const s = useStore(), project = s.workspaceProject;
  const [dialog, setDialog] = useState(null), [name, setName] = useState(''), [source, setSource] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useModalKeyboard(Boolean(dialog), () => { if (!busy) setDialog(null); });
  const active = project.scenarios.find(x => x.id === project.activeScenarioId);
  const activeTab = useRef(null);
  useEffect(() => { activeTab.current?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [active.id]);
  const visible = project.scenarios.filter(x => !x.archived || x.id === project.actualScenarioId || x.id === project.activeScenarioId);
  const openCopy = (id = project.actualScenarioId) => {
    setSource(id); setName(`${project.scenarios.find(x => x.id === id).name} · copie`); setError(''); setDialog({ type: 'copy' });
  };
  const openRename = scenario => { setName(scenario.name); setError(''); setDialog({ type: 'rename', id: scenario.id }); };
  const activate = id => { onSwitch(); s.switchScenario(id); };
  const save = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (dialog.type === 'copy') await s.copyScenario(source, name);
      else s.editWorkspace(renameScenario(s.getWorkspaceProject(), dialog.id, name));
      onSwitch(); setDialog(null);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <>
    <footer className="scenario-bar" aria-label="Scénarios du projet">
      <div role="tablist" aria-label="Scénarios" className="scenario-tabs">
        {visible.map((scenario, index) => <button ref={scenario.id === active.id ? activeTab : undefined} key={scenario.id} role="tab" aria-selected={scenario.id === active.id}
          tabIndex={scenario.id === active.id ? 0 : -1} title={`${scenario.name}${scenario.id === project.actualScenarioId ? ' · Référence' : ''} · Double-cliquer pour renommer`}
          onClick={() => activate(scenario.id)} onDoubleClick={() => openRename(scenario)}
          onKeyDown={e => {
            let next;
            if (e.key === 'ArrowRight') next = (index + 1) % visible.length;
            if (e.key === 'ArrowLeft') next = (index - 1 + visible.length) % visible.length;
            if (e.key === 'Home') next = 0;
            if (e.key === 'End') next = visible.length - 1;
            if (next !== undefined) { e.preventDefault(); e.currentTarget.parentElement.children[next].focus(); activate(visible[next].id); }
            if (e.key === 'F2') { e.preventDefault(); openRename(scenario); }
          }}>
          {scenario.id === project.actualScenarioId && <Star size={12} aria-label="Référence" />}<span>{scenario.name}</span>
        </button>)}
      </div>
      <button className="scenario-add" aria-label="Créer un onglet" title="Créer une copie de la référence" onClick={() => openCopy()}><Plus size={17} /></button>

      <div className="scenario-bar-actions">
        <button onClick={() => { onSwitch(); useStore.setState({ atelierTab: 'simulation' }); }}><Play size={14}/><span>Simuler</span></button>
        <button onClick={onLinkedEdit} disabled={visible.length < 2} title="Éditer le maître et ses enfants ensemble"><Link size={15}/><span>Édition liée</span></button>
        <button onClick={onCompare} disabled={visible.length < 2} title={visible.length < 2 ? 'Créez un deuxième onglet pour comparer' : 'Comparer deux scénarios'}><Columns2 size={15}/><span>Comparer</span></button>
      </div>
      <ToolbarPopover label="Actions de l’onglet" icon={<MoreHorizontal size={17}/>} iconOnly align="right">
        {close => <>
          <span className="menu-section-label">{active.name}</span>
          <button onClick={() => { close(); openRename(active); }}><Pencil size={14}/>Renommer</button>
          <button onClick={() => { close(); openCopy(active.id); }}><Copy size={14}/>Dupliquer cet onglet</button>
          <button disabled={active.id === project.actualScenarioId} onClick={() => { close(); s.editWorkspace({ ...s.getWorkspaceProject(), actualScenarioId: active.id }); }}><Star size={14}/>Définir comme référence</button>
          <button disabled={active.id === project.actualScenarioId} onClick={() => { close(); s.editWorkspace(archiveScenario(s.getWorkspaceProject(), active.id)); onSwitch(); }}><Archive size={14}/>Archiver cet onglet</button>
          {project.scenarios.some(x => x.archived) && <span className="menu-section-label">Restaurer un onglet archivé</span>}
          {project.scenarios.filter(x => x.archived).map(x => <button key={x.id} onClick={() => { close(); s.editWorkspace(archiveScenario(s.getWorkspaceProject(), x.id, false)); activate(x.id); }}>{x.name}</button>)}
        </>}
      </ToolbarPopover>
    </footer>
    {dialog && <div className="studio-backdrop"><form className="studio-dialog scenario-dialog" role="dialog" aria-modal="true" aria-label={dialog.type === 'copy' ? 'Créer un onglet' : 'Renommer l’onglet'} onSubmit={save}>
      <header><h2>{dialog.type === 'copy' ? 'Créer un onglet' : 'Renommer l’onglet'}</h2><button type="button" aria-label="Fermer" disabled={busy} onClick={() => setDialog(null)}>×</button></header>
      <label>Nom de l’onglet<input value={name} onChange={e => setName(e.target.value)} required maxLength={120}/></label>
      {dialog.type === 'copy' && <><label>Copier depuis<select value={source} onChange={e => setSource(e.target.value)}>{project.scenarios.map(x => <option key={x.id} value={x.id}>{x.name}{x.id === project.actualScenarioId ? ' · Référence' : ''}{x.archived ? ' · Archivé' : ''}</option>)}</select></label><p>La carte, les mesures et les ressources sont copiées. Chaque onglet évolue ensuite indépendamment.</p></>}
      {error && <p role="alert">{error}</p>}
      <div className="scenario-dialog-actions"><button type="button" disabled={busy} onClick={() => setDialog(null)}>Annuler</button><button type="submit" disabled={busy || !name.trim()}>{busy ? 'Enregistrement…' : dialog.type === 'copy' ? 'Créer la copie' : 'Renommer'}</button></div>
    </form></div>}
  </>;
}
