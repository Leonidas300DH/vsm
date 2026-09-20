// Older projects retain their information-only actor/IT semantics.
const isSupport = node => node.data.executionMode !== 'step' && ['actor', 'it'].includes(node.data.subtype);

/**
 * Performs a forward pass calculation on the VSM graph.
 * 
 * @param {Array} nodes 
 * @param {Array} edges 
 * @returns {Object} { nodes, edges } with updated metrics
 */
export const calculateMetrics = (nodes, edges) => {
    // Create maps for easier access
    const nodeMap = new Map(nodes.map(n => [n.id, { ...n, data: { ...n.data } }]));
    const edgeMap = new Map(edges.map(e => [e.id, { ...e, data: { ...e.data } }]));

    // 1. Build adjacency list and in-degree for Topological Sort
    const adj = {};
    const inDegree = {};

    nodes.forEach(n => {
        adj[n.id] = [];
        inDegree[n.id] = 0;
        // Initialize volume streams on the working copy, never on the input
        const copy = nodeMap.get(n.id);
        copy.data.volumeStreamIn = [];
        copy.data.volumeStreamOut = [];
    });

    // Edges pointing to an unknown node are reported, never traversed.
    const validEdges = [];
    edges.forEach(e => {
        const edge = edgeMap.get(e.id);
        edge.data.isError = false;
        edge.data.volumeStream = [];
        if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) {
            edge.data.isError = true;
            edge.data.label = 'Missing step';
            edge.data.volume = '0.0';
            return;
        }
        validEdges.push(e);
        adj[e.source].push(e);
        inDegree[e.target]++;
    });

    // 2. Topological Sort (Kahn's Algorithm)
    const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
    const sortedOrder = [];

    while (queue.length > 0) {
        const u = queue.shift();
        sortedOrder.push(u);

        if (adj[u]) {
            adj[u].forEach(e => {
                inDegree[e.target]--;
                if (inDegree[e.target] === 0) {
                    queue.push(e.target);
                }
            });
        }
    }

    // 3. Propagate Volume and Calculate Metrics
    sortedOrder.forEach(nodeId => {
        const node = nodeMap.get(nodeId);

        // --- Input Volume Calculation ---
        let inputStream = [];

        if (node.type === 'startEnd' && node.data.type === 'start') {
            // Start Node: Use defined volume items
            inputStream = (node.data.volumeItems || []).map(item => ({
                ...item,
                value: parseFloat(item.value || 0)
            }));
        } else {
            // Other Nodes: Sum incoming streams
            const incomingEdges = validEdges.filter(e => e.target === nodeId);
            const itemMap = new Map();

            incomingEdges.forEach(e => {
                const edge = edgeMap.get(e.id);
                (edge.data.volumeStream || []).forEach(item => {
                    if (!itemMap.has(item.id)) {
                        itemMap.set(item.id, { ...item, value: 0 });
                    }
                    itemMap.get(item.id).value += item.value;
                });
            });
            inputStream = Array.from(itemMap.values());
        }

        node.data.volumeStreamIn = inputStream;
        // Calculate total volume for display
        node.data.volume_in = inputStream.reduce((sum, item) => sum + item.value, 0);


        // --- Process Metrics Calculation ---
        if (node.type === 'process') {
            if (isSupport(node)) {
                // Actor / IT: No process time, no FTE
                node.data.process_time_total = 0;
                node.data.fte_required = 0;
                node.data.utilization = 0;
            } else {
                // Standard Process
                const cycleTimes = node.data.cycleTimes || {};
                const availableTime = parseFloat(node.data.availableTime || 480);

                // Total Process Time = Sum(Item Volume * Item Cycle Time)
                const totalProcessTime = inputStream.reduce((sum, item) => {
                    const ct = parseFloat(cycleTimes[item.id] || 0);
                    return sum + (item.value * ct);
                }, 0);

                node.data.process_time_total = totalProcessTime;

                const fte = availableTime > 0 ? (totalProcessTime / availableTime) : 0;
                node.data.fte_required = parseFloat(fte.toFixed(2));
                node.data.utilization = availableTime > 0 ? ((totalProcessTime / availableTime) * 100).toFixed(1) : 0;
            }

            // --- Validation: Incomplete Data ---
            const errors = [];
            if (!isSupport(node)) {
                const hasIncompleteItems = inputStream.some(item => item.value > 0 && parseFloat(node.data.cycleTimes?.[item.id] || 0) === 0);
                if (hasIncompleteItems) {
                    errors.push("Missing cycle time for active items.");
                }
            }

            // --- Validation: Disconnected (Skip for Actor/IT) ---
            if (!isSupport(node)) {
                // Check incoming edges
                const incomingEdgeCount = validEdges.filter(e => e.target === nodeId).length;
                if (incomingEdgeCount === 0) {
                    errors.push("No incoming flow (disconnected).");
                }

                // Check outgoing edges
                const outgoingEdgeCount = (adj[nodeId] || []).length;
                if (outgoingEdgeCount === 0) {
                    errors.push("No outgoing flow (dead end).");
                }
            }

            node.data.errors = errors;
        }

        // --- Output Volume & Routing ---
        // For now, output = input (no scrap/reduction yet)
        node.data.volumeStreamOut = inputStream.map(item => ({ ...item }));

        if (adj[nodeId] && adj[nodeId].length > 0) {
            const allOutgoingEdges = adj[nodeId];

            // 1. Separate Information Flows (Actor/IT targets) from Material Flows
            const infoEdges = [];
            const materialEdges = [];

            allOutgoingEdges.forEach(e => {
                const targetNode = nodeMap.get(e.target);
                if (isSupport(targetNode)) {
                    infoEdges.push(e);
                } else {
                    materialEdges.push(e);
                }
            });

            // 2. Process Information Flows (Broadcast 100%)
            infoEdges.forEach(e => {
                const edge = edgeMap.get(e.id);
                // Copy full stream
                const edgeStream = node.data.volumeStreamOut.map(item => ({ ...item }));
                edge.data.volumeStream = edgeStream;
                edge.data.volume = edgeStream.reduce((sum, item) => sum + item.value, 0).toFixed(1);
                // Label: Maybe indicate it's info? Or just show volume? 
                // For now, let's keep it simple or hidden? User said "no impact".
                // Let's show 100% to indicate full flow.
                edge.data.label = "100%";
                edge.data.isInfo = true; // Mark for styling if needed
            });

            // 3. Process Material Flows (Standard Logic)
            const outgoingEdges = materialEdges; // Only consider material edges for splitting
            const totalEdges = outgoingEdges.length;

            // console.log(`Node ${node.data.label}: Total Material Edges: ${totalEdges}`);

            if (totalEdges > 0) {
                // Validation Tracking
                // Check if we are using Item Routing on ANY edge
                const hasItemRouting = outgoingEdges.some(e => edgeMap.get(e.id).data.routingType === 'item');

                // Separate edges into Standard and Remaining
                const remainingEdges = outgoingEdges.filter(e => edgeMap.get(e.id).data.routingType === 'remaining');
                const standardEdges = outgoingEdges.filter(e => edgeMap.get(e.id).data.routingType !== 'remaining');

                // Track usage per item (percentage)
                const itemUsage = new Map(); // itemId -> total % used by standard edges
                node.data.volumeStreamOut.forEach(item => itemUsage.set(item.id, 0));

                // Pass 1: Process Standard Edges
                // Calculate volume for edges with explicit percentages first
                let usedPercentage = 0;
                let unsetEdgesCount = 0;

                standardEdges.forEach(e => {
                    const edge = edgeMap.get(e.id);
                    if (edge.data.percentage !== undefined && edge.data.percentage !== null && edge.data.percentage !== '') {
                        usedPercentage += parseFloat(edge.data.percentage);
                    } else {
                        unsetEdgesCount++;
                    }
                });

                const remainingPercentage = Math.max(0, 100 - usedPercentage);
                const defaultPct = unsetEdgesCount > 0 ? (remainingPercentage / unsetEdgesCount) / 100 : 0;

                standardEdges.forEach(e => {
                    const edge = edgeMap.get(e.id);
                    const routingType = edge.data.routingType || 'global';
                    let edgeStream = [];

                    if (routingType === 'item') {
                        // Item-specific routing
                        const itemRouting = edge.data.itemRouting || {};
                        edgeStream = node.data.volumeStreamOut.map(item => {
                            const pct = parseFloat(itemRouting[item.id] || 0);
                            itemUsage.set(item.id, itemUsage.get(item.id) + pct);
                            return {
                                ...item,
                                value: item.value * (pct / 100)
                            };
                        });
                    } else {
                        // Global or Split
                        let pct = 0;

                        if (edge.data.percentage !== undefined && edge.data.percentage !== null && edge.data.percentage !== '') {
                            pct = parseFloat(edge.data.percentage) / 100;
                        } else {
                            pct = defaultPct;
                        }

                        edgeStream = node.data.volumeStreamOut.map(item => {
                            itemUsage.set(item.id, itemUsage.get(item.id) + (pct * 100));
                            return {
                                ...item,
                                value: item.value * pct
                            };
                        });
                    }

                    edge.data.volumeStream = edgeStream;
                    edge.data.volume = edgeStream.reduce((sum, item) => sum + item.value, 0).toFixed(1);

                    // Label generation (Standard)
                    if (routingType === 'item') {
                        const itemRouting = edge.data.itemRouting || {};
                        const items = node.data.volumeStreamOut || [];

                        // Filter items with > 0%
                        const activeItems = items.map(item => ({
                            ...item,
                            pct: parseFloat(itemRouting[item.id] || 0)
                        })).filter(i => i.pct > 0);

                        const firstPct = activeItems.length > 0 ? activeItems[0].pct : 0;
                        const allIdentical = activeItems.length > 0 && activeItems.every(item => Math.abs(item.pct - firstPct) < 0.01) && activeItems.length === items.length;

                        if (activeItems.length === 0) {
                            edge.data.label = "0%";
                            edge.data.labelItems = [];
                        } else if (allIdentical) {
                            edge.data.label = `${firstPct}%`;
                            edge.data.labelItems = [];
                        } else if (activeItems.length <= 8) { // Increased limit slightly
                            edge.data.label = null; // Use labelItems
                            edge.data.labelItems = activeItems.map(item => ({
                                name: item.name,
                                pct: item.pct,
                                color: item.color
                            }));
                        } else {
                            edge.data.label = 'Mixed';
                            edge.data.labelItems = [];
                        }
                    } else {
                        const usedPct = (edge.data.volume / (node.data.volume_in || 1)) * 100;
                        edge.data.label = `${usedPct.toFixed(0)}%`;
                    }
                });

                // Pass 2: Process Remaining Edges
                if (remainingEdges.length > 0) {
                    remainingEdges.forEach(e => {
                        const edge = edgeMap.get(e.id);
                        let edgeStream = [];

                        // Calculate remaining % for each item
                        // Split remainder evenly among remaining edges
                        edgeStream = node.data.volumeStreamOut.map(item => {
                            const used = itemUsage.get(item.id) || 0;
                            const remaining = Math.max(0, 100 - used);
                            const pct = remaining / remainingEdges.length;

                            return {
                                ...item,
                                value: item.value * (pct / 100),
                                _calculatedPct: pct // Store for label
                            };
                        });

                        edge.data.volumeStream = edgeStream;
                        edge.data.volume = edgeStream.reduce((sum, item) => sum + item.value, 0).toFixed(1);

                        // Label generation (Remaining)
                        const items = edgeStream;
                        const firstPct = items[0]?._calculatedPct || 0;
                        const allIdentical = items.every(item => Math.abs(item._calculatedPct - firstPct) < 0.01);

                        if (allIdentical) {
                            edge.data.label = `Rem (${firstPct.toFixed(0)}%)`;
                        } else if (items.length <= 5) {
                            edge.data.label = items.map(item => `${item.name}: ${item._calculatedPct.toFixed(0)}%`).join('\n');
                        }
                    });
                }

                // --- Validation Logic ---
                // Skip validation for Actor/IT nodes (they are independent)
                if (!isSupport(node)) {
                    // If we have a Remaining edge, we assume it balances out, UNLESS standard edges exceed 100%
                    const hasRemaining = remainingEdges.length > 0;

                    if (hasRemaining) {
                        // Check if any item usage > 100%
                        const itemErrors = new Set();
                        node.data.volumeStreamOut.forEach(item => {
                            if (itemUsage.get(item.id) > 100.1) { // Tolerance
                                itemErrors.add(item.id);
                            }
                        });

                        if (itemErrors.size > 0) {
                            outgoingEdges.forEach(e => edgeMap.get(e.id).data.isError = true);
                        }
                    } else {
                        // Original Validation Logic
                        if (!hasItemRouting) {
                            const totalVolOut = outgoingEdges.reduce((sum, e) => sum + parseFloat(edgeMap.get(e.id).data.volume), 0);
                            const totalVolIn = node.data.volume_in;

                            if (Math.abs(totalVolOut - totalVolIn) > 0.1 && totalVolIn > 0) {
                                outgoingEdges.forEach(e => edgeMap.get(e.id).data.isError = true);
                            }
                        } else {
                            const itemErrors = new Set();
                            node.data.volumeStreamOut.forEach(item => {
                                const totalItemOut = outgoingEdges.reduce((sum, e) => {
                                    const edgeStream = edgeMap.get(e.id).data.volumeStream || [];
                                    const edgeItem = edgeStream.find(i => i.id === item.id);
                                    return sum + (edgeItem ? edgeItem.value : 0);
                                }, 0);

                                if (Math.abs(totalItemOut - item.value) > 0.1 && item.value > 0) {
                                    itemErrors.add(item.id);
                                }
                            });

                            if (itemErrors.size > 0) {
                                outgoingEdges.forEach(e => edgeMap.get(e.id).data.isError = true);
                            }
                        }
                    }
                }
            }
        }
    });

    // --- Aggregate Metrics ---
    const totalProcessTime = Array.from(nodeMap.values())
        .filter(n => n.type === 'process')
        .reduce((sum, n) => sum + (n.data.process_time_total || 0), 0);

    const totalLeadTime = Array.from(nodeMap.values())
        .reduce((sum, n) => {
            if (n.type === 'inventory') return sum + (parseFloat(n.data.waitTime) || 0);
            if (n.type === 'process' && (isSupport(n) || n.data.executionMode === 'step')) {
                return sum + (parseFloat(n.data.wait_time) || 0);
            }
            return sum;
        }, 0);

    // Add Wait Times from Edges
    const totalEdgeWaitTime = Array.from(edgeMap.values())
        .reduce((sum, edge) => {
            const itemData = edge.data.itemData || {};
            const edgeWait = Object.values(itemData).reduce((itemSum, props) => itemSum + (parseFloat(props.wait) || 0), 0);
            return sum + edgeWait;
        }, 0);

    const grandTotalLeadTime = totalLeadTime + totalProcessTime + totalEdgeWaitTime;

    const efficiency = grandTotalLeadTime > 0
        ? ((totalProcessTime / grandTotalLeadTime) * 100).toFixed(2)
        : 0;

    return {
        nodes: Array.from(nodeMap.values()),
        edges: Array.from(edgeMap.values()),
        metrics: {
            totalProcessTime,
            totalLeadTime: grandTotalLeadTime,
            efficiency
        }
    };
};
