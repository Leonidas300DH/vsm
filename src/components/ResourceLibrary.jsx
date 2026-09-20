import { useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import useStore from '../store/useStore';
import { resourceKinds, referencedResources } from '../utils/resources';
import ToolIcon from './ToolIcon';
import { toolIcons, toolPresets } from '../utils/toolPresets';
import { resourceIcons } from '../utils/resourceIcons';

export default function ResourceLibrary({ kind, nodeId, onClose }) {
  const store = useStore();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const entries = store[kind];
  const node = store.nodes.find(n => n.id === nodeId);
  const field = resourceKinds[kind].field;
  const Icon = resourceIcons[kind];
  return <section className="resource-library nodrag nowheel" aria-label={`Bibliothèque ${resourceKinds[kind].label}`}>
    <header><Icon size={18}/><strong>{resourceKinds[kind].label}</strong>{onClose && <button onClick={onClose} aria-label="Fermer la bibliothèque"><X size={16}/></button>}</header>
    {node && <p>Rattacher à <strong>{node.data.label}</strong></p>}
    <input aria-label="Rechercher une ressource" placeholder="Rechercher…" value={query} onChange={e => setQuery(e.target.value)}/>
    <button className="library-create" onClick={() => setEditing({ name: '', description: '', team: '', url: '' })}><Plus size={14}/> Créer {kind === 'actors' ? 'un acteur' : kind === 'tools' ? 'un outil' : 'une base'}</button>
    {kind === 'tools' && !editing && <details className="tool-suggestions"><summary>Outils proposés pour démarrer</summary><div className="preset-grid">{toolPresets.map(preset=><button key={preset.name} onClick={()=>setEditing({...preset,url:''})}><ToolIcon name={preset.icon}/><span>{preset.name}</span><Plus size={12}/></button>)}</div></details>}
    {editing && <form className="resource-form" onSubmit={e => { e.preventDefault(); const id = store.saveResource(kind, { ...editing, name: editing.name.trim() }); if (node) store.attachResource(node.id, kind, id); setEditing(null); }}>
      <label>Nom<input required autoFocus value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}/></label>
      {kind === 'tools' && <fieldset className="icon-picker"><legend>Icône</legend>{toolIcons.map(([key,label])=><button type="button" key={key} aria-label={`Icône ${label}`} title={label} aria-pressed={(editing.icon || 'wrench')===key} onClick={()=>setEditing({...editing,icon:key})}><ToolIcon name={key}/><span>{label}</span></button>)}</fieldset>}
      <label>Description<textarea value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })}/></label>
      {kind === 'actors' && <><label>Équipe<input value={editing.team || ''} onChange={e => setEditing({ ...editing, team: e.target.value })}/></label><label>Périmètre<select value={editing.scope || 'internal'} onChange={e => setEditing({ ...editing, scope: e.target.value })}><option value="internal">Notre équipe</option><option value="external">Autre équipe / acteur externe</option></select></label></>}
      {kind !== 'actors' && <label>URL / référence<input value={editing.url || ''} onChange={e => setEditing({ ...editing, url: e.target.value })}/></label>}
      <div className="resource-actions"><button type="submit" disabled={!editing.name.trim()}>Enregistrer{node ? ' et rattacher' : ''}</button><button type="button" onClick={() => setEditing(null)}>Annuler</button></div>
    </form>}
    <div role="status">{message}</div>
    <div className="library-entries">{entries.filter(r => `${r.name} ${r.description || ''} ${r.team || ''}`.toLowerCase().includes(query.toLowerCase())).map(entry => {
      const attached = (node?.data[field] || []).includes(entry.id);
      const uses = referencedResources(store.nodes, kind, entry.id).length;
      return <article key={entry.id} className="library-entry" draggable={false} onDragStart={e => { e.dataTransfer.setData('application/vsm-resource', JSON.stringify({ kind, id: entry.id })); e.dataTransfer.effectAllowed = 'link'; }}>
        <div className="resource-entry-title">{kind === 'tools' && <ToolIcon name={entry.icon}/>}<strong>{entry.name}</strong></div>{entry.team && <small>{entry.team} · {entry.scope === 'external' ? 'Externe' : 'Notre équipe'}</small>}
        {entry.description && <p>{entry.description}</p>}{entry.url && <small>{entry.url}</small>}
        <small>{uses} étape{uses > 1 ? 's' : ''}</small>
        <div className="resource-actions">
          {node && <button onClick={() => attached ? store.detachResource(node.id, kind, entry.id) : store.attachResource(node.id, kind, entry.id)}>{attached ? 'Détacher' : 'Rattacher'}</button>}
          <button aria-label={`Modifier ${entry.name}`} onClick={() => setEditing(entry)}><Pencil size={13}/></button>
          <button aria-label={`Supprimer ${entry.name}`} onClick={() => { setMessage(store.deleteResource(kind, entry.id) ? '' : 'Détachez cette ressource de ses étapes avant de la supprimer.'); }}><Trash2 size={13}/></button>
        </div>
      </article>;
    })}</div>
    {!entries.length && <p>Créez votre première ressource. Elle sera réutilisable sur plusieurs étapes.</p>}
    {!node && <small>Pour rattacher une ressource, sélectionnez une étape puis ouvrez cette bibliothèque, ou utilisez le + sous l’étape.</small>}
  </section>;
}
