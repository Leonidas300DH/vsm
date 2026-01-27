
import React, { useState } from 'react';
import { PlayCircle, StopCircle, Box, FileText, Wrench, LayoutGrid, User, Server, Plus, ChevronLeft, Layers } from 'lucide-react';
import useStore from '../store/useStore';
import { getFile } from '../utils/db';
import { extractAllItems } from '../utils/lineageUtils';

// Helper component for draggable nodes in the palette
const DraggableNode = ({ type, data, label, icon, color, borderColor, onDragStart }) => (
    <div
        style={{
            padding: '0.75rem 1rem',
            border: `1px solid ${borderColor || color} `,
            borderRadius: '6px',
            background: color,
            color: '#ffffff',
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
        draggable
    >
        {icon}
        <span>{label}</span>
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
                                <FileText size={12} color="#6c757d" />
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

// Helper component for tool manager
const ToolManager = ({ tools, addTool, deleteTool }) => (
    <div>
        <div style={{ marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: 0 }}>Global Tools</h4>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
                type="text"
                placeholder="New tool name..."
                id="new-tool-input"
                style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '4px',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.8rem'
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        const input = e.target;
                        if (input.value.trim()) {
                            addTool({ name: input.value.trim() });
                            input.value = '';
                        }
                    }
                }}
            />
            <button
                onClick={() => {
                    const input = document.getElementById('new-tool-input');
                    if (input.value.trim()) {
                        addTool({ name: input.value.trim() });
                        input.value = '';
                    }
                }}
                style={{
                    background: 'var(--color-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0 0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                }}
            >
                <Plus size={16} />
            </button>
        </div>

        {tools.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: '#adb5bd', fontStyle: 'italic', textAlign: 'center' }}>No tools added yet.</div>
        ) : (
            tools.map(tool => (
                <div key={tool.id} style={{
                    padding: '0.75rem',
                    background: '#fff',
                    border: '1px solid var(--color-border)',
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                    position: 'relative'
                }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>{tool.name}</div>
                    {tool.description && <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{tool.description}</div>}
                    <button
                        onClick={() => {
                            if (confirm(`Delete tool "${tool.name}" ? `)) deleteTool(tool.id);
                        }}
                        style={{
                            position: 'absolute',
                            top: '0.5rem',
                            right: '0.5rem',
                            background: 'none',
                            border: 'none',
                            color: '#dc3545',
                            cursor: 'pointer',
                            opacity: 0.5
                        }}
                        title="Delete Tool"
                    >
                        ×
                    </button>
                </div>
            ))
        )}
    </div>
);


