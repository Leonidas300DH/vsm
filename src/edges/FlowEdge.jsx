import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from 'reactflow';

const FlowEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
}) => {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const edgeStyle = {
        ...style,
        stroke: data?.isError ? '#dc3545' : (style.stroke || '#b1b1b7'),
        strokeWidth: data?.isError ? 2 : (style.strokeWidth || 1.5),
    };

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        background: '#fff',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        border: '1px solid #dee2e6',
                        pointerEvents: 'all',
                        cursor: 'pointer',
                        zIndex: 1000,
                        whiteSpace: 'pre-wrap',
                        textAlign: 'center',
                    }}
                    className="nodrag nopan"
                >
                    {data?.labelItems && data.labelItems.length > 0 ? (
                        <div style={{ textAlign: 'left' }}>
                            {data.labelItems.map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', fontWeight: 600 }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: item.color }} />
                                    <span style={{ color: '#000' }}>{item.name}: {item.pct}%</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        data?.label || ''
                    )}
                    {data?.volume ? ` (${data.volume})` : ''}

                    {/* Render Item Properties */}
                    {data?.itemData && Object.entries(data.itemData).map(([itemId, props]) => {
                        const item = (data.volumeStream || []).find(i => i.id === itemId);
                        if (!item || (!props.wait && !props.inventory && !props.painPoint)) return null;

                        return (
                            <div key={itemId} style={{ marginTop: '4px', borderTop: '1px solid #eee', paddingTop: '2px', textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem', fontWeight: 600, color: item.color }}>
                                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: item.color }}></div>
                                    {item.name}
                                </div>
                                {props.wait > 0 && <div style={{ fontSize: '0.6rem', color: '#666' }}>Wait: {props.wait}m</div>}
                                {props.inventory && <div style={{ fontSize: '0.6rem', color: '#666' }}>Inv: {props.inventory}</div>}
                                {props.painPoint && <div style={{ fontSize: '0.6rem', color: '#dc3545' }}>⚠ {props.painPoint}</div>}
                            </div>
                        );
                    })}
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

export default FlowEdge;
