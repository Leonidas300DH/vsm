

/**
 * Extracts all unique items from the nodes, mapping ID to Name.
 * Scans volumeStreams, volumeStreamIn, volumeStreamOut.
 * @param {Array} nodes - The list of nodes.
 * @returns {Array} - Array of { id, name } objects.
 */
export const extractAllItems = (nodes) => {
    const itemsMap = new Map();

    nodes.forEach(node => {
        // Helper to add items from a stream array
        const addFromStream = (stream) => {
            if (Array.isArray(stream)) {
                stream.forEach(item => {
                    if (item.id && item.name) {
                        // Store name and color. Prefer existing color if already set.
                        const existing = itemsMap.get(item.id);
                        if (!existing || (!existing.color && item.color)) {
                            itemsMap.set(item.id, { name: item.name, color: item.color });
                        }
                    }
                });
            }
        };

        // 1. Volume Streams (Start Nodes)
        addFromStream(node.data.volumeStreams);

        // 2. Calculated Streams (Process Nodes)
        addFromStream(node.data.volumeStreamIn);
        addFromStream(node.data.volumeStreamOut);

        // Note: We rely on streams to define the ID->Name mapping.
        // cycleTimes and volumes keys are IDs, but they don't have names attached directly in that object.
    });

    return Array.from(itemsMap.entries()).map(([id, data]) => ({ id, name: data.name, color: data.color }));
};

/**
 * Computes the lineage for a selected item ID.
 * @param {Array} nodes - All nodes.
 * @param {Array} edges - All edges.
 * @param {string} selectedItemId - The ID of the selected item.
 * @returns {Object} - Lineage data including entryNodes, steps, exitNodes, and IDs for highlighting.
 */
