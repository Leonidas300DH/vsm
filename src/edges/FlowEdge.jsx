import React, { useLayoutEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { useGraphState } from '../store/graphContext';
import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';

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
    const [edgePath, anchorX, anchorY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
    const readOnly = useGraphState(s => s.readOnly || s.scenarioScoped);
    const labelRef = useRef(null);
    useLayoutEffect(() => {
        if (readOnly) return;
        const element = labelRef.current;
        const observer = new ResizeObserver(() => {
            const width = element.offsetWidth, height = element.offsetHeight;
            const current = useStore.getState().edgeLabelSizes[id];
            if (current?.width !== width || current?.height !== height || current?.anchorX !== anchorX || current?.anchorY !== anchorY) useStore.setState(s => ({ edgeLabelSizes: { ...s.edgeLabelSizes, [id]: {width,height,anchorX,anchorY} } }));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [id,anchorX,anchorY,readOnly]);

    const edgeStyle = {
        ...style,
        stroke: data?.isError ? 'var(--c-df9296)' : (style.stroke || 'var(--c-67818f)'),
        strokeWidth: data?.isError ? 2 : (style.strokeWidth || 1.5),
    };

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
            <EdgeLabelRenderer>
                <div ref={labelRef} data-edge-label={id}
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${anchorX}px,${anchorY}px)`,
                        background: 'var(--c-14212a)',
                        padding: '8px 10px',
                        width: 'max-content',
                        maxWidth: '260px',
                        minWidth: '80px',
                        boxSizing: 'border-box',
                        overflowWrap: 'anywhere',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        border: '1px solid var(--c-30434f)',
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
                                    <span style={{ color: 'var(--c-dce6ec)' }}>{item.name}: {item.pct}%</span>
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
                            <div className="flow-label-details" key={itemId} style={{ marginTop: '4px', borderTop: '1px solid var(--c-293c47)', paddingTop: '2px', textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem', fontWeight: 600, color: item.color }}>
                                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: item.color }}></div>
                                    {item.name}
                                </div>
                                {props.wait > 0 && <div style={{ fontSize: '0.6rem', color: 'var(--c-9aadb9)' }}>Wait: {props.wait}m</div>}
                                {props.inventory && <div style={{ fontSize: '0.6rem', color: 'var(--c-9aadb9)' }}>Inv: {props.inventory}</div>}
                                {props.painPoint && <div style={{ fontSize: '0.6rem', color: 'var(--c-df9296)' }}>⚠ {props.painPoint}</div>}
                            </div>
                        );
                    })}
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

export default FlowEdge;
