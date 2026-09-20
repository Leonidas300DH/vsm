import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import useStore from '../store/useStore';
import { resourceKinds } from '../utils/resources';
import ToolIcon from './ToolIcon';
import ResourceLibrary from './ResourceLibrary';
import { resourceIcons } from '../utils/resourceIcons';
import { resourceMatchesFocus } from '../utils/focus';

export default function NodeResources({ id, data }) {
  const store = useStore();
  // Vertical reading: resources sit beside the card, ports on its right edge, satellites running rightwards.
  const side = useStore(s => s.orientation === 'vertical');
  const focus = useStore(s => s.focus);
  const [picker, setPicker] = useState(null);
  const modalRef = useRef(null);
  useEffect(() => {
    if (!picker) return;
    const previous = document.activeElement;
    modalRef.current?.querySelector('button')?.focus();
    return () => previous?.focus();
  }, [picker]);
  const onModalKey = e => {
    if (e.key === 'Escape') { e.stopPropagation(); setPicker(null); }
    if (e.key === 'Tab') {
      const fields = [...modalRef.current.querySelectorAll('button:not(:disabled),input,textarea,select')];
      const first = fields[0], last = fields.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  };
  return <>
    <div className="node-resources nodrag" onClick={e => e.stopPropagation()}>
      {Object.entries(resourceKinds).map(([kind, config]) => {
        const Icon = resourceIcons[kind];
        const ids = data[config.field] || [];
        return <div className="resource-branch" key={kind}>
          {ids.length > 0 && (side
            // Side layout: one straight wire at orb height, from the diamond through every orb (port 110px, satellites 100px each).
            ? <svg className="resource-wires" viewBox={`0 0 ${110 + ids.length * 100} 100`} preserveAspectRatio="none" aria-hidden="true">
                <path d={`M4 33.5 L${110 + (ids.length - 1) * 100 + 46.5} 33.5`} />
              </svg>
            : <svg className="resource-wires" viewBox={`0 0 100 ${32 + ids.length * 100}`} preserveAspectRatio="none" aria-hidden="true">
                {ids.map((resourceId, index) => <path key={resourceId} d={index === 0 ? 'M50 4 L50 55' : `M50 4 C2 35 2 ${index * 100 + 35} 50 ${index * 100 + 55}`} />)}
              </svg>)}
          <button className="resource-port" title={`Rattacher : ${config.label}`} onClick={() => setPicker(kind)}><span className="resource-diamond"/><span className="resource-port-label">{config.label}</span><Plus size={12}/></button>
          {(data[config.field] || []).map(resourceId => {
            const entry = store[kind].find(r => r.id === resourceId);
            const focused = resourceMatchesFocus(kind, resourceId, focus, { actors: store.actors });
            return <div className={`resource-satellite ${focused ? 'is-focused' : ''}`} key={resourceId}>
              <button className={`resource-orb ${focused ? 'is-focused' : ''}`} onClick={() => setPicker(kind)} title={entry?.description || entry?.name || resourceId}>{kind === 'tools' ? <ToolIcon name={entry?.icon} size={23}/> : <Icon size={21}/>}</button>
              <span>{entry?.name || `Référence : ${resourceId}`}</span>
              <button className="resource-detach" title={`Détacher ${entry?.name || resourceId}`} onClick={() => store.detachResource(id, kind, resourceId)}><X size={10}/></button>
            </div>;
          })}
        </div>;
      })}
    </div>
    {picker && createPortal(<div className="resource-modal-backdrop" onClick={() => setPicker(null)} onKeyDown={onModalKey}><div ref={modalRef} role="dialog" aria-modal="true" aria-label={`Rattacher ${resourceKinds[picker].label}`} className="resource-modal" onClick={e => e.stopPropagation()}><ResourceLibrary kind={picker} nodeId={id} onClose={() => setPicker(null)}/></div></div>, document.body)}
  </>;
}
