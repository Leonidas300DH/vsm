import React from 'react';
import useStore from '../store/useStore';
import { Paperclip, X, Download, FileText, Plus, Trash2, AlertTriangle, Wrench, ChevronRight } from 'lucide-react';
import { saveFile, deleteFile } from '../utils/db';
import { computeLineage } from '../utils/lineageUtils';

// Numeric fields: an emptied or invalid input is stored as 0, never NaN.
const toNumber = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
};

const PropertiesPanel = ({ onClose }) => {
    const nodes = useStore(s => s.nodes);
    const edges = useStore(s => s.edges);
    const updateNodeData = useStore(s => s.updateNodeData);
    const updateEdgeData = useStore(s => s.updateEdgeData);
    const tools = useStore(s => s.tools);
    const selectedItemId = useStore(s => s.selectedItemId);
    const setSelectedItem = useStore(s => s.setSelectedItem);

    // Find selected node or edge
    const selectedNode = nodes.find((n) => n.selected);
    const selectedEdge = edges.find((e) => e.selected);

    // Compute Lineage Data
    const lineageData = React.useMemo(() => {
        if (!selectedItemId) return null;
        return computeLineage(nodes, edges, selectedItemId, tools);
    }, [selectedItemId, nodes, edges, tools]);

    // Helper to update edge data
    const handleEdgeChange = (field, value) => {
        if (selectedEdge) {
            updateEdgeData(selectedEdge.id, { [field]: value });
        }
    };

    const handleNodeChange = (field, value) => {
        if (selectedNode) {
            updateNodeData(selectedNode.id, { [field]: value });
        }
    };

    // --- LINEAGE VIEW ---
    if (selectedItemId && lineageData) {
        return (
            <aside style={panelStyle}>
                <div style={headerStyle}>
                    <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#7A3E9D', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            Lineage View
                        </h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                            Item: <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{lineageData.item}</span>
                        </div>
                    </div>
                    <button onClick={() => setSelectedItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }} title="Close Lineage View">
                        <X size={18} />
                    </button>
                </div>

                <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
                    {/* Entry Nodes */}
                    {lineageData.entryNodes.length > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#adb5bd', marginBottom: '0.75rem' }}>Entry Nodes</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {lineageData.entryNodes.map(node => (
                                    <div key={node.nodeId} style={{
                                        padding: '0.75rem',
                                        background: '#0d171e',
                                        border: '1px solid #30434f',
                                        borderRadius: '6px',
                                        fontSize: '0.9rem',
                                        fontWeight: 500
                                    }}>
                                        {node.label}
                                        {node.volume > 0 && (
                                            <div style={{ fontSize: '0.8rem', color: '#9aadb9', marginTop: '0.25rem' }}>
                                                Volume: {node.volume}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step-by-Step Flow */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#adb5bd', marginBottom: '0.75rem' }}>Step-by-Step Flow</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {lineageData.steps.map((step, index) => (
                                <div key={step.nodeId} style={{ position: 'relative' }}>
                                    {/* Step Card */}
                                    <div style={{
                                        border: `1px solid ${step.borderColor}`,
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                    }}>
                                        {/* Header */}
                                        <div style={{
                                            background: step.color,
                                            color: '#14212a',
                                            padding: '0.75rem 1rem',
                                            fontWeight: 600,
                                            fontSize: '0.95rem'
                                        }}>
                                            {index + 1}. {step.label}
                                        </div>

                                        {/* Body */}
                                        <div style={{ padding: '1rem' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: '#9aadb9', marginBottom: '0.25rem' }}>Cycle Time</div>
                                                    <div style={{ fontWeight: 500 }}>{step.cycleTime} min</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.75rem', color: '#9aadb9', marginBottom: '0.25rem' }}>Volume</div>
                                                    <div style={{ fontWeight: 500 }}>{step.volume}</div>
                                                </div>
                                            </div>

                                            <div style={{ marginBottom: '1rem' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#9aadb9', marginBottom: '0.25rem' }}>Total Processing Time</div>
                                                <div style={{ fontWeight: 600, fontSize: '1rem' }}>{step.processingTime} min</div>
                                            </div>

                                            {/* Incoming Inventory */}
                                            {step.incomingInventory && (
                                                <div style={{ marginBottom: '1rem', padding: '0.5rem', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '4px', fontSize: '0.8rem', color: '#856404' }}>
                                                    <strong>Incoming Inventory:</strong> {step.incomingInventory}
                                                </div>
                                            )}

                                            {/* Tools */}
                                            {step.tools.length > 0 && (
                                                <div style={{ background: '#192933', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                                    <span style={{ color: '#9aadb9', marginRight: '0.25rem' }}>Tools:</span>
                                                    {step.tools.join(', ')}
                                                </div>
                                            )}

                                            {/* Attachments */}
                                            {step.attachments.length > 0 && (
                                                <div style={{ background: '#0d171e', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid #30434f' }}>
                                                    <div style={{ color: '#9aadb9', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                        <Paperclip size={10} /> Documents:
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        {step.attachments.map((file, idx) => (
                                                            <span key={idx} style={{ background: '#14212a', padding: '2px 6px', borderRadius: '3px', border: '1px solid #30434f' }}>
                                                                {file.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Outgoing Edges Info */}
                                    {step.outgoingEdges.length > 0 && (
                                        <div style={{
                                            marginTop: '0.5rem',
                                            marginLeft: '1rem',
                                            paddingLeft: '1rem',
                                            borderLeft: '2px solid #293c47'
                                        }}>
                                            <div style={{ fontSize: '0.8rem', color: '#9aadb9', fontStyle: 'italic', marginBottom: '0.25rem' }}>Outgoing Flow</div>
                                            {step.outgoingEdges.map(edge => (
                                                <div key={edge.edgeId} style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                                    <div style={{ fontWeight: 500 }}>To: {edge.targetLabel}</div>
                                                    <div style={{ color: '#adb5bd', fontSize: '0.8rem' }}>
                                                        Routing: {edge.routing !== null ? `${edge.routing}%` : '100%'}
                                                        {edge.volume !== null && ` (${edge.volume.toFixed(1)})`}
                                                    </div>
                                                    {/* Wait Time & Pain Points */}
                                                    {(edge.wait > 0 || edge.painPoint) && (
                                                        <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#9fadb9', paddingLeft: '0.5rem', borderLeft: '2px solid #30434f' }}>
                                                            {edge.wait > 0 && <div>Wait: {edge.wait} min</div>}
                                                            {edge.painPoint && <div style={{ color: '#df9296' }}>Pain: {edge.painPoint}</div>}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Exit Nodes */}
                    {lineageData.exitNodes.length > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#adb5bd', marginBottom: '0.75rem' }}>Exit Nodes</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {lineageData.exitNodes.map(node => (
                                    <div key={node.nodeId} style={{
                                        padding: '0.75rem',
                                        background: '#0d171e',
                                        border: '1px solid #30434f',
                                        borderRadius: '6px',
                                        fontSize: '0.9rem',
                                        fontWeight: 500
                                    }}>
                                        {node.label}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </aside >
        );
    }

    if (!selectedNode && !selectedEdge) {
        return (
            <aside style={panelStyle}>
                <div style={headerStyle}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Properties</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                        <ChevronRight size={18} />
                    </button>
                </div>
                <div style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    Select a node or connection to edit its properties.
                </div>
            </aside>
        );
    }

    // --- EDGE PROPERTIES ---
    if (selectedEdge) {
        const sourceNode = nodes.find(n => n.id === selectedEdge.source);
        const volumeStream = sourceNode?.data?.volumeStreamOut || [];

        return (
            <aside style={panelStyle}>
                <div style={headerStyle}>
                    <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Connection</h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Flow</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                        <ChevronRight size={18} />
                    </button>
                </div>
                <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
                    <div style={formGroupStyle}>
                        <label style={labelStyle}>Routing Type</label>
                        <select
                            value={selectedEdge.data?.routingType || 'global'}
                            onChange={(e) => handleEdgeChange('routingType', e.target.value)}
                            style={inputStyle}
                        >
                            <option value="global">Global Split (%)</option>
                            <option value="item">Item Specific</option>
                            <option value="remaining">Remaining (Auto)</option>
                        </select>
                    </div>

                    {(!selectedEdge.data?.routingType || selectedEdge.data?.routingType === 'global') && (
                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Distribution %</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={selectedEdge.data?.percentage !== undefined ? selectedEdge.data.percentage : ''}
                                placeholder="Auto"
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleEdgeChange('percentage', toNumber(e.target.value))}
                                style={inputStyle}
                            />
                        </div>
                    )}

                    {/* Consolidated Item Configuration */}
                    <div style={{ marginTop: '1.5rem' }}>
                        <label style={labelStyle}>Item Configuration</label>
                        {volumeStream.map(item => (
                            <div key={item.id} style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: '8px', background: '#14212a' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid #293c47', paddingBottom: '0.5rem' }}>
                                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.color }}></div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.name}</span>
                                </div>

                                {/* Routing Percentage (if Item Routing) */}
                                {selectedEdge.data?.routingType === 'item' && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', background: '#0d171e', padding: '0.5rem', borderRadius: '4px' }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>Routing</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={(selectedEdge.data?.itemRouting || {})[item.id] || 0}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => {
                                                    const currentRouting = selectedEdge.data?.itemRouting || {};
                                                    handleEdgeChange('itemRouting', {
                                                        ...currentRouting,
                                                        [item.id]: toNumber(e.target.value)
                                                    });
                                                }}
                                                style={{ ...inputStyle, width: '60px', textAlign: 'right', padding: '0.25rem' }}
                                            />
                                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>%</span>
                                        </div>
                                    </div>
                                )}

                                {/* Wait Time */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', width: '70px' }}>Wait (min)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        value={((selectedEdge.data?.itemData || {})[item.id] || {}).wait || ''}
                                        onChange={(e) => {
                                            const currentItemData = selectedEdge.data?.itemData || {};
                                            const itemProps = currentItemData[item.id] || {};
                                            handleEdgeChange('itemData', {
                                                ...currentItemData,
                                                [item.id]: { ...itemProps, wait: toNumber(e.target.value) }
                                            });
                                        }}
                                        style={{ ...inputStyle, padding: '0.25rem', flex: 1 }}
                                    />
                                </div>

                                {/* Inventory */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', width: '70px' }}>Inventory</label>
                                    <input
                                        type="text"
                                        placeholder="-"
                                        value={((selectedEdge.data?.itemData || {})[item.id] || {}).inventory || ''}
                                        onChange={(e) => {
                                            const currentItemData = selectedEdge.data?.itemData || {};
                                            const itemProps = currentItemData[item.id] || {};
                                            handleEdgeChange('itemData', {
                                                ...currentItemData,
                                                [item.id]: { ...itemProps, inventory: e.target.value }
                                            });
                                        }}
                                        style={{ ...inputStyle, padding: '0.25rem', flex: 1 }}
                                    />
                                </div>

                                {/* Pain Point */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', width: '70px' }}>Pain Point</label>
                                    <input
                                        type="text"
                                        placeholder="-"
                                        value={((selectedEdge.data?.itemData || {})[item.id] || {}).painPoint || ''}
                                        onChange={(e) => {
                                            const currentItemData = selectedEdge.data?.itemData || {};
                                            const itemProps = currentItemData[item.id] || {};
                                            handleEdgeChange('itemData', {
                                                ...currentItemData,
                                                [item.id]: { ...itemProps, painPoint: e.target.value }
                                            });
                                        }}
                                        style={{ ...inputStyle, padding: '0.25rem', flex: 1 }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {selectedEdge.data?.isError && (
                        <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#30262c', border: '1px solid #df9296', borderRadius: '4px', color: '#df9296', fontSize: '0.8rem' }}>
                            <strong>Routing Error:</strong> Total percentage does not equal 100%. Please adjust.
                        </div>
                    )}
                </div>
            </aside>
        );
    }

    // --- NODE PROPERTIES ---

    // Start Node Volume Management
    const handleAddVolumeItem = () => {
        const currentItems = selectedNode.data.volumeItems || [];
        const newItem = {
            id: crypto.randomUUID(),
            name: 'New Item',
            value: 0,
            color: ['#91bbc8', '#b6a1d1', '#cfb77a', '#83bba7'][currentItems.length % 4]
        };
        handleNodeChange('volumeItems', [...currentItems, newItem]);
    };

    const handleUpdateVolumeItem = (id, field, value) => {
        const currentItems = selectedNode.data.volumeItems || [];
        const updatedItems = currentItems.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        );
        handleNodeChange('volumeItems', updatedItems);
    };

    const handleRemoveVolumeItem = (id) => {
        const currentItems = selectedNode.data.volumeItems || [];
        handleNodeChange('volumeItems', currentItems.filter(item => item.id !== id));
    };

    // File Upload Handlers (IndexedDB)
    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const newAttachments = [];

        for (const file of files) {
            const fileId = crypto.randomUUID();
            const fileData = {
                id: fileId,
                name: file.name,
                type: file.type,
                size: file.size,
                lastModified: file.lastModified,
                content: file // Store the File object directly in IndexedDB
            };

            try {
                await saveFile(fileData);
                // Store only metadata in the node
                newAttachments.push({
                    id: fileId,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified
                });
            } catch (error) {
                console.error("Failed to save file to DB:", error);
                alert(`Failed to save ${file.name}.`);
            }
        }

        if (newAttachments.length > 0) {
            const currentAttachments = selectedNode.data.attachments || [];
            handleNodeChange('attachments', [...currentAttachments, ...newAttachments]);
        }
        e.target.value = '';
    };

    const removeAttachment = async (attachmentId) => {
        try {
            await deleteFile(attachmentId);
            const currentAttachments = selectedNode.data.attachments || [];
            handleNodeChange('attachments', currentAttachments.filter(a => a.id !== attachmentId));
        } catch (error) {
            console.error("Failed to delete file from DB:", error);
        }
    };

    return (
        <aside style={panelStyle}>
            <div style={headerStyle}>
                <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Properties</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{selectedNode.data.subtype === 'ai' ? 'AI Agent' : selectedNode.type}</span>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                    <ChevronRight size={18} />
                </button>
            </div>

            <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
                {selectedNode.data.errors && selectedNode.data.errors.length > 0 && (
                    <div style={{
                        marginBottom: '1rem',
                        padding: '0.75rem',
                        background: '#fff5f5',
                        border: '1px solid #feb2b2',
                        borderRadius: '4px',
                        color: '#c53030',
                        fontSize: '0.8rem'
                    }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={14} />
                            Attention Needed
                        </div>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                            {selectedNode.data.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {selectedNode.type === 'process' && <div style={formGroupStyle}>
                    <label style={labelStyle}>Exécution de l’étape
                    <select style={inputStyle} value={selectedNode.data.subtype || 'standard'} onChange={e => useStore.getState().updateNodeData(selectedNode.id, { subtype:e.target.value, executionMode:'step' })}>
                      <option value="standard">Notre équipe · gris</option><option value="actor">Autre équipe / acteur · orange</option><option value="it">Système IT · vert</option><option value="ai">AI Agent · bleu</option>
                    </select></label>
                    {['actor','it'].includes(selectedNode.data.subtype) && <label style={labelStyle}>Rôle dans le flux<select style={inputStyle} value={selectedNode.data.executionMode || 'support'} onChange={e => handleNodeChange('executionMode', e.target.value)}><option value="step">Étape exécutée (volume et processing time)</option><option value="support">Support / information (modèle historique)</option></select></label>}
                </div>}
                <div style={formGroupStyle}>
                    <label style={labelStyle}>Label</label>
                    <input
                        type="text"
                        value={selectedNode.data.label || ''}
                        onChange={(e) => handleNodeChange('label', e.target.value)}
                        style={inputStyle}
                    />
                </div>

                <div style={formGroupStyle}>
                    <label style={labelStyle}>Description</label>
                    <textarea
                        value={selectedNode.data.description || ''}
                        onChange={(e) => handleNodeChange('description', e.target.value)}
                        style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                        placeholder="Enter description..."
                    />
                </div>

                {/* START NODE: Volume Items */}
                {selectedNode.type === 'startEnd' && (
                    <>


                        {selectedNode.data.type === 'start' && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <label style={labelStyle}>Volume Streams</label>
                                    <button onClick={handleAddVolumeItem} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)' }}>
                                        <Plus size={16} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {(selectedNode.data.volumeItems || []).map(item => (
                                        <div key={item.id} style={{ padding: '0.5rem', border: '1px solid var(--color-border)', borderRadius: '4px', background: '#14212a' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                <input
                                                    type="color"
                                                    value={item.color}
                                                    onChange={(e) => handleUpdateVolumeItem(item.id, 'color', e.target.value)}
                                                    style={{ width: '24px', height: '24px', padding: 0, border: 'none', background: 'none' }}
                                                />
                                                <input
                                                    type="text"
                                                    value={item.name}
                                                    onChange={(e) => handleUpdateVolumeItem(item.id, 'name', e.target.value)}
                                                    style={{ ...inputStyle, padding: '0.25rem', fontSize: '0.8rem' }}
                                                />
                                                <button onClick={() => handleRemoveVolumeItem(item.id)} style={{ background: 'none', border: 'none', color: '#df9296', cursor: 'pointer' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Vol:</label>
                                                <input
                                                    type="number"
                                                    value={item.value}
                                                    onChange={(e) => handleUpdateVolumeItem(item.id, 'value', toNumber(e.target.value))}
                                                    style={{ ...inputStyle, padding: '0.25rem', fontSize: '0.8rem' }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* PROCESS NODE: Cycle Times per Item */}
                {selectedNode.type === 'process' && (
                    <>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={labelStyle}>Cycle Times (mins)</label>
                            {(selectedNode.data.volumeStreamIn || []).length > 0 ? (
                                (selectedNode.data.volumeStreamIn || []).map(item => (
                                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.color }}></div>
                                        <span style={{ fontSize: '0.8rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                                        <input
                                            type="number"
                                            value={(selectedNode.data.cycleTimes || {})[item.id] || 0}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                                const currentCT = selectedNode.data.cycleTimes || {};
                                                handleNodeChange('cycleTimes', {
                                                    ...currentCT,
                                                    [item.id]: toNumber(e.target.value)
                                                });
                                            }}
                                            style={{ ...inputStyle, width: '70px', padding: '0.25rem' }}
                                        />
                                    </div>
                                ))
                            ) : (
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                    Connect a volume source to set cycle times.
                                </div>
                            )}
                        </div>

                        {/* PROCESS NODE SPECIFIC FIELDS */}
                        {/* Standard Process Fields */}
                        {(selectedNode.data.executionMode === 'step' || selectedNode.data.subtype === 'standard' || selectedNode.data.subtype === 'ai' || !selectedNode.data.subtype) && (
                            <>
                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>Process Time (min)</label>
                                    <input
                                        type="number"
                                        style={{ ...inputStyle, background: '#293c47', color: '#9fadb9', cursor: 'not-allowed' }}
                                        value={selectedNode.data.process_time_total || 0}
                                        readOnly
                                    />
                                </div>
                                <div style={formGroupStyle}>
                                    <label style={labelStyle}>FTE Required</label>
                                    <input
                                        type="number"
                                        style={{ ...inputStyle, background: '#293c47', color: '#9fadb9', cursor: 'not-allowed' }}
                                        value={selectedNode.data.fte_required || 0}
                                        readOnly
                                    />
                                </div>

                            </>
                        )}

                        {/* Actor / IT Specific Fields */}
                        {(selectedNode.data.executionMode === 'step' || selectedNode.data.subtype === 'actor' || selectedNode.data.subtype === 'it') && (
                            <div style={formGroupStyle}>
                                <label style={labelStyle}>Total Wait Time (min)</label>
                                <input
                                    type="number"
                                    style={inputStyle}
                                    value={selectedNode.data.wait_time || 0}
                                    onChange={(e) => handleNodeChange('wait_time', toNumber(e.target.value))}
                                />
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                                    Time spent waiting at this step.
                                </div>
                            </div>
                        )}

                        <div style={formGroupStyle}>
                            <label style={labelStyle}>Batch Size</label>
                            <input
                                type="number"
                                value={selectedNode.data.batchSize || 1}
                                onChange={(e) => handleNodeChange('batchSize', toNumber(e.target.value))}
                                style={inputStyle}
                            />
                        </div>



                        {/* PROCESS NODE: Tools Used */}
                        <div style={{ ...formGroupStyle, marginTop: '1.5rem' }}>
                            <label style={labelStyle}>Tools Used</label>

                            {/* Assign Existing Tool */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <select
                                    id="tool-select"
                                    style={{ ...inputStyle, flex: 1 }}
                                    defaultValue=""
                                    onChange={(e) => {
                                        const toolId = e.target.value;
                                        if (toolId) {
                                            const currentTools = selectedNode.data.toolsUsed || [];
                                            if (!currentTools.includes(toolId)) {
                                                handleNodeChange('toolsUsed', [...currentTools, toolId]);
                                            }
                                            e.target.value = "";
                                        }
                                    }}
                                >
                                    <option value="" disabled>Select existing tool...</option>
                                    {tools.filter(t => !(selectedNode.data.toolsUsed || []).includes(t.id)).map(tool => (
                                        <option key={tool.id} value={tool.id}>{tool.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Create New Tool Inline */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    id="new-tool-prop-input"
                                    placeholder="Or create new tool..."
                                    style={{ ...inputStyle, flex: 1, fontSize: '0.8rem' }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const input = e.target;
                                            if (input.value.trim()) {
                                                const newTool = { id: useStore.getState().saveResource('tools', { name: input.value.trim() }), name: input.value.trim() };
                                                
                                                const currentTools = selectedNode.data.toolsUsed || [];
                                                handleNodeChange('toolsUsed', [...currentTools, newTool.id]);
                                                input.value = '';
                                            }
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        const input = document.getElementById('new-tool-prop-input');
                                        if (input.value.trim()) {
                                            const newTool = { id: useStore.getState().saveResource('tools', { name: input.value.trim() }), name: input.value.trim() };
                                            
                                            const currentTools = selectedNode.data.toolsUsed || [];
                                            handleNodeChange('toolsUsed', [...currentTools, newTool.id]);
                                            input.value = '';
                                        }
                                    }}
                                    style={{
                                        background: 'var(--color-primary)',
                                        color: '#14212a',
                                        border: 'none',
                                        borderRadius: '4px',
                                        width: '32px',
                                        height: '32px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    title="Create & Assign"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            {/* Assigned Tools List */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {(selectedNode.data.toolsUsed || []).map(toolId => {
                                    const tool = tools.find(t => t.id === toolId);
                                    if (!tool) return null;
                                    return (
                                        <div key={toolId} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            padding: '0.25rem 0.5rem',
                                            background: '#293c47',
                                            borderRadius: '16px',
                                            fontSize: '0.75rem',
                                            color: '#9fadb9'
                                        }}>
                                            <Wrench size={10} />
                                            <span>{tool.name}</span>
                                            <button
                                                onClick={() => {
                                                    const currentTools = selectedNode.data.toolsUsed || [];
                                                    handleNodeChange('toolsUsed', currentTools.filter(id => id !== toolId));
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    padding: 0,
                                                    cursor: 'pointer',
                                                    color: '#df9296',
                                                    display: 'flex',
                                                    marginLeft: '0.25rem'
                                                }}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                <div style={{ ...formGroupStyle, marginTop: '1.5rem' }}>
                    <label style={labelStyle}>Attachments</label>

                    <div style={{ marginBottom: '0.5rem' }}>
                        <input
                            type="file"
                            id="file-upload"
                            multiple
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                        />
                        <label
                            htmlFor="file-upload"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem',
                                border: '1px dashed var(--color-border)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                color: 'var(--color-text-secondary)',
                                justifyContent: 'center',
                                background: '#0d171e'
                            }}
                        >
                            <Paperclip size={16} />
                            Add Files
                        </label>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(selectedNode.data.attachments || []).map((file) => (
                            <div key={file.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem',
                                background: '#14212a',
                                border: '1px solid var(--color-border)',
                                borderRadius: '4px',
                                fontSize: '0.8rem'
                            }}>
                                <FileText size={14} color="#9aadb9" />
                                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {file.name}
                                </div>
                                <a
                                    href={file.url}
                                    download={file.name}
                                    title="Download"
                                    style={{ color: 'var(--color-text-secondary)', display: 'flex' }}
                                >
                                    <Download size={14} />
                                </a>
                                <button
                                    onClick={() => removeAttachment(file.id)}
                                    title="Remove"
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        padding: 0,
                                        color: '#df9296',
                                        display: 'flex'
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
};

const panelStyle = {
    width: 'var(--properties-width)',
    background: 'var(--color-surface)',
    borderLeft: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
};

const headerStyle = {
    padding: '1rem',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
};

const formGroupStyle = {
    marginBottom: '1rem'
};

const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 500,
    marginBottom: '0.25rem',
    color: 'var(--color-text-secondary)'
};

const inputStyle = {
    width: '100%',
    padding: '0.5rem',
    borderRadius: '4px',
    border: '1px solid var(--color-border)',
    fontSize: '0.875rem',
    fontFamily: 'inherit'
};

export default PropertiesPanel;
