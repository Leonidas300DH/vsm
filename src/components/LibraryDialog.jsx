import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
export default function LibraryDialog({ title, onClose, children }) {
  const ref=useRef(null);
  useEffect(()=>{const dialog=ref.current;dialog.showModal();return ()=>dialog.close();},[]);
  return createPortal(<dialog ref={ref} aria-label={title} className="library-dialog" onCancel={onClose} onClick={e=>{if(e.target===ref.current) onClose();}}>
    <div className="library-dialog-body"><header className="library-dialog-heading"><h2>{title}</h2><button aria-label="Fermer la fenêtre" onClick={onClose}><X size={20}/></button></header>{children}</div>
  </dialog>,document.body);
}
