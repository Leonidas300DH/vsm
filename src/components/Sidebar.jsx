
import React, { useState } from 'react';
import { ArrowRightToLine, ArrowRightFromLine, Box, FileText, Wrench, LayoutGrid, User, Workflow, Bot, Database, Users, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import LibraryDialog from './LibraryDialog';
import ResourceLibrary from './ResourceLibrary';
import useStore from '../store/useStore';
import { getFile } from '../utils/db';
import { extractAllItems } from '../utils/lineageUtils';

// Helper component for draggable nodes in the palette
const DraggableNode = ({ type, data, label, icon, color, borderColor, onDragStart }) => (
    <div
        data-kind={type === 'startEnd' ? 'terminal' : data.subtype || 'standard'}
        style={{
            padding: '0.75rem 1rem',
            border: `1px solid ${borderColor || color} `,
            borderRadius: '6px',
            background: color,
            color: '#14212a',
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease',
            ...(borderColor && { color: borderColor, background: color }) // For triggers, color is text, background is light
        }}
        onDragStart={(event) => onDragStart(event, type, data)}
        title={label}
        aria-label={label}
        draggable
    >
        {icon}
        <span className="node-palette-label">{label}</span>
    </div>
);

// Helper component for document list
const DocumentList = ({ nodes }) => (
    <div>
        <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>Project Documents</h4>
        {nodes.filter(n => n.data.attachments && n.data.attachments.length > 0).length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: '#adb5bd', fontStyle: 'italic', textAlign: 'center' }}>No documents found in this project.</div>
        ) : (
            nodes.filter(n => n.data.attachments && n.data.attachments.length > 0).map(node => (
                <div key={node.id} style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Box size={12} /> {node.data.label}
                    </div>
                    <div style={{ paddingLeft: '0.5rem', borderLeft: '2px solid var(--color-border)' }}>
                        {node.data.attachments.map((file, idx) => (
                            <div key={idx} style={{ fontSize: '0.8rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <FileText size={12} color="#9aadb9" />
                                <button
                                    onClick={async () => {
                                        try {
                                            const fileData = await getFile(file.id);
                                            if (fileData && fileData.content) {
                                                const url = URL.createObjectURL(fileData.content);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = fileData.name;
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                                URL.revokeObjectURL(url);
                                            } else {
                                                alert('File not found in storage.');
                                            }
                                        } catch (err) {
                                            console.error("Error opening file:", err);
                                            alert('Error opening file.');
                                        }
                                    }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        color: 'var(--color-primary)',
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        textAlign: 'left'
                                    }}
                                    title="Click to open"
                                >
                                    {file.name}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))
        )}
    </div>
);

const Sidebar = ({ collapsed, onToggle, onExpand }) => {
  const [activeTab, setActiveTab] = useState('palette');
  const { nodes, selectedNodeId, selectedItemId, setSelectedItem } = useStore();
  const tabs = [['palette','Étapes',LayoutGrid],['tools','Outils',Wrench],['actors','Acteurs',Users],['knowledge','Connaissances',Database],['items','Items',Layers],['documents','Documents',FileText]];
  const onDragStart = (event, type, data) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.setData('application/reactflow-data', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';
  };
  return <aside className={`node-rail ${collapsed ? 'is-collapsed' : ''}`}>
    <button className="rail-collapse-toggle" onClick={onToggle} title={collapsed ? 'Déplier le rail' : 'Replier le rail'} aria-label={collapsed ? 'Déplier le rail' : 'Replier le rail'} aria-expanded={!collapsed}>{collapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}</button>
    <nav className="rail-tabs" aria-label="Bibliothèques et étapes">
      {tabs.map(([key,label,Icon]) => <button key={key} title={label} aria-label={label} aria-pressed={activeTab === key} onClick={() => { setActiveTab(key); setSelectedItem(null); if (key === 'palette') onExpand(); }}>{React.createElement(Icon, { size:17 })}<span>{label}</span></button>)}

    </nav>
    <div className="rail-content">
      {<div className="palette-list">
        <DraggableNode type="startEnd" data={{ label: 'Entrée', type: 'start' }} label="Entrée" icon={<ArrowRightToLine size={20}/>} onDragStart={onDragStart}/>
        <DraggableNode type="startEnd" data={{ label: 'Sortie', type: 'end' }} label="Sortie" icon={<ArrowRightFromLine size={20}/>} onDragStart={onDragStart}/>
        <DraggableNode type="process" data={{ label: 'Étape de notre équipe', executionMode: 'step' }} label="Notre équipe" icon={<Box size={18}/>} onDragStart={onDragStart}/>
        <DraggableNode type="process" data={{ label: 'Étape déléguée', subtype: 'actor', executionMode: 'step' }} label="Autre équipe" icon={<User size={18}/>} onDragStart={onDragStart}/>
        <DraggableNode type="process" data={{ label: 'Étape système', subtype: 'it', executionMode: 'step' }} label="Système IT" icon={<Workflow size={18}/>} onDragStart={onDragStart}/>
        <DraggableNode type="process" data={{ label: 'AI Agent', subtype: 'ai', executionMode: 'step' }} label="AI Agent" icon={<Bot size={18}/>} onDragStart={onDragStart}/>
      </div>}
      {activeTab !== 'palette' && <LibraryDialog title={tabs.find(t=>t[0]===activeTab)?.[1]} onClose={()=>setActiveTab('palette')}>
        {['tools','actors','knowledge'].includes(activeTab) && <ResourceLibrary key={activeTab} kind={activeTab} nodeId={nodes.find(n=>n.id===selectedNodeId)?.type === 'process' ? selectedNodeId : undefined}/>}
        {activeTab === 'documents' && <DocumentList nodes={nodes}/>}
        {activeTab === 'items' && <div className="library-items"><p>Sélectionnez un item pour suivre son parcours dans le flux.</p>{extractAllItems(nodes).length === 0 && <p>Aucun item dans cette carte.</p>}{extractAllItems(nodes).map(item => <button className="item-choice" key={item.id} aria-pressed={selectedItemId === item.id} onClick={() => {setSelectedItem(item.id);setActiveTab('palette');}}>{item.name}</button>)}</div>}
      </LibraryDialog>}
    </div>
  </aside>;
};
export default Sidebar;
