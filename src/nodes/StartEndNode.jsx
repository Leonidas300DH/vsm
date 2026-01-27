import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { PlayCircle, StopCircle, Paperclip } from 'lucide-react';

const StartEndNode = ({ id, data, selected }) => {
    const isStart = data.type === 'start';
    const hasAttachments = data.attachments && data.attachments.length > 0;
    const nodeBorder = isStart ? '#198754' : '#dc3545'; // Dark Green / Dark Red
    const nodeBg = isStart ? '#d1e7dd' : '#f8d7da'; // Light Green / Light Red

    return (
        <div style={{
            background: nodeBg,
            border: `1px solid ${selected ? nodeBorder : nodeBorder}`,
            borderRadius: '20px',
            padding: '0.5rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
            boxShadow: selected ? `0 0 0 2px ${nodeBorder}40` : '0 2px 4px rgba(0,0,0,0.05)',
            minWidth: '120px',
            width: 'fit-content',
            justifyContent: 'center',
            position: 'relative'
        }}>
            {!isStart && <Handle type="target" position={Position.Left} style={{ background: '#555', width: '12px', height: '12px', left: '-6px' }} />}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isStart ? <PlayCircle size={16} color={nodeBorder} /> : <StopCircle size={16} color={nodeBorder} />}
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{data.label}</span>
            </div>

            {data.description && (
                <div style={{ fontSize: '0.7rem', color: '#6c757d', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {data.description}
                </div>
            )}

            {isStart && data.volumeItems && data.volumeItems.length > 0 && (
                <div style={{ marginTop: '0.5rem', width: '100%' }}>
                    {data.volumeItems.map(item => (
                        <div key={item.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.7rem',
                            color: '#495057',
                            marginBottom: '0.1rem'
                        }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }}></div>
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                            <strong>{item.value}</strong>
                        </div>
                    ))}
                </div>
            )}

            {hasAttachments && (
                <div style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#fff', borderRadius: '50%', padding: '2px', border: '1px solid #dee2e6' }}>
                    <Paperclip size={12} color="#6c757d" />
                </div>
            )}

            {isStart && <Handle type="source" position={Position.Right} style={{ background: '#555', width: '12px', height: '12px', right: '-6px' }} />}
        </div>
    );
};

export default memo(StartEndNode);
