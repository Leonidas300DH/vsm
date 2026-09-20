
import React, { useState } from 'react';
import useStore from '../store/useStore';
import { Wrench, Activity, BarChart3, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const Timeline = ({ collapsed, onToggle }) => {
    const { metrics, nodes, edges, tools, selectedStepId, setSelectedStepId, setSelectedNodeId } = useStore();
    const [activeTab, setActiveTab] = useState('flow');



    // Filter for Process nodes only, sorted by X position
    const processNodes = nodes
        .filter(n => n.type === 'process')
        .sort((a, b) => a.position.x - b.position.x);

    // Build Timeline Steps (Interleaving Wait and Process)
    const timelineSteps = [];

    processNodes.forEach(node => {
        // 1. Check for Incoming Edges (Wait/Inventory)
        const incomingEdges = edges.filter(e => e.target === node.id);
        let totalWait = 0;
        let inventoryText = [];

        incomingEdges.forEach(edge => {
            const itemData = edge.data?.itemData || {};
            Object.values(itemData).forEach(props => {
                totalWait += (parseFloat(props.wait) || 0);
                if (props.inventory) inventoryText.push(props.inventory);
            });
        });

        if (totalWait > 0 || inventoryText.length > 0) {
            timelineSteps.push({
                type: 'wait',
                id: `wait - ${node.id} `,
                value: totalWait,
                label: 'Wait',
                details: inventoryText.join(', '),
                color: 'var(--c-cfb77a)'
            });
        }

        // 2. Add Process Step or Actor/IT Wait Step
        const isActorOrIT = node.data.executionMode !== 'step' && (node.data.subtype === 'actor' || node.data.subtype === 'it');
        if (!isActorOrIT && node.data.executionMode === 'step' && Number(node.data.wait_time) > 0) timelineSteps.push({ type:'wait', id:`node-wait-${node.id}`, value:Number(node.data.wait_time), label:node.data.label, details:'Attente', color:'var(--c-f5a454)' });

        if (isActorOrIT) {
            // Treat Actor/IT as a Wait Step
            const waitTime = parseFloat(node.data.wait_time || 0);
            if (waitTime > 0) {
                timelineSteps.push({
                    type: 'wait',
                    id: node.id,
                    value: waitTime,
                    label: node.data.label, // Use node label (e.g. "User Action")
                    details: 'Wait Time',
                    color: node.data.subtype === 'it' ? 'var(--c-53cf91)' : 'var(--c-f5a454)' // Orange (IT) or Dark Grey (Actor)
                });
            }
        } else {
            // Standard Process Step
            const usedTools = (node.data.toolsUsed || []).map(tId => tools.find(t => t.id === tId)).filter(Boolean);
            timelineSteps.push({
                type: 'process',
                id: node.id,
                value: node.data.process_time_total || 0,
                label: node.data.label,
                color: ({ ai:'var(--c-4bafff)', it:'var(--c-53cf91)', actor:'var(--c-f5a454)' })[node.data.subtype] || 'var(--c-a5aeb8)',
                tools: usedTools
            });
        }
    });

    // Build Tool Summary Data
    const toolSummary = tools.map(tool => {
        const usage = processNodes.filter(n => (n.data.toolsUsed || []).includes(tool.id));
        const totalTime = usage.reduce((sum, n) => sum + (n.data.process_time_total || 0), 0);
        return {
            ...tool,
            usageCount: usage.length,
            totalTime,
            steps: usage.map(n => n.data.label)
        };
    }).filter(t => t.usageCount > 0);

    // Build Pain Points List
    const painPoints = [];
    edges.forEach(edge => {
        const itemData = edge.data?.itemData || {};
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        Object.entries(itemData).forEach(([itemId, props]) => {
            if (props.painPoint) {
                const item = sourceNode?.data?.volumeStreamOut?.find(i => i.id === itemId);
                painPoints.push({
                    id: `${edge.id} -${itemId} `,
                    description: props.painPoint,
                    location: `${sourceNode?.data?.label || 'Unknown'} → ${targetNode?.data?.label || 'Unknown'} `,
                    item: item?.name || 'Unknown Item',
                    color: item?.color || 'var(--c-dce6ec)'
                });
            }
        });
    });

    return (
        <div className={`analysis-panel ${collapsed ? 'is-collapsed' : ''}`} style={{
            height: collapsed ? 36 : 'var(--footer-height)',
            background: 'var(--color-surface)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10,
            flexShrink: 0,
            minHeight: 0,
            width: '100%'
        }}>
            <div className="analysis-summary">
                <button onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Déplier l’analyse' : 'Replier l’analyse'}>{collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />} Analyse</button>
                <div><span>Processing time <strong>{metrics.totalProcessTime} min</strong></span><span>Attente <strong>{metrics.totalLeadTime - metrics.totalProcessTime} min</strong></span><span>Lead time <strong>{metrics.totalLeadTime} min</strong></span></div>
            </div>
            {/* Tabs Header */}
            <div className="analysis-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--c-0d171e)' }}>
                <button
                    onClick={() => setActiveTab('flow')}
                    style={{
                        padding: '0.5rem 1rem',
                        border: 'none',
                        background: activeTab === 'flow' ? 'var(--c-14212a)' : 'transparent',
                        borderBottom: activeTab === 'flow' ? '2px solid var(--color-primary)' : 'none',
                        color: activeTab === 'flow' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Activity size={14} /> Process Flow
                </button>
                <button
                    onClick={() => setActiveTab('tools')}
                    style={{
                        padding: '0.5rem 1rem',
                        border: 'none',
                        background: activeTab === 'tools' ? 'var(--c-14212a)' : 'transparent',
                        borderBottom: activeTab === 'tools' ? '2px solid var(--color-primary)' : 'none',
                        color: activeTab === 'tools' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Wrench size={14} /> Tool Usage
                </button>
                <button
                    onClick={() => setActiveTab('painPoints')}
                    style={{
                        padding: '0.5rem 1rem',
                        border: 'none',
                        background: activeTab === 'painPoints' ? 'var(--c-14212a)' : 'transparent',
                        borderBottom: activeTab === 'painPoints' ? '2px solid var(--color-primary)' : 'none',
                        color: activeTab === 'painPoints' ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <AlertTriangle size={14} /> Pain Points
                </button>

                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingRight: '1rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)', gap: '1rem' }}>
                    <span>Total Lead Time: <strong style={{ color: 'var(--color-text)' }}>{metrics.totalLeadTime}m</strong></span>
                    <span>Process Time: <strong style={{ color: 'var(--color-text)' }}>{metrics.totalProcessTime}m</strong></span>
                    <span>Wait: <strong style={{ color: 'var(--color-warning)' }}>{metrics.totalLeadTime - metrics.totalProcessTime}m</strong></span>
                    <span>Efficiency: <strong style={{ color: 'var(--color-primary)' }}>{metrics.efficiency}%</strong></span>
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, padding: '1rem', overflow: 'auto', background: 'var(--c-14212a)' }}>
                {activeTab === 'flow' && (
                    <div style={{ height: '100%', position: 'relative', minWidth: 'fit-content' }}>
                        {timelineSteps.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                                Add Process nodes to see the Sawtooth Diagram.
                            </div>
                        ) : (
                            <svg width={Math.max(timelineSteps.length * 120 + 80, 600)} height="100%">
                                {timelineSteps.map((step, index) => {
                                    const x = index * 120 + 40;
                                    const yBase = 80;
                                    const isProcess = step.type === 'process';
                                    const height = isProcess ? 40 : 0;
                                    const width = 80;

                                    return (
                                        <g
                                            key={step.id}
                                            onClick={() => {
                                                if (step.type === 'process') {
                                                    setSelectedNodeId(step.id);
                                                    setSelectedStepId(step.id);
                                                }
                                            }}
                                            style={{ cursor: step.type === 'process' ? 'pointer' : 'default' }}
                                        >
                                            {/* Selection Highlight */}
                                            {step.id === selectedStepId && (
                                                <>
                                                    <rect x={x} y={yBase - height} width={width} height={height} fill="rgba(0, 140, 255, 0.1)" />
                                                    <line x1={x} y1={yBase} x2={x + width} y2={yBase} stroke="var(--c-008cff)" strokeWidth="3" />
                                                </>
                                            )}

                                            {/* Connection Line */}
                                            {index < timelineSteps.length - 1 && (
                                                <line x1={x + width} y1={yBase} x2={x + 120} y2={yBase} stroke="var(--c-30434f)" strokeWidth="2" />
                                            )}

                                            {/* Step Line */}
                                            <polyline
                                                points={`${x},${yBase} ${x},${yBase - height} ${x + width},${yBase - height} ${x + width},${yBase} `}
                                                fill="none"
                                                stroke={step.color}
                                                strokeWidth="2"
                                            />

                                            {/* Label (Bottom) */}
                                            <text x={x + width / 2} y={yBase + 20} textAnchor="middle" fontSize="10" fill={step.id === selectedStepId ? "var(--c-008cff)" : "var(--c-9fadb9)"} fontWeight="600" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>
                                                {step.label.length > 12 ? step.label.substring(0, 10) + '...' : step.label}
                                            </text>

                                            {/* Tools Used (Below Label) */}
                                            {isProcess && step.tools && step.tools.length > 0 && (
                                                <g>
                                                    <text x={x + width / 2} y={yBase + 35} textAnchor="middle" fontSize="8" fill="var(--c-9aadb9)">
                                                        Tools:
                                                    </text>
                                                    {step.tools.map((t, i) => (
                                                        <text key={i} x={x + width / 2} y={yBase + 45 + (i * 10)} textAnchor="middle" fontSize="8" fill="var(--c-8bb8cb)">
                                                            {t.name}
                                                        </text>
                                                    ))}
                                                </g>
                                            )}

                                            {/* Value (Top) */}
                                            <text x={x + width / 2} y={yBase - height - 5} textAnchor="middle" fontSize="10" fontWeight="bold" fill={step.color}>
                                                {step.value}m
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        )}
                    </div>
                )}

                {activeTab === 'tools' && (
                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        {toolSummary.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--c-adb5bd)', fontStyle: 'italic', marginTop: '2rem' }}>
                                No tools are currently assigned to any process steps.
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--c-30434f)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--c-9fadb9)' }}>Tool Name</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--c-9fadb9)' }}>Used In Steps</th>
                                        <th style={{ textAlign: 'right', padding: '0.5rem', color: 'var(--c-9fadb9)' }}>Total Process Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {toolSummary.map(tool => (
                                        <tr key={tool.id} style={{ borderBottom: '1px solid var(--c-293c47)' }}>
                                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Wrench size={14} color="var(--c-9aadb9)" />
                                                    {tool.name}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                                                    {tool.steps.map((step, i) => (
                                                        <span key={i} style={{ background: 'var(--c-293c47)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                                            {step}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                                                {tool.totalTime} mins
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === 'painPoints' && (
                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        {painPoints.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--c-adb5bd)', fontStyle: 'italic', marginTop: '2rem' }}>
                                No pain points identified in the value stream.
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--c-30434f)' }}>
                                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--c-9fadb9)' }}>Pain Point</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--c-9fadb9)' }}>Location (Flow)</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--c-9fadb9)' }}>Item</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {painPoints.map(pp => (
                                        <tr key={pp.id} style={{ borderBottom: '1px solid var(--c-293c47)' }}>
                                            <td style={{ padding: '0.5rem', fontWeight: 600, color: 'var(--c-df9296)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <AlertTriangle size={14} />
                                                    {pp.description}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                {pp.location}
                                            </td>
                                            <td style={{ padding: '0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: pp.color }}></div>
                                                    {pp.item}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Timeline;
