import React, { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { ArrowRightToLine, ArrowRightFromLine, ArrowDownToLine, ArrowDownFromLine, Paperclip } from 'lucide-react';
import useStore from '../store/useStore';

const StartEndNode = ({ id, data, selected }) => {
    const isStart = data.type === 'start';
    const hasAttachments = data.attachments && data.attachments.length > 0;
    const nodeBorder = '#f36f79';
    const nodeBg = '#381c26';
    const vertical = useStore(s => s.orientation === 'vertical');
    const updateNodeInternals = useUpdateNodeInternals();
    // Handles move between left/right and top/bottom: React Flow must re-measure them.
    useEffect(() => { updateNodeInternals(id); }, [vertical, id, updateNodeInternals]);
    const port = vertical
        ? { background: '#7e99a8', width: '12px', height: '12px', left: '50%', transform: 'translateX(-50%)' }
        : { background: '#7e99a8', width: '12px', height: '12px' };
    const Icon = isStart ? (vertical ? ArrowDownToLine : ArrowRightToLine) : (vertical ? ArrowDownFromLine : ArrowRightFromLine);

    return (
        <div className="terminal-card" title={isStart ? "Entrée (Input)" : "Sortie (Output)"} style={{
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
            {!isStart && <Handle type="target" position={vertical ? Position.Top : Position.Left} style={vertical ? { ...port, top: '-6px' } : { ...port, left: '-6px' }} />}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon size={20} aria-label={isStart ? "Entrée (Input)" : "Sortie (Output)"} color={nodeBorder} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{data.label}</span>
            </div>

            {data.description && (
                <div style={{ fontSize: '0.7rem', color: '#9aadb9', textAlign: 'center', whiteSpace: 'nowrap' }}>
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
                            color: '#9fadb9',
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
                <div style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#14212a', borderRadius: '50%', padding: '2px', border: '1px solid #30434f' }}>
                    <Paperclip size={12} color="#9aadb9" />
                </div>
            )}

            {isStart && <Handle type="source" position={vertical ? Position.Bottom : Position.Right} style={vertical ? { ...port, bottom: '-6px', top: 'auto' } : { ...port, right: '-6px' }} />}
        </div>
    );
};

export default memo(StartEndNode);
