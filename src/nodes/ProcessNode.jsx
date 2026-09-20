import React, { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { Paperclip, AlertTriangle, Plus, User, Workflow, Bot, Box, Trash2 } from 'lucide-react';
import { getFile } from '../utils/db';
import NodeResources from '../components/NodeResources';
import useStore from '../store/useStore';

const ProcessNode = ({ id, data, selected }) => {
    const { addNextNode, deleteNode } = useStore();
    const confirmDelete = (e) => {
        e.stopPropagation();
        if (window.confirm(`Supprimer l’étape « ${data.label || 'Étape'} » et ses connexions ? Vous pourrez annuler juste après.`)) deleteNode(id);
    };
    const vertical = useStore(s => s.orientation === 'vertical');
    const updateNodeInternals = useUpdateNodeInternals();
    // Handles move between left/right and top/bottom: React Flow must re-measure them.
    useEffect(() => { updateNodeInternals(id); }, [vertical, id, updateNodeInternals]);
    const hasAttachments = data.attachments && data.attachments.length > 0;
    const subtype = data.subtype || 'standard';

    // Variant Styles/Icons
    let HeaderIcon = Box; // Default Icon
    let variantStyle = {};

    if (subtype === 'actor') {
        HeaderIcon = User;
        variantStyle = { borderRadius: '16px' }; // Rounded for Actor
    } else if (subtype === 'it') {
        HeaderIcon = Workflow;
        variantStyle = { border: '2px solid #8bb8cb' }; // Thicker border for IT
    }

    if (subtype === 'ai') HeaderIcon = Bot;

    // Global Color Scheme
    let nodeColor = '#14212a'; // Body is always white
    let borderColor = '#30434f';
    let headerBg = '#8bb8cb'; // Default Blue for Standard Steps
    let headerText = '#14212a';

    if (subtype === 'actor') {
        headerBg = '#9fadb9'; // Dark Grey for Actors
        borderColor = '#9fadb9';
    } else if (subtype === 'it') {
        headerBg = '#b6a1d1'; // Orange for IT
        borderColor = '#b6a1d1';
    } else {
        // Standard
        headerBg = '#8bb8cb'; // Blue
        borderColor = '#8bb8cb';
    }

    // Volume Rounding
    const displayVolume = data.volume_in ? parseFloat(data.volume_in).toFixed(2) : '0.00';

    // ... (styles remain same)

    const tableStyle = {
        width: '100%',
        fontSize: '0.7rem',
        borderCollapse: 'collapse',
        marginTop: '0.5rem'
    };

    const cellStyle = {
        border: '1px solid #30434f',
        padding: '2px 4px',
        textAlign: 'right'
    };

    const labelCellStyle = {
        ...cellStyle,
        textAlign: 'left',
        fontWeight: 500,
        color: '#9fadb9'
    };

    return (
        <div className="step-with-resources" data-layout={vertical ? 'side' : 'below'}><div className="process-card" data-kind={subtype}
            onDragOver={e => { if (e.dataTransfer.types.includes("application/vsm-resource")) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "link"; } }}
            onDrop={e => { const raw = e.dataTransfer.getData("application/vsm-resource"); if (raw) { e.preventDefault(); e.stopPropagation(); try { const resource = JSON.parse(raw); useStore.getState().attachResource(id, resource.kind, resource.id); } catch { /* Ignore foreign drag data. */ } } }}
            style={{
                minWidth: '220px',
                maxWidth: '400px',
                width: 'fit-content',
                background: nodeColor,
                color: '#dce6ec',
                border: `1px solid ${selected ? '#8bb8cb' : borderColor}`,
                borderRadius: subtype === 'actor' ? '16px' : '8px',
                fontSize: '0.8rem',
                boxShadow: selected ? '0 0 0 2px rgba(13, 110, 253, 0.25)' : '0 2px 4px rgba(0,0,0,0.05)',
                ...variantStyle,
                overflow: 'visible',
                position: 'relative',
            }}
        >
            <Handle
                type="target"
                position={vertical ? Position.Top : Position.Left}
                style={vertical
                    ? { background: '#7e99a8', width: '12px', height: '12px', top: '-6px', left: '50%', transform: 'translateX(-50%)' }
                    : { background: '#7e99a8', width: '12px', height: '12px', left: '-6px', top: '50%', transform: 'translateY(-50%)' }}
            />

            {/* Header */}
            <div style={{
                padding: '0.5rem',
                borderBottom: `1px solid ${borderColor}`,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: headerBg,
                color: headerText,
                borderTopLeftRadius: subtype === 'actor' ? '15px' : '7px',
                borderTopRightRadius: subtype === 'actor' ? '15px' : '7px',
            }}>
                {HeaderIcon && <HeaderIcon size={14} />}
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {data.label}
                </div>
                <button type="button" className="node-delete nodrag" title="Supprimer l’étape" aria-label={`Supprimer l’étape ${data.label || ''}`} onClick={confirmDelete}>
                    <Trash2 size={12} />
                </button>
            </div>

            {/* Body */}
            <div style={{ padding: '0.5rem' }}>
                {/* Volume Display */}
                <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Volume In:</span>
                    <span style={{ fontWeight: 700 }}>{displayVolume}</span>
                </div>
                {data.description && (
                    <div style={{
                        fontSize: '0.75rem',
                        color: '#9aadb9',
                        marginBottom: '0.5rem',
                        fontStyle: 'italic',
                        borderBottom: '1px solid #293c47',
                        paddingBottom: '0.25rem'
                    }}>
                        {data.description}
                    </div>
                )}

                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={{ ...cellStyle, textAlign: 'left', color: '#9aadb9', fontWeight: 500 }}>Item</th>
                            <th style={{ ...cellStyle, color: '#9aadb9', fontWeight: 500 }}>C/T</th>
                            <th style={{ ...cellStyle, color: '#9aadb9', fontWeight: 500 }}>Vol</th>
                            <th style={{ ...cellStyle, color: '#9aadb9', fontWeight: 500 }}>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.volumeStreamIn && data.volumeStreamIn.filter(i => i.value > 0).length > 0 ? (
                            data.volumeStreamIn.filter(i => i.value > 0).map(item => {
                                const ct = (data.cycleTimes || {})[item.id] || 0;
                                const procTime = item.value * ct;
                                return (
                                    <tr key={item.id}>
                                        <td style={{ ...cellStyle, textAlign: 'left' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color }}></div>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60px' }} title={item.name}>{item.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...cellStyle, color: ct === 0 ? '#df9296' : 'inherit', fontWeight: ct === 0 ? 'bold' : 'inherit' }}>{ct}</td>
                                        <td style={cellStyle}>{parseFloat(item.value).toFixed(2)}</td>
                                        <td style={cellStyle}>{parseFloat(procTime).toFixed(2)}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="4" style={{ ...cellStyle, textAlign: 'center', color: '#adb5bd', fontStyle: 'italic' }}>No Volume</td>
                            </tr>
                        )}

                        <tr style={{ borderTop: '2px solid #30434f' }}>
                            <td colSpan="3" style={{ ...labelCellStyle, fontWeight: 600 }}>Total Proc Time</td>
                            <td style={{ ...cellStyle, fontWeight: 600 }}>{Number(data.process_time_total || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
                        </tr>
                        {(data.executionMode === 'step' || subtype === 'standard' || subtype === 'ai') && (
                            <>
                                <tr>
                                    <td colSpan="3" style={labelCellStyle}>FTE Req</td>
                                    <td style={cellStyle}>{data.fte_required || 0}</td>
                                </tr>
                                <tr>
                                    <td colSpan="3" style={labelCellStyle}>Util %</td>
                                    <td style={cellStyle}>{data.utilization || 0}%</td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>

            </div>

            {/* Attachments */}
            {hasAttachments && (
                <div style={{
                    padding: '0.5rem',
                    borderTop: `1px solid ${borderColor}`,
                    background: '#0d171e',
                    borderBottomLeftRadius: subtype === 'actor' ? '15px' : '7px',
                    borderBottomRightRadius: subtype === 'actor' ? '15px' : '7px',
                }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#9aadb9', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Paperclip size={10} /> Documents:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {data.attachments.map((file, idx) => (
                            <button
                                key={idx}
                                onClick={async (e) => {
                                    e.stopPropagation();
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
                                    background: '#fff9db',
                                    border: '1px solid #ffe066',
                                    borderRadius: '4px',
                                    padding: '2px 6px',
                                    fontSize: '0.7rem',
                                    color: '#9fadb9',
                                    cursor: 'pointer',
                                    maxWidth: '100%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    textAlign: 'left'
                                }}
                                title={file.name}
                            >
                                {file.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {hasAttachments && (
                <div style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    background: '#14212a',
                    borderRadius: '50%',
                    padding: '4px',
                    border: '1px solid #30434f',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                }}>
                    <Paperclip size={14} color="#9aadb9" />
                </div>
            )}

            {/* Validation Warning Icon */}
            {data.errors && data.errors.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '-15px',
                    left: '-15px',
                    background: '#14212a',
                    borderRadius: '50%',
                    padding: '4px',
                    border: '1px solid #df9296',
                    boxShadow: '0 1px 2px rgba(220, 53, 69, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                }} title={data.errors.join('\n')}>
                    <AlertTriangle size={14} color="#df9296" />
                </div>
            )}

            {/* Quick Add Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    addNextNode(id);
                }}
                title="Add Next Step"
                style={{
                    position: 'absolute',
                    // Next to the source port, offset so it never covers it: right side in horizontal, bottom in vertical.
                    ...(vertical
                        ? { left: 'calc(50% + 14px)', bottom: '-24px', transform: 'translateX(-50%)' }
                        : { right: '-24px', top: 'calc(50% + 14px)', transform: 'translateY(-50%)' }),
                    background: '#14212a',
                    border: '1px solid #30434f',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    zIndex: 10,
                    color: '#9aadb9'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#0d171e';
                    e.currentTarget.style.color = '#8bb8cb';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#14212a';
                    e.currentTarget.style.color = '#9aadb9';
                }}
            >
                <Plus size={12} />
            </button>

            <Handle
                type="source"
                position={vertical ? Position.Bottom : Position.Right}
                style={vertical
                    ? { background: '#7e99a8', width: '12px', height: '12px', bottom: '-6px', left: '50%', transform: 'translateX(-50%)', top: 'auto' }
                    : { background: '#7e99a8', width: '12px', height: '12px', right: '-6px' }}
            />
        </div><NodeResources id={id} data={data}/></div>
    );
};

export default memo(ProcessNode);