export const computeLineage = (nodes, edges, selectedItemId, tools = []) => {
    if (!selectedItemId) return null;

    // Get Item Name and Color
    const allItems = extractAllItems(nodes);
    const itemData = allItems.find(i => i.id === selectedItemId);
    const selectedItemName = itemData?.name || selectedItemId;
    const selectedItemColor = itemData?.color || '#7A3E9D'; // Default to purple if no color

    // 1. Identify Start Nodes (Sources) that initiate this item
    // These are nodes with volumeStreams OR volumeItems containing the item AND volume > 0
    const startNodes = nodes.filter(n =>
        (n.data.volumeStreams?.some(v => v.id === selectedItemId && v.value > 0)) ||
        (n.data.volumeItems?.some(v => v.id === selectedItemId && v.percentage > 0)) // Assuming percentage/value > 0 for volumeItems
    );

    // 2. Traverse the graph to find the full path (BFS)
    const visitedNodeIds = new Set();
    const visitedEdgeIds = new Set();
    const queue = [...startNodes];

    startNodes.forEach(n => visitedNodeIds.add(n.id));

    while (queue.length > 0) {
        const currentNode = queue.shift();

        // Find outgoing edges
        const outgoingEdges = edges.filter(e => e.source === currentNode.id);

        outgoingEdges.forEach(edge => {
            const routing = edge.data?.routing || {};
            // Check if this edge carries the item (by ID or Name)
            // AND if the routing percentage is > 0
            const routingData = routing[selectedItemId] || routing[selectedItemName];

            // Relaxed condition: If the current node is part of the lineage, and we are flowing out,
            // assume the item flows if no specific routing excludes it (or if it's a simple flow).
            // For now, let's trust the routing if present, but if the edge has NO routing data at all, maybe we should follow it?
            // Better approach: If we are at a node that has this item, and there is an edge to another node,
            // check if that target node ALSO has the item. If so, this edge is part of the path.

            const targetNode = nodes.find(n => n.id === edge.target);
            const targetHasItem = targetNode && (
                (targetNode.data.volumeStreams?.some(v => v.id === selectedItemId && v.value > 0)) ||
                (targetNode.data.volumeStreamIn?.some(v => v.id === selectedItemId && v.value > 0)) ||
                (targetNode.data.volumeStreamOut?.some(v => v.id === selectedItemId && v.value > 0)) ||
                (targetNode.data.cycleTimes && selectedItemId in targetNode.data.cycleTimes) || // Cycle time implies presence, but volume check below is stricter
                (targetNode.data.volumes && selectedItemId in targetNode.data.volumes && targetNode.data.volumes[selectedItemId] > 0) ||
                // Special case for End nodes which might not have volumeStreamIn calculated yet or structured differently
                (targetNode.type === 'startEnd' && targetNode.data.type === 'end')
            );

            // If explicit routing exists, it MUST be > 0. If no routing, rely on target node having the item > 0.
            const shouldFollow = (routingData !== undefined) ? (Number(routingData.percent) > 0) : targetHasItem;

            if (shouldFollow) {
                visitedEdgeIds.add(edge.id);

                if (targetNode && !visitedNodeIds.has(targetNode.id)) {
                    visitedNodeIds.add(targetNode.id);
                    queue.push(targetNode);
                }
            }
        });
    }

    // If no start nodes found (e.g. item starts mid-process?), fall back to finding all nodes with item data
    // This handles cases where the item might be introduced later or the graph is disconnected
    if (visitedNodeIds.size === 0) {
        const itemNodesFallback = nodes.filter(n =>
            (n.data.volumeStreams?.some(v => v.id === selectedItemId && v.value > 0)) ||
            (n.data.volumeItems?.some(v => v.id === selectedItemId && v.percentage > 0)) ||
            (n.data.volumeStreamIn?.some(v => v.id === selectedItemId && v.value > 0)) ||
            (n.data.volumeStreamOut?.some(v => v.id === selectedItemId && v.value > 0)) ||
            // Cycle time alone is not enough if volume is 0
            (n.data.volumes && selectedItemId in n.data.volumes && n.data.volumes[selectedItemId] > 0)
        );
        itemNodesFallback.forEach(n => visitedNodeIds.add(n.id));

        // Also find edges connecting these fallback nodes
        const fallbackEdges = edges.filter(e =>
            visitedNodeIds.has(e.source) && visitedNodeIds.has(e.target)
        );

        fallbackEdges.forEach(e => {
            const routing = e.data?.routing || {};
            const routingData = routing[selectedItemId] || routing[selectedItemName];
            // Only include edge if it has routing > 0 OR if it has no routing data (implicit flow between valid nodes)
            if (routingData === undefined || Number(routingData.percent) > 0) {
                visitedEdgeIds.add(e.id);
            }
        });
    }

    const lineageNodeIds = Array.from(visitedNodeIds);
    const lineageEdgeIds = Array.from(visitedEdgeIds);

    // 3. Sort Nodes by X-Coordinate (Left-to-Right)
    // We need the node objects to access position
    const lineageNodes = lineageNodeIds.map(id => nodes.find(n => n.id === id)).filter(Boolean);
    lineageNodes.sort((a, b) => a.position.x - b.position.x);
    const orderedNodeIds = lineageNodes.map(n => n.id);

    // 4. Build Detailed Lineage Object
    const getNodeDetail = (nodeId) => {
        const n = nodes.find(node => node.id === nodeId);
        if (!n) return null;

        const cycleTime = n.data.cycleTimes?.[selectedItemId] || 0;

        // Determine Colors
        let color = '#a5aeb8'; // Standard process
        let borderColor = '#a5aeb8';
        let bgColor = '#ffffff';

        if (n.type === 'process') {
            if (n.data.subtype === 'actor') {
                color = '#f5a454';
                borderColor = '#f5a454';
            } else if (n.data.subtype === 'ai') {
                color = '#4bafff';
                borderColor = '#4bafff';
            } else if (n.data.subtype === 'it') {
                color = '#53cf91';
                borderColor = '#53cf91';
            }
        } else if (n.type === 'startEnd') {
            // Check data.type instead of subtype for StartEndNode
            if (n.data.type === 'start') {
                color = '#198754';
                borderColor = '#198754';
                bgColor = '#d1e7dd';
            } else {
                color = '#dc3545';
                borderColor = '#dc3545';
                bgColor = '#f8d7da';
            }
        }

        // Calculate Volume at Node
        let volume = 0;
        if (n.type === 'startEnd' && n.data.type === 'start') {
            const startItem = n.data.volumeItems?.find(v => v.id === selectedItemId);
            if (startItem) {
                volume = startItem.value || startItem.percentage || 0;
            } else {
                const streamItem = n.data.volumeStreams?.find(v => v.id === selectedItemId);
                if (streamItem) volume = streamItem.value;
            }
        } else {
            // For Process/End nodes, check volumeStreamOut (calculated)
            const streamItem = (n.data.volumeStreamOut || []).find(v => v.id === selectedItemId);
            if (streamItem) {
                volume = streamItem.value;
            } else {
                // Fallback to volumes map if stream is missing (legacy/fallback)
                volume = n.data.volumes?.[selectedItemId] || 0;
            }
        }

        // Resolve Tool Names
        const toolNames = (n.data.toolsUsed || []).map(toolId => {
            const tool = tools.find(t => String(t.id) === String(toolId));
            return tool ? tool.name : `Unknown (${toolId})`;
        });

        return {
            nodeId: n.id,
            label: n.data.label,
            type: n.type,
            subtype: n.data.subtype || n.data.type, // Fallback for startEnd
            cycleTime: cycleTime,
            volume: volume,
            processingTime: cycleTime * volume,
            tools: toolNames, // Now returns names
            itSystems: n.data.itSystems || [],
            actors: n.data.actors || [],
            attachments: n.data.attachments || [],
            color,
            borderColor,
            bgColor
        };
    };

    const getEdgeDetail = (edge) => {
        // 1. Try to get calculated data from volumeStream (Source of Truth from calculations.js)
        const edgeStream = edge.data?.volumeStream || [];
        const itemData = edgeStream.find(i => i.id === selectedItemId);

        let percent = null;
        let volume = null;

        if (itemData) {
            percent = itemData._calculatedPct !== undefined ? Number(itemData._calculatedPct) : null;
            volume = itemData.value !== undefined ? Number(itemData.value) : null;
        }

        // 2. Fallback: Calculate from Routing Data if volumeStream is missing
        if (percent === null) {
            const itemRouting = edge.data?.itemRouting || {};
            const globalRouting = edge.data?.routing || {};

            // Check itemRouting first, then global routing
            let routingVal = itemRouting[selectedItemId];
            if (routingVal === undefined) {
                routingVal = globalRouting[selectedItemId] || globalRouting[selectedItemName]?.percent;
            }

            percent = routingVal !== undefined ? Number(routingVal) : null;

            // Calculate Volume on Edge
            // We need the source node's volume for this item to calculate the edge volume
            const sourceNode = nodes.find(n => n.id === edge.source);
            let sourceVolume = 0;
            if (sourceNode) {
                // Try volumeStreamOut first (calculated)
                const streamItem = (sourceNode.data.volumeStreamOut || []).find(v => v.id === selectedItemId);
                if (streamItem) {
                    sourceVolume = streamItem.value;
                } else {
                    // Fallback to volumes map
                    sourceVolume = sourceNode.data.volumes?.[selectedItemId] || 0;
                }

                // If 0, check start node specific locations
                if (sourceVolume === 0 && sourceNode.type === 'startEnd' && sourceNode.data.type === 'start') {
                    const startItem = sourceNode.data.volumeItems?.find(v => v.id === selectedItemId);
                    if (startItem) sourceVolume = startItem.value || 0;
                }
            }

            volume = percent !== null ? (sourceVolume * (percent / 100)) : null;
        }

        const itemProps = edge.data?.itemData?.[selectedItemId] || {};

        return {
            edgeId: edge.id,
            source: edge.source,
            target: edge.target,
            targetLabel: nodes.find(n => n.id === edge.target)?.data?.label || 'Unknown',
            routing: percent !== null ? Number(percent.toFixed(1)) : null, // Format for display
            volume: volume !== null ? Number(volume.toFixed(2)) : null, // Format for display
            waitTime: itemProps.wait || null,
            inventory: itemProps.inventory || null,
            painPoint: itemProps.painPoint || null,
        };
    };

    const allSteps = orderedNodeIds.map(nodeId => ({
        ...getNodeDetail(nodeId),
        incomingEdges: edges // Use all edges to find connections within lineage
            .filter(e => lineageEdgeIds.includes(e.id) && e.target === nodeId)
            .map(getEdgeDetail),
        outgoingEdges: edges
            .filter(e => lineageEdgeIds.includes(e.id) && e.source === nodeId)
            .map(getEdgeDetail),
    }));

    // Filter Steps: Only Process Nodes
    const processSteps = allSteps.filter(s => s.type === 'process');

    // Identify Start and End nodes (Triggers)
    // Entry Nodes: Must be type 'startEnd' and data.type 'start'
    const entryNodes = lineageNodes.filter(n => n.type === 'startEnd' && n.data.type === 'start').map(n => getNodeDetail(n.id)); // Map to full detail to get volume

    // Exit Nodes: Must be type 'startEnd' and data.type 'end'
    const exitNodes = lineageNodes.filter(n => n.type === 'startEnd' && n.data.type === 'end').map(n => getNodeDetail(n.id));

    return {
        item: selectedItemName,
        itemId: selectedItemId,
        itemColor: selectedItemColor,
        entryNodes: entryNodes, // Now returning objects, not just IDs
        steps: processSteps,
        exitNodes: exitNodes, // Now returning objects
        lineageNodeIds: lineageNodeIds,
        lineageEdgeIds: lineageEdgeIds
    };
};
