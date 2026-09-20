import React, { useLayoutEffect, useRef, useMemo } from 'react';
import useStore from '../store/useStore';
import { placeEdgeLabels } from '../utils/edgeRouting';
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
    const nodes = useStore(s => s.nodes);
    const edges = useStore(s => s.edges);
    const sizes = useStore(s => s.edgeLabelSizes);
    const labelRef = useRef(null);
    useLayoutEffect(() => {
        const element = labelRef.current;
        const observer = new ResizeObserver(() => {
            const width = element.offsetWidth, height = element.offsetHeight;
            const current = useStore.getState().edgeLabelSizes[id];
            if (current?.width !== width || current?.height !== height || current?.anchorX !== anchorX || current?.anchorY !== anchorY) useStore.setState(s => ({ edgeLabelSizes: { ...s.edgeLabelSizes, [id]: {width,height,anchorX,anchorY} } }));
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [id,anchorX,anchorY]);
    const boxes = useMemo(() => placeEdgeLabels(nodes,edges,sizes), [nodes,edges,sizes]);
    const box = useMemo(() => boxes[id] || {x:(sourceX+targetX)/2-130,y:(sourceY+targetY)/2-90,width:260,height:180}, [boxes,id,sourceX,targetX,sourceY,targetY]);

    const edgeStyle = {
        ...style,
        stroke: data?.isError ? '#df9296' : (style.stroke || '#67818f'),
        strokeWidth: data?.isError ? 2 : (style.strokeWidth || 1.5),
    };

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} />
            <EdgeLabelRenderer>
                <div ref={labelRef} data-edge-label={id}
                    style={{
                        position: 'absolute',
                        transform: `translate(${box.x}px,${box.y}px)`,
                        background: '#14212a',
                        padding: '8px 10px',
                        width: 'max-content',
                        maxWidth: '260px',
                        minWidth: '80px',
                        boxSizing: 'border-box',
                        overflowWrap: 'anywhere',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        border: '1px solid #30434f',
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
                                    <span style={{ color: '#dce6ec' }}>{item.name}: {item.pct}%</span>
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
                            <div key={itemId} style={{ marginTop: '4px', borderTop: '1px solid #293c47', paddingTop: '2px', textAlign: 'left' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem', fontWeight: 600, color: item.color }}>
                                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: item.color }}></div>
                                    {item.name}
                                </div>
                                {props.wait > 0 && <div style={{ fontSize: '0.6rem', color: '#9aadb9' }}>Wait: {props.wait}m</div>}
                                {props.inventory && <div style={{ fontSize: '0.6rem', color: '#9aadb9' }}>Inv: {props.inventory}</div>}
                                {props.painPoint && <div style={{ fontSize: '0.6rem', color: '#df9296' }}>⚠ {props.painPoint}</div>}
                            </div>
                        );
                    })}
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

export default FlowEdge;
