import { useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { useGraphState } from '../store/graphContext';
import { resourceKinds, referencedResources } from '../utils/resources';
import { resolveToolBrand } from '../utils/toolBrands';
import ToolIcon from './ToolIcon';
import ToolLogoInput from './ToolLogoInput';
import { toolIcons, toolPresets, toolGroups, filterToolPresets, matchesToolQuery } from '../utils/toolPresets';
import { resourceIcons } from '../utils/resourceIcons';

export default function ResourceLibrary({ kind, nodeId, onClose }) {
  const store = useGraphState();
  const [query, setQuery] = useState('');
  const [toolGroup, setToolGroup] = useState('');
  const suggestions = filterToolPresets(query, toolGroup);
  const [editing, setEditing] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [message, setMessage] = useState('');
  const entries = store[kind];
  const node = store.nodes.find(n => n.id === nodeId);
  const field = resourceKinds[kind].field;
  const Icon = resourceIcons[kind];
  return <section className="resource-library nodrag nowheel" aria-label={`Bibliothèque ${resourceKinds[kind].label}`}>
    <header><Icon size={18}/><strong>{resourceKinds[kind].label}</strong>{onClose && <button onClick={onClose} aria-label="Fermer la bibliothèque"><X size={16}/></button>}</header>
    {node && <p>Rattacher à <strong>{node.data.label}</strong></p>}
    <input aria-label="Rechercher une ressource" placeholder="Rechercher…" value={query} onChange={e => { setQuery(e.target.value); setToolGroup(''); }}/>
    <button className="library-create" disabled={uploadingLogo} onClick={() => setEditing({ name: '', description: '', team: '', url: '' })}><Plus size={14}/> Créer {kind === 'actors' ? 'un acteur' : kind === 'tools' ? 'un outil' : 'une base'}</button>
    {kind === 'tools' && !editing && <details className="tool-suggestions" open={query.trim() ? true : undefined}>
      <summary>Outils proposés · {toolPresets.length}</summary>
      <nav className="tool-group-filter" aria-label="Catégories des outils proposés">
        {['', ...toolGroups].map(group => <button type="button" key={group} aria-pressed={toolGroup === group} onClick={() => setToolGroup(group)}>{group || 'Tous'}</button>)}
      </nav>
      <div className="preset-grid">{suggestions.map(preset => <button type="button" key={preset.name} title={preset.description} onClick={() => setEditing({name:preset.name, icon:preset.icon, description:preset.description, url:''})}>
        <ToolIcon name={preset.icon} toolName={preset.name}/><span>{preset.name}</span><Plus size={12}/>
      </button>)}</div>
      {!suggestions.length && <p role="status">Aucun outil proposé ne correspond à cette recherche.</p>}
    </details>}
    {editing && <form className="resource-form" onSubmit={e => { e.preventDefault(); if (uploadingLogo) return; try { const entry = { ...editing, name: editing.name.trim() }; if (node && store.saveAndAttachResource) store.saveAndAttachResource(kind, entry, node.id); else { const id = store.saveResource(kind, entry); if (node) store.attachResource(node.id, kind, id); } setEditing(null); setMessage(''); } catch (error) { setMessage(error.message || 'Enregistrement impossible. Votre fiche reste ouverte.'); } }}>
      <label>Nom<input required autoFocus value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}/></label>
      {kind === 'tools' && <ToolLogoInput key={editing.id || 'new'} tool={editing} onChange={logo => setEditing(current => ({...current, logo}))} onBusyChange={setUploadingLogo}/>}
      {kind === 'tools' && <fieldset className="icon-picker"><legend>Icône</legend>{toolIcons.map(([key,label])=><button type="button" key={key} aria-label={`Icône ${label}`} title={label} disabled={uploadingLogo} aria-pressed={!editing.logo && (resolveToolBrand(editing.icon,editing.name)?.id || editing.icon || 'wrench')===key} onClick={()=>setEditing({...editing,icon:key,logo:null})}><ToolIcon name={key}/><span>{label}</span></button>)}</fieldset>}
      <label>Description<textarea value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })}/></label>
      {kind === 'actors' && <><label>Équipe<input value={editing.team || ''} onChange={e => setEditing({ ...editing, team: e.target.value })}/></label><label>Périmètre<select value={editing.scope || 'internal'} onChange={e => setEditing({ ...editing, scope: e.target.value })}><option value="internal">Notre équipe</option><option value="external">Autre équipe / acteur externe</option></select></label></>}
      {kind !== 'actors' && <label>URL / référence<input value={editing.url || ''} onChange={e => setEditing({ ...editing, url: e.target.value })}/></label>}
      <div className="resource-actions"><button type="submit" disabled={!editing.name.trim() || uploadingLogo}>Enregistrer{node ? ' et rattacher' : ''}</button><button type="button" onClick={() => setEditing(null)}>Annuler</button></div>
    </form>}
    <div role="status">{message}</div>
    <div className="library-entries">{entries.filter(r => kind === 'tools' ? matchesToolQuery(r, query) : `${r.name} ${r.description || ''} ${r.team || ''}`.toLowerCase().includes(query.toLowerCase())).map(entry => {
      const attached = (node?.data[field] || []).includes(entry.id);
      const uses = referencedResources(store.nodes, kind, entry.id).length;
      return <article key={entry.id} className="library-entry" draggable={false} onDragStart={e => { e.dataTransfer.setData('application/vsm-resource', JSON.stringify({ kind, id: entry.id })); e.dataTransfer.effectAllowed = 'link'; }}>
        <div className="resource-entry-title">{kind === 'tools' && <ToolIcon name={entry.icon} toolName={entry.name} logo={entry.logo}/>}<strong>{entry.name}</strong></div>{entry.team && <small>{entry.team} · {entry.scope === 'external' ? 'Externe' : 'Notre équipe'}</small>}
        {entry.description && <p>{entry.description}</p>}{entry.url && <small>{entry.url}</small>}
        <small>{uses} étape{uses > 1 ? 's' : ''}</small>
        <div className="resource-actions">
          {node && <button onClick={() => attached ? store.detachResource(node.id, kind, entry.id) : store.attachResource(node.id, kind, entry.id)}>{attached ? 'Détacher' : 'Rattacher'}</button>}
          <button aria-label={`Modifier ${entry.name}`} disabled={uploadingLogo} onClick={() => setEditing(entry)}><Pencil size={13}/></button>
          <button aria-label={`Supprimer ${entry.name}`} onClick={() => { setMessage(store.deleteResource(kind, entry.id) ? '' : 'Détachez cette ressource de ses étapes avant de la supprimer.'); }}><Trash2 size={13}/></button>
        </div>
      </article>;
    })}</div>
    {!entries.length && <p>Créez votre première ressource. Elle sera réutilisable sur plusieurs étapes.</p>}
    {!node && <small>Pour rattacher une ressource, sélectionnez une étape puis ouvrez cette bibliothèque, ou utilisez le + sous l’étape.</small>}
  </section>;
}