const Sidebar = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('palette');
    const { nodes, tools, addTool, deleteTool, selectedItemId, setSelectedItem } = useStore();

    const onDragStart = (event, nodeType, nodeData) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.setData('application/reactflow-data', JSON.stringify(nodeData));
        event.dataTransfer.effectAllowed = 'move';
    };

    const allItems = extractAllItems(nodes).sort((a, b) => a.name.localeCompare(b.name));

    return (
        <aside style={{
            width: 'var(--sidebar-width)',
            background: 'var(--color-surface)',
            borderRight: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'relative'
        }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', alignItems: 'center' }}>
                <TabButton
                    active={activeTab === 'palette'}
                    onClick={() => { setActiveTab('palette'); setSelectedItem(null); }}
                    icon={<LayoutGrid size={18} />}
                    title="Palette"
                />
                <TabButton
                    active={activeTab === 'items'}
                    onClick={() => setActiveTab('items')}
                    icon={<Layers size={18} />}
                    title="Items"
                />
                <TabButton
                    active={activeTab === 'documents'}
                    onClick={() => { setActiveTab('documents'); setSelectedItem(null); }}
                    icon={<FileText size={18} />}
                    title="Documents"
                />
                <TabButton
                    active={activeTab === 'tools'}
                    onClick={() => { setActiveTab('tools'); setSelectedItem(null); }}
                    icon={<Wrench size={18} />}
                    title="Tools"
                />
                <button
                    onClick={onClose}
                    style={{
                        padding: '0.75rem',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginLeft: 'auto'
                    }}
                    title="Collapse Sidebar"
                >
                    <ChevronLeft size={18} />
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                {activeTab === 'palette' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>TRIGGERS</div>
                        <DraggableNode type="startEnd" data={{ label: 'Start', type: 'start' }} label="Start" icon={<PlayCircle size={16} />} color="#d1e7dd" borderColor="#198754" onDragStart={onDragStart} />
                        <DraggableNode type="startEnd" data={{ label: 'End', type: 'end' }} label="End" icon={<StopCircle size={16} />} color="#f8d7da" borderColor="#dc3545" onDragStart={onDragStart} />

                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem', marginTop: '1rem' }}>PROCESS NODES</div>
                        <DraggableNode type="process" data={{ label: 'Process Step' }} label="Process Step" icon={<Box size={16} />} color="#0d6efd" onDragStart={onDragStart} />
                        <DraggableNode type="process" data={{ label: 'Actor', subtype: 'actor' }} label="Actor" icon={<User size={16} />} color="#495057" onDragStart={onDragStart} />
                        <DraggableNode type="process" data={{ label: 'IT Processing', subtype: 'it' }} label="IT Processing" icon={<Server size={16} />} color="#fd7e14" onDragStart={onDragStart} />


                    </div>
                )}

                {activeTab === 'items' && (
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                            DETECTED ITEMS
                        </div>
                        {allItems.length === 0 ? (
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                No items detected in the process yet. Add Volume Streams or Cycle Times to nodes.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {allItems.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedItem(selectedItemId === item.id ? null : item.id)}
                                        style={{
                                            padding: '0.75rem',
                                            borderRadius: '6px',
                                            background: selectedItemId === item.id ? 'rgba(122, 62, 157, 0.1)' : '#fff',
                                            border: selectedItemId === item.id ? '1px solid #7A3E9D' : '1px solid var(--color-border)',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            fontWeight: 500,
                                            color: selectedItemId === item.id ? '#7A3E9D' : 'var(--color-text-primary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color || (selectedItemId === item.id ? '#7A3E9D' : '#adb5bd') }}></div>
                                        {item.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {
                    activeTab === 'documents' && (
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
                                                    <FileText size={12} color="#6c757d" />
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
                    )
                }

                {
                    activeTab === 'tools' && (
                        <div>
                            <div style={{ marginBottom: '1rem' }}>
                                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-text-secondary)', margin: 0 }}>Global Tools</h4>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <input
                                    type="text"
                                    placeholder="New tool name..."
                                    id="new-tool-input"
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        borderRadius: '4px',
                                        border: '1px solid var(--color-border)',
                                        fontSize: '0.8rem'
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const input = e.target;
                                            if (input.value.trim()) {
                                                addTool({ name: input.value.trim() });
                                                input.value = '';
                                            }
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        const input = document.getElementById('new-tool-input');
                                        if (input.value.trim()) {
                                            addTool({ name: input.value.trim() });
                                            input.value = '';
                                        }
                                    }}
                                    style={{
                                        background: 'var(--color-primary)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '0 0.75rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            {tools.length === 0 ? (
                                <div style={{ fontSize: '0.8rem', color: '#adb5bd', fontStyle: 'italic', textAlign: 'center' }}>No tools added yet.</div>
                            ) : (
                                tools.map(tool => (
                                    <div key={tool.id} style={{
                                        padding: '0.75rem',
                                        background: '#fff',
                                        border: '1px solid var(--color-border)',
                                        borderRadius: '4px',
                                        marginBottom: '0.5rem',
                                        position: 'relative'
                                    }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>{tool.name}</div>
                                        {tool.description && <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{tool.description}</div>}
                                        <button
                                            onClick={() => {
                                                if (confirm(`Delete tool "${tool.name}" ? `)) deleteTool(tool.id);
                                            }}
                                            style={{
                                                position: 'absolute',
                                                top: '0.5rem',
                                                right: '0.5rem',
                                                background: 'none',
                                                border: 'none',
                                                color: '#dc3545',
                                                cursor: 'pointer',
                                                opacity: 0.5
                                            }}
                                            title="Delete Tool"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )
                }
            </div >
        </aside >
    );
};

const TabButton = ({ active, onClick, icon, title }) => (
    <button
        onClick={onClick}
        title={title}
        style={{
            flex: 1,
            padding: '0.75rem',
            background: active ? 'var(--color-bg)' : 'transparent',
            border: 'none',
            borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            transition: 'all 0.2s'
        }}
    >
        {icon}
    </button>
);

const itemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '4px',
    marginBottom: '0.5rem',
    cursor: 'grab',
    fontSize: '0.875rem',
    fontWeight: 500
};

export default Sidebar;
