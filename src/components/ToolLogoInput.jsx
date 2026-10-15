import { useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { importToolLogo, isCustomLogo } from '../utils/customLogo';
import ToolIcon from './ToolIcon';

export default function ToolLogoInput({ tool, onChange, onBusyChange }) {
  const input = useRef(null);
  const request = useRef(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { request.current++; onBusyChange(false); }, [onBusyChange]);
  const hasLogo = isCustomLogo(tool.logo);
  const upload = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const current = ++request.current;
    setError(''); setBusy(true); onBusyChange(true);
    try {
      const logo = await importToolLogo(file);
      if (current === request.current) onChange(logo);
    } catch (cause) {
      if (current === request.current) setError(cause.message || 'Impossible de lire ce logo.');
    } finally {
      if (current === request.current) { setBusy(false); onBusyChange(false); }
    }
  };
  return <div className="custom-tool-logo">
    <div className="custom-tool-logo-preview"><ToolIcon name={tool.icon} toolName={tool.name} logo={tool.logo} size={44}/></div>
    <div className="custom-tool-logo-controls">
      <div className="resource-actions">
        <button type="button" disabled={busy} onClick={() => input.current.click()}><Upload size={14}/>{busy ? 'Import en cours…' : hasLogo ? 'Remplacer le logo' : 'Importer un logo'}</button>
        {hasLogo && <button type="button" disabled={busy} onClick={() => { onChange(null); setError(''); }}><X size={14}/>Retirer le logo</button>}
      </div>
      <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label="Fichier du logo" onChange={upload}/>
      <small>PNG, JPG, WebP ou SVG · 2 Mo max. Le logo est conservé avec l’outil.</small>
      {error && <p className="logo-error" role="alert">{error}</p>}
    </div>
  </div>;
}
