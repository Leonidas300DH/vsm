import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Paperclip, AlertTriangle, Plus, User, Server, Wrench, Box } from 'lucide-react';
import { getFile } from '../utils/db';
import useStore from '../store/useStore';

const ProcessNode = ({ id, data, selected }) => {
    const { addNextNode, tools } = useStore();
    const headerColor = data.headerColor || '#0d6efd'; // Default to Blue
    const hasAttachments = data.attachments && data.attachments.length > 0;
    const subtype = data.subtype || 'standard';

    // Variant Styles/Icons
    let HeaderIcon = Box; // Default Icon
    let variantStyle = {};

    if (subtype === 'actor') {
        HeaderIcon = User;
        variantStyle = { borderRadius: '16px' }; // Rounded for Actor
    } else if (subtype === 'it') {
        HeaderIcon = Server;
        variantStyle = { border: '2px solid #0d6efd' }; // Thicker border for IT
    }

    // Global Color Scheme
    let nodeColor = '#ffffff'; // Body is always white
    let borderColor = '#dee2e6';
    let headerBg = '#0d6efd'; // Default Blue for Standard Steps
    let headerText = '#ffffff';

    if (subtype === 'actor') {
        headerBg = '#495057'; // Dark Grey for Actors
        borderColor = '#495057';
    } else if (subtype === 'it') {
        headerBg = '#fd7e14'; // Orange for IT
        borderColor = '#fd7e14';
    } else {
        // Standard
        headerBg = '#0d6efd'; // Blue
        borderColor = '#0d6efd';
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
        border: '1px solid #dee2e6',
        padding: '2px 4px',
        textAlign: 'right'
    };

    const labelCellStyle = {
        ...cellStyle,
        textAlign: 'left',
        fontWeight: 500,
        color: '#495057'
    };

    // Resolve Tools
    const usedTools = (data.toolsUsed || []).map(toolId => tools.find(t => t.id === toolId)).filter(Boolean);

    return (
        <div
            style={{
                minWidth: '220px',
                maxWidth: '400px',
                width: 'fit-content',
                background: nodeColor,
                color: '#212529',
                border: `1px solid ${selected ? '#0d6efd' : borderColor}`,
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
                position={Position.Left}
                style={{
                    background: '#555',
                    width: '12px',
                    height: '12px',
                    left: '-6px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                }}
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
                        color: '#6c757d',
                        marginBottom: '0.5rem',
                        fontStyle: 'italic',
                        borderBottom: '1px solid #eee',
                        paddingBottom: '0.25rem'
                    }}>
                        {data.description}
                    </div>
                )}

                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={{ ...cellStyle, textAlign: 'left', color: '#6c757d', fontWeight: 500 }}>Item</th>
                            <th style={{ ...cellStyle, color: '#6c757d', fontWeight: 500 }}>C/T</th>
                            <th style={{ ...cellStyle, color: '#6c757d', fontWeight: 500 }}>Vol</th>
                            <th style={{ ...cellStyle, color: '#6c757d', fontWeight: 500 }}>Time</th>
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
                                        <td style={{ ...cellStyle, color: ct === 0 ? '#dc3545' : 'inherit', fontWeight: ct === 0 ? 'bold' : 'inherit' }}>{ct}</td>
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

                        <tr style={{ borderTop: '2px solid #dee2e6' }}>
                            <td colSpan="3" style={{ ...labelCellStyle, fontWeight: 600 }}>Total Proc Time</td>
                            <td style={{ ...cellStyle, fontWeight: 600 }}>{data.process_time_total || 0}</td>
                        </tr>
                        {subtype === 'standard' && (
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

                {/* Tools Used Section */}
                {usedTools.length > 0 && (
                    <div style={{ marginTop: '0.5rem', borderTop: '1px solid #eee', paddingTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6c757d', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Wrench size={10} /> Tools Used:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {usedTools.map(tool => (
                                <span key={tool.id} style={{
                                    fontSize: '0.65rem',
                                    background: '#e9ecef',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    color: '#495057'
                                }}>
                                    {tool.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Attachments */}
            {hasAttachments && (
                <div style={{
                    padding: '0.5rem',
                    borderTop: `1px solid ${borderColor}`,
                    background: '#f8f9fa',
                    borderBottomLeftRadius: subtype === 'actor' ? '15px' : '7px',
                    borderBottomRightRadius: subtype === 'actor' ? '15px' : '7px',
                }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6c757d', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
                                    color: '#495057',
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
                    background: '#fff',
                    borderRadius: '50%',
                    padding: '4px',
                    border: '1px solid #dee2e6',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                }}>
                    <Paperclip size={14} color="#6c757d" />
                </div>
            )}

            {/* Validation Warning Icon */}
            {data.errors && data.errors.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '-15px',
                    left: '-15px',
                    background: '#fff',
                    borderRadius: '50%',
                    padding: '4px',
                    border: '1px solid #dc3545',
                    boxShadow: '0 1px 2px rgba(220, 53, 69, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                }} title={data.errors.join('\n')}>
                    <AlertTriangle size={14} color="#dc3545" />
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
                    right: '-24px',
                    top: 'calc(50% + 14px)',
                    transform: 'translateY(-50%)',
                    background: '#fff',
                    border: '1px solid #dee2e6',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    zIndex: 10,
                    color: '#6c757d'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8f9fa';
                    e.currentTarget.style.color = '#0d6efd';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.color = '#6c757d';
                }}
            >
                <Plus size={12} />
            </button>

            <Handle
                type="source"
                position={Position.Right}
                style={{
                    background: '#555',
                    width: '12px',
                    height: '12px',
                    right: '-6px'
                }}
            />
        </div>
    );
};

export default memo(ProcessNode);
