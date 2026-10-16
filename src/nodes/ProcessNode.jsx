import React, { memo, useEffect, useContext } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { Paperclip, AlertTriangle, Plus, User, Workflow, Bot, Box, Trash2, Layers, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { getFile } from '../utils/db';
import { GroupUIContext } from '../store/groupContext';
import { displayNumber as fmt } from '../services/analysis';
import NodeResources from '../components/NodeResources';
import { useGraphState } from '../store/graphContext';

const ProcessNode = ({ id, data, selected, aggregate, ports, onOpenDetail }) => {
    const scoped = useGraphState();
    const groupUI = useContext(GroupUIContext);
    const { addNextNode, deleteNode } = scoped;
    const confirmDelete = (e) => {
        e.stopPropagation();
        if (scoped.scenarioScoped || window.confirm(`Supprimer l’étape « ${data.label || 'Étape'} » et ses connexions ? Vous pourrez annuler juste après.`)) deleteNode(id);
    };
    const vertical = useGraphState(s => s.orientation === 'vertical');
    const detailMode=useGraphState(s=>s.detailMode);
    const updateNodeInternals = useUpdateNodeInternals();
    // Handles move between left/right and top/bottom: React Flow must re-measure them.
    useEffect(() => { updateNodeInternals(id); }, [vertical, detailMode, id, updateNodeInternals]);
    const readOnly = useGraphState(s => s.readOnly);
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
        variantStyle = { border: '2px solid var(--c-8bb8cb)' }; // Thicker border for IT
    }

    if (subtype === 'ai') HeaderIcon = Bot;
    if (aggregate) HeaderIcon = Layers;

    // Global Color Scheme
    let nodeColor = 'var(--c-14212a)'; // Body is always white
    let borderColor = 'var(--c-30434f)';
    let headerBg = 'var(--c-8bb8cb)'; // Default Blue for Standard Steps
    let headerText = 'var(--c-14212a)';

    if (subtype === 'actor') {
        headerBg = 'var(--c-9fadb9)'; // Dark Grey for Actors
        borderColor = 'var(--c-9fadb9)';
    } else if (subtype === 'it') {
        headerBg = 'var(--c-b6a1d1)'; // Orange for IT
        borderColor = 'var(--c-b6a1d1)';
    } else {
        // Standard
        headerBg = 'var(--c-8bb8cb)'; // Blue
        borderColor = 'var(--c-8bb8cb)';
    }

    // Volume Rounding
    const totalVolume = rows => rows?.some(r => r.volume == null) ? null : rows?.reduce((sum, r) => sum + r.volume, 0);
    const displayVolume = aggregate ? fmt(totalVolume(aggregate.inputs)) : data.volume_in ? parseFloat(data.volume_in).toFixed(2) : '0.00';

    // ... (styles remain same)

    const tableStyle = {
        width: '100%',
        fontSize: '0.7rem',
        borderCollapse: 'collapse',
        marginTop: '0.5rem'
    };

    const cellStyle = {
        border: '1px solid var(--c-30434f)',
        padding: '2px 4px',
        textAlign: 'right'
    };

    const labelCellStyle = {
        ...cellStyle,
        textAlign: 'left',
        fontWeight: 500,
        color: 'var(--c-9fadb9)'
    };

    return (
        <div className="step-with-resources" data-layout={vertical ? 'side' : 'below'}><div className="process-card" data-kind={subtype}
            onDragOver={e => { if (readOnly) return; if (e.dataTransfer.types.includes("application/vsm-resource")) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "link"; } }}
            onDrop={e => { if (readOnly) return; const raw = e.dataTransfer.getData("application/vsm-resource"); if (raw) { e.preventDefault(); e.stopPropagation(); try { const resource = JSON.parse(raw); scoped.attachResource(id, resource.kind, resource.id); } catch { /* Ignore foreign drag data. */ } } }}
            style={{
                minWidth: '220px',
                minHeight: aggregate ? data.cardHeight : undefined,
                maxWidth: '400px',
                width: 'fit-content',
                background: nodeColor,
                color: 'var(--c-dce6ec)',
                border: `1px solid ${selected ? 'var(--c-8bb8cb)' : borderColor}`,
                borderRadius: subtype === 'actor' ? '16px' : '8px',
                fontSize: '0.8rem',
                boxShadow: selected ? '0 0 0 2px rgba(13, 110, 253, 0.25)' : '0 2px 4px rgba(0,0,0,0.05)',
                ...variantStyle,
                overflow: 'visible',
                position: 'relative',
            }}
        >
            {ports || <Handle
                type="target"
                position={vertical ? Position.Top : Position.Left}
                style={vertical
                    ? { background: 'var(--c-7e99a8)', width: '12px', height: '12px', top: '-6px', left: '50%', transform: 'translateX(-50%)' }
                    : { background: 'var(--c-7e99a8)', width: '12px', height: '12px', left: '-6px', top: '50%', transform: 'translateY(-50%)' }}
            />}

            {data.comparisonBadge && <span className="node-comparison-badge">{data.comparisonBadge}</span>}
            {/* Header */}
            <div className="process-header" style={{
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
                {aggregate && <button className="nodrag node-delete" aria-label="Propriétés du groupe" title="Renommer, dissocier et consulter les calculs" onClick={e => {e.stopPropagation();groupUI.inspect(id);}}><SlidersHorizontal size={13}/></button>}
                {!readOnly && !aggregate && <button className="nodrag node-delete" aria-label={data.positionLocked?'Déverrouiller la position':'Verrouiller la position'} title="Position verrouillée" onClick={e=>{e.stopPropagation();scoped.updateNodeData(id,{positionLocked:!data.positionLocked});}}>{data.positionLocked?'◆':'◇'}</button>}
                {!readOnly && !aggregate && <button type="button" className="node-delete nodrag" title="Supprimer l’étape" aria-label={`Supprimer l’étape ${data.label || ''}`} onClick={confirmDelete}>
                    <Trash2 size={12} />
                </button>}
            </div>

            {/* Body */}
            <div className="node-body" style={{ padding: '0.5rem' }}>
                {/* Volume Display */}
                <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{aggregate ? "Volume entrant :" : "Volume In:"}</span>
                    <span style={{ fontWeight: 700 }}>{displayVolume}</span>
                </div>
                {aggregate && <div className="aggregate-output"><span>Volume sortant :</span><strong>{fmt(totalVolume(aggregate.outputs))}</strong></div>}
                {data.description && (
                    <div style={{
                        fontSize: '0.75rem',
                        color: 'var(--c-9aadb9)',
                        marginBottom: '0.5rem',
                        fontStyle: 'italic',
                        borderBottom: '1px solid var(--c-293c47)',
                        paddingBottom: '0.25rem'
                    }}>
                        {data.description}
                    </div>
                )}

                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th style={{ ...cellStyle, textAlign: 'left', color: 'var(--c-9aadb9)', fontWeight: 500 }}>Item</th>
                            <th style={{ ...cellStyle, color: 'var(--c-9aadb9)', fontWeight: 500 }}>C/T</th>
                            <th style={{ ...cellStyle, color: 'var(--c-9aadb9)', fontWeight: 500 }}>Vol</th>
                            <th style={{ ...cellStyle, color: 'var(--c-9aadb9)', fontWeight: 500 }}>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {aggregate ? aggregate.categories.map(item => <tr key={item.category}>
                            <td style={{...cellStyle, textAlign:'left'}}>{item.name}</td>
                            <td style={cellStyle} title="Processing moyen du parcours interne, par dossier">{fmt(item.processing)}</td>
                            <td style={cellStyle}>{fmt(item.volume)}</td>
                            <td style={cellStyle}>{fmt(item.workload)}</td>
                        </tr>) : data.volumeStreamIn && data.volumeStreamIn.filter(i => i.value > 0).length > 0 ? (
                            data.volumeStreamIn.filter(i => i.value > 0).map(item => {
                                const ct = scoped.isDecomposition ? data.cycleTimes?.[item.id] ?? null : (data.cycleTimes || {})[item.id] || 0;
                                const procTime = ct == null ? null : item.value * ct;
                                return (
                                    <tr key={item.id}>
                                        <td style={{ ...cellStyle, textAlign: 'left' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.color }}></div>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60px' }} title={item.name}>{item.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...cellStyle, color: ct === 0 ? 'var(--c-df9296)' : 'inherit', fontWeight: ct === 0 ? 'bold' : 'inherit' }}>{fmt(ct)}</td>
                                        <td style={cellStyle}>{parseFloat(item.value).toFixed(2)}</td>
                                        <td style={cellStyle}>{procTime == null ? "Inconnu" : parseFloat(procTime).toFixed(2)}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="4" style={{ ...cellStyle, textAlign: 'center', color: 'var(--c-adb5bd)', fontStyle: 'italic' }}>No Volume</td>
                            </tr>
                        )}

                        <tr style={{ borderTop: '2px solid var(--c-30434f)' }}>
                            <td colSpan="3" style={{ ...labelCellStyle, fontWeight: 600 }}>{aggregate ? "Charge" : "Total Proc Time"}</td>
                            <td style={{ ...cellStyle, fontWeight: 600 }}>{aggregate ? fmt(aggregate.workload) : scoped.isDecomposition ? fmt(data.process_time_total) : Number(data.process_time_total || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
                        </tr>
                        {!aggregate && (data.executionMode === 'step' || subtype === 'standard' || subtype === 'ai') && (
                            <>
                                <tr>
                                    <td colSpan="3" style={labelCellStyle}>FTE Req</td>
                                    <td style={cellStyle}>{scoped.isDecomposition && data.process_time_total == null ? 'Inconnu' : data.fte_required || 0}</td>
                                </tr>
                                <tr>
                                    <td colSpan="3" style={labelCellStyle}>Util %</td>
                                    <td style={cellStyle}>{scoped.isDecomposition && data.process_time_total == null ? 'Inconnu' : `${data.utilization || 0}%`}</td>
                                </tr>
                            </>
                        )}
                        {aggregate && [['Processing / dossier', aggregate.processing], ['Attente / dossier', aggregate.waiting], ['Lead time / dossier', aggregate.lead]].map(([label,value]) => <tr key={label}><td colSpan="3" style={labelCellStyle}>{label}</td><td style={cellStyle}>{fmt(value)}</td></tr>)}
                    </tbody>
                </table>

            </div>

            <div className="node-operations">Volume : {displayVolume} · Charge : {aggregate ? fmt(aggregate.workload) : data.process_time_total} min</div>
            {aggregate && <div className="step-detail-action"><button className="nodrag" onClick={e => {e.stopPropagation(); onOpenDetail();}}><ChevronDown size={14}/>{aggregate.count} sous-étapes · Déplier</button>{!aggregate.complete && <small>Indicateurs incomplets · voir le détail</small>}</div>}
            {!aggregate && !readOnly && !scoped.isDecomposition && groupUI.decompose && <div className="step-detail-action step-detail-shortcut"><button className="nodrag" title="Détailler cette étape · double-clic sur la carte" onClick={e => {e.stopPropagation(); groupUI.decompose(id);}}><Layers size={14}/>Détailler cette étape</button></div>}
            {/* Attachments */}
            {hasAttachments && (
                <div style={{
                    padding: '0.5rem',
                    borderTop: `1px solid ${borderColor}`,
                    background: 'var(--c-0d171e)',
                    borderBottomLeftRadius: subtype === 'actor' ? '15px' : '7px',
                    borderBottomRightRadius: subtype === 'actor' ? '15px' : '7px',
                }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--c-9aadb9)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
                                    background: 'var(--c-fff9db)',
                                    border: '1px solid var(--c-ffe066)',
                                    borderRadius: '4px',
                                    padding: '2px 6px',
                                    fontSize: '0.7rem',
                                    color: 'var(--c-9fadb9)',
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
                    background: 'var(--c-14212a)',
                    borderRadius: '50%',
                    padding: '4px',
                    border: '1px solid var(--c-30434f)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                }}>
                    <Paperclip size={14} color="var(--c-9aadb9)" />
                </div>
            )}

            {/* Validation Warning Icon */}
            {data.errors && data.errors.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '-15px',
                    left: '-15px',
                    background: 'var(--c-14212a)',
                    borderRadius: '50%',
                    padding: '4px',
                    border: '1px solid var(--c-df9296)',
                    boxShadow: '0 1px 2px rgba(220, 53, 69, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10
                }} title={data.errors.join('\n')}>
                    <AlertTriangle size={14} color="var(--c-df9296)" />
                </div>
            )}

            {/* Quick Add Button */}
            {!readOnly && !aggregate && <button
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
                    background: 'var(--c-14212a)',
                    border: '1px solid var(--c-30434f)',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    zIndex: 10,
                    color: 'var(--c-9aadb9)'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--c-0d171e)';
                    e.currentTarget.style.color = 'var(--c-8bb8cb)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--c-14212a)';
                    e.currentTarget.style.color = 'var(--c-9aadb9)';
                }}
            >
                <Plus size={12} />
            </button>}

            {!aggregate && <Handle
                type="source"
                position={vertical ? Position.Bottom : Position.Right}
                style={vertical
                    ? { background: 'var(--c-7e99a8)', width: '12px', height: '12px', bottom: '-6px', left: '50%', transform: 'translateX(-50%)', top: 'auto' }
                    : { background: 'var(--c-7e99a8)', width: '12px', height: '12px', right: '-6px' }}
            />}
        </div><NodeResources id={id} data={data} provenance={aggregate?.resources} onOpenDetail={onOpenDetail}/></div>
    );
};

export default memo(ProcessNode);
