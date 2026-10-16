import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function ToolbarPopover({ label, icon, children, align = 'left', active = false, iconOnly = false }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null), trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
    const escape = event => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const close = () => setOpen(false);
  return <div className="toolbar-popover" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} className={`toolbar-menu-trigger${active ? ' is-active' : ''}`} aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen(!open)}>
      {icon}{!iconOnly && <><span className="menu-trigger-label">{label}</span><ChevronDown size={13} /></>}
    </button>
    {open && <div className={`toolbar-popover-content align-${align}`} role="region" aria-label={label}>
      {typeof children === 'function' ? children(close) : children}
    </div>}
  </div>;
}
