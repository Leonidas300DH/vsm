import React, { useCallback, useRef, useMemo, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useReactFlow
} from 'reactflow';

import useStore from '../store/useStore';
import { v4 as uuidv4 } from 'uuid';
import ProcessNode from '../nodes/ProcessNode';
import StartEndNode from '../nodes/StartEndNode';

import FlowEdge from '../edges/FlowEdge';

import { computeLineage } from '../utils/lineageUtils';
import { focusedNodeIds } from '../utils/focus';

const VSMCanvas = ({ onInspect }) => {
    const { screenToFlowPosition } = useReactFlow();
    const reactFlowWrapper = useRef(null);
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        addNode,
        selectedNodeId,
        setSelectedNodeId,
        setSelectedStepId,
        selectedItemId, // New
        focus,
        actors,
        theme
    } = useStore();
    const light = theme === 'light';
    const [hoveredNodeId, setHoveredNodeId] = useState(null);

    const nodeTypes = useMemo(() => ({
        process: ProcessNode,
        startEnd: StartEndNode,
    }), []);

    const edgeTypes = useMemo(() => ({
        flow: FlowEdge,
    }), []);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            const dataString = event.dataTransfer.getData('application/reactflow-data');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const data = dataString ? JSON.parse(dataString) : {};

            const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

            const newNode = {
                id: uuidv4(),
                type,
                position,
                data: { label: data.label || `${type} node`, ...data },
            };

            addNode(newNode);
        },
        [addNode, screenToFlowPosition]
    );

    // Hover & Selection Logic
    const onNodeMouseEnter = useCallback((_, node) => {
        setHoveredNodeId(node.id);
    }, []);

    const onNodeMouseLeave = useCallback(() => {
        setHoveredNodeId(null);
    }, []);

    const onNodeClick = useCallback((_, node) => {
        setSelectedNodeId(node.id);
        onInspect();
        if (node.type === 'process') {
            setSelectedStepId(node.id);
        } else {
            setSelectedStepId(null);
        }
    }, [setSelectedNodeId, setSelectedStepId, onInspect]);

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
        setSelectedStepId(null);
    }, [setSelectedNodeId, setSelectedStepId]);

    // Compute Upstream/Downstream
    const { upstreamNodes, downstreamNodes, upstreamEdges, downstreamEdges } = useMemo(() => {
        if (!selectedNodeId) return { upstreamNodes: [], downstreamNodes: [], upstreamEdges: [], downstreamEdges: [] };

        const upEdges = edges.filter(e => e.target === selectedNodeId);
        const upNodes = upEdges.map(e => e.source);

        const downEdges = edges.filter(e => e.source === selectedNodeId);
        const downNodes = downEdges.map(e => e.target);

        return {
            upstreamNodes: upNodes,
            downstreamNodes: downNodes,
            upstreamEdges: upEdges,
            downstreamEdges: downEdges
        };
    }, [selectedNodeId, edges]);

    // Compute Lineage (New)
    const lineageData = useMemo(() => {
        if (!selectedItemId) return null;
        return computeLineage(nodes, edges, selectedItemId);
    }, [selectedItemId, nodes, edges]);

    // Compute nodes and edges with classes
    // Focus on a resource: the steps using it stay lit, everything else dims.
    const focusIds = useMemo(() => focusedNodeIds(nodes, focus, { actors }), [nodes, focus, actors]);

    const displayNodes = useMemo(() => {
        return nodes.map(node => {
            let className = node.className || '';

            // Focus (overrides everything else)
            if (focus) {
                className += focusIds.has(node.id) ? ' node-lineage' : ' node-dimmed';
            }
            // Lineage Logic (Overrides selection and hover if active)
            else if (selectedItemId && lineageData) {
                if (lineageData.lineageNodeIds.includes(node.id)) {
                    className += ' node-lineage';
                } else {
                    className += ' node-dimmed';
                }
            }
            // Existing Selection/Hover Logic
            else if (selectedNodeId) {
                if (node.id === selectedNodeId) {
                    className += ' node-selected';
                } else if (upstreamNodes.includes(node.id)) {
                    className += ' node-upstream';
                } else if (downstreamNodes.includes(node.id)) {
                    className += ' node-downstream';
                }
            } else if (hoveredNodeId) {
                if (node.id === hoveredNodeId) {
                    className += ' node-hover';
                }
            }

            return { ...node, className };
        });
    }, [nodes, focus, focusIds, hoveredNodeId, selectedNodeId, upstreamNodes, downstreamNodes, selectedItemId, lineageData]);

    const displayEdges = useMemo(() => {
        return edges.map(edge => {
            let className = (edge.className || '') + ' edge-flow';

            // Focus: only connections between two focused steps stay lit
            if (focus) {
                className += focusIds.has(edge.source) && focusIds.has(edge.target) ? ' edge-lineage' : ' edge-dimmed';
            }
            // Lineage Logic
            else if (selectedItemId && lineageData) {
                if (lineageData.lineageEdgeIds.includes(edge.id)) {
                    className += ' edge-lineage';
                } else {
                    className += ' edge-dimmed';
                }
            }
            // Existing Selection/Hover Logic
            else if (selectedNodeId) {
                if (upstreamEdges.some(e => e.id === edge.id)) {
                    className += ' edge-upstream';
                } else if (downstreamEdges.some(e => e.id === edge.id)) {
                    className += ' edge-downstream';
                }
            } else if (hoveredNodeId) {
                if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) {
                    className += ' edge-highlight';
                }
            }

            return { ...edge, className };
        });
    }, [edges, focus, focusIds, hoveredNodeId, selectedNodeId, upstreamEdges, downstreamEdges, selectedItemId, lineageData]);

    return (
        <div
            ref={reactFlowWrapper}
            style={{
                width: '100%',
                height: '100%',
                '--lineage-color': focus ? 'var(--c-8bb8cb)' : (lineageData?.itemColor || 'var(--c-7a3e9d)')
            }}
        >
            <ReactFlow
                nodes={displayNodes}
                edges={displayEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onNodeMouseEnter={onNodeMouseEnter}
                onNodeMouseLeave={onNodeMouseLeave}
                onNodeClick={onNodeClick}
                onEdgeClick={onInspect}
                minZoom={0.15}
                maxZoom={2}
                fitViewOptions={{ padding: 0.15 }}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'flow', markerEnd: { type: 'arrowclosed' } }}
                fitView
            >
                <Background color={light ? '#c4d1da' : '#2b404d'} gap={24} size={1} />
                <Controls />
                <MiniMap pannable zoomable nodeColor={light ? '#8fa9b8' : '#496877'} maskColor={light ? 'rgba(236, 241, 245, 0.7)' : 'rgba(9, 16, 22, 0.65)'} />
            </ReactFlow>
        </div>
    );
};

export default VSMCanvas;
