import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { resourceKinds, referencedResources, mergeResources } from '../utils/resources';
import { calculateMetrics } from '../utils/calculations';
import { removeNodes, restoreRemoved } from '../utils/graphEdits';

const readLibrary = (kind) => {
  try { const value = JSON.parse(localStorage.getItem(`vsm_global_${kind}`) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
};
const useStore = create((set, get) => ({
  edgeLabelSizes: {},
  // Reading preferences: local only, never written to the .vsm file.
  orientation: (() => { try { return localStorage.getItem('vsm.orientation') === 'vertical' ? 'vertical' : 'horizontal'; } catch { return 'horizontal'; } })(),
  viewMode: (() => { try { const v = localStorage.getItem('vsm.view'); return ['flow', 'tools', 'actors', 'teams'].includes(v) ? v : 'flow'; } catch { return 'flow'; } })(),
  laneBands: [],
  setOrientation: (orientation) => {
    try { localStorage.setItem('vsm.orientation', orientation); } catch { /* preference stays for the session */ }
    set({ orientation });
  },
  setViewMode: (viewMode) => {
    try { localStorage.setItem('vsm.view', viewMode); } catch { /* preference stays for the session */ }
    set({ viewMode });
  },
  setLaneBands: (laneBands) => set({ laneBands }),
  nodes: [],
  edges: [],
  metrics: {
    totalProcessTime: 0,
    totalLeadTime: 0,
    efficiency: 0,
    cycleNodeIds: []
  },

  projectTitle: 'Untitled VSM',
  fileHandle: null,

  // Safe initialization for recentFiles
  recentFiles: (() => {
    try {
      const stored = JSON.parse(localStorage.getItem('vsm_recent_files') || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch (e) {
      console.error("Failed to load recent files", e);
      return [];
    }
  })(),

  // Safe initialization for tools
  tools: (() => {
    try {
      const stored = JSON.parse(localStorage.getItem('vsm_global_tools') || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch (e) {
      console.error("Failed to load global tools", e);
      return [];
    }
  })(),

  actors: readLibrary('actors'),
  knowledge: readLibrary('knowledge'),
  setLibrary: (kind, entries) => {
    if (!resourceKinds[kind]) return;
    localStorage.setItem(`vsm_global_${kind}`, JSON.stringify(entries));
    set({ [kind]: entries });
  },
  mergeLibraries: (libraries) => {
    Object.keys(resourceKinds).forEach(kind => get().setLibrary(kind, mergeResources(get()[kind], libraries[kind])));
  },
  saveResource: (kind, resource) => {
    const entry = { ...resource, id: resource.id || crypto.randomUUID() };
    get().setLibrary(kind, mergeResources(get()[kind], [entry]));
    return entry.id;
  },
  deleteResource: (kind, id) => {
    if (referencedResources(get().nodes, kind, id).length) return false;
    get().setLibrary(kind, get()[kind].filter(r => r.id !== id));
    return true;
  },
  attachResource: (nodeId, kind, resourceId) => {
    const node = get().nodes.find(n => n.id === nodeId);
    if (!node || !get()[kind].some(r => r.id === resourceId)) return;
    const field = resourceKinds[kind].field;
    get().updateNodeData(nodeId, { [field]: [...new Set([...(node.data[field] || []), resourceId])] });
  },
  detachResource: (nodeId, kind, resourceId) => {
    const node = get().nodes.find(n => n.id === nodeId);
    if (!node) return;
    const field = resourceKinds[kind].field;
    get().updateNodeData(nodeId, { [field]: (node.data[field] || []).filter(id => id !== resourceId) });
  },
  setProjectTitle: (title) => set({ projectTitle: title }),
  setFileHandle: (handle) => set({ fileHandle: handle }),

  // Selection State
  selectedNodeId: null,
  selectedStepId: null,
  selectedItemId: null, // New Item Lineage State
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setSelectedStepId: (id) => set({ selectedStepId: id }),
  setSelectedItem: (itemId) => set({ selectedItemId: itemId }),

  setTools: (tools) => {
    localStorage.setItem('vsm_global_tools', JSON.stringify(tools));
    set({ tools });
  },

  // Tool Actions
  addTool: (tool) => {
    const newTools = [...get().tools, { ...tool, id: tool.id || crypto.randomUUID() }];
    localStorage.setItem('vsm_global_tools', JSON.stringify(newTools));
    set({ tools: newTools });
  },

  updateTool: (id, updates) => {
    const newTools = get().tools.map(t => t.id === id ? { ...t, ...updates } : t);
    localStorage.setItem('vsm_global_tools', JSON.stringify(newTools));
    set({ tools: newTools });
  },

  deleteTool: (id) => {
    if (referencedResources(get().nodes, "tools", id).length) return;
    const newTools = get().tools.filter(t => t.id !== id);
    localStorage.setItem('vsm_global_tools', JSON.stringify(newTools));
    set({ tools: newTools });
  },

  // Recent File Actions
  addToRecentFiles: (fileData) => {
    const currentRecent = get().recentFiles || [];
    // Remove if exists (to move to top)
    const filtered = currentRecent.filter(f => f.title !== fileData.title);
    // Add to top, limit to 5
    const newRecent = [fileData, ...filtered].slice(0, 5);

    try {
      localStorage.setItem('vsm_recent_files', JSON.stringify(newRecent));
    } catch (e) {
      console.error("Failed to save recent files", e);
    }
    set({ recentFiles: newRecent });
  },

  clearRecentFiles: () => {
    console.log("Clearing recent files...");
    try {
      localStorage.removeItem('vsm_recent_files');
    } catch (e) {
      console.error("Failed to clear recent files from storage", e);
    }
    set({ recentFiles: [] });
    console.log("Recent files cleared in store.");
  },

  // Graph Actions
  // Last removal (button or keyboard), kept until undone, dismissed or replaced by a new project.
  lastDeletion: null,
  pendingRemovedEdges: [],
  onNodesChange: (changes) => {
    const newNodes = applyNodeChanges(changes, get().nodes);
    // React Flow removes edges first, then nodes: metrics must be recomputed here too.
    if (changes.some(c => c.type === 'remove')) {
      const removed = new Set(changes.filter(c => c.type === 'remove').map(c => c.id));
      const removedNodes = get().nodes.filter(n => removed.has(n.id));
      const { nodes, edges, metrics } = calculateMetrics(newNodes, get().edges);
      const { selectedNodeId, selectedStepId, pendingRemovedEdges } = get();
      set({
        nodes, edges, metrics,
        lastDeletion: removedNodes.length ? { nodes: removedNodes, edges: pendingRemovedEdges } : get().lastDeletion,
        pendingRemovedEdges: [],
        selectedNodeId: removed.has(selectedNodeId) ? null : selectedNodeId,
        selectedStepId: removed.has(selectedStepId) ? null : selectedStepId,
      });
      return;
    }
    set({ nodes: newNodes });
  },

  onEdgesChange: (changes) => {
    const removedIds = new Set(changes.filter(c => c.type === 'remove').map(c => c.id));
    const removedEdges = get().edges.filter(e => removedIds.has(e.id));
    const newEdges = applyEdgeChanges(changes, get().edges);
    const { nodes, edges, metrics } = calculateMetrics(get().nodes, newEdges);
    // Remembered until the node removal that usually follows; a lone edge removal is undoable too.
    set({ nodes, edges, metrics, pendingRemovedEdges: removedEdges, lastDeletion: removedEdges.length ? { nodes: [], edges: removedEdges } : get().lastDeletion });
  },

  deleteNode: (id) => {
    const result = removeNodes(get().nodes, get().edges, [id]);
    if (!result.removed.nodes.length) return;
    const { nodes, edges, metrics } = calculateMetrics(result.nodes, result.edges);
    const { selectedNodeId, selectedStepId } = get();
    set({
      nodes, edges, metrics,
      lastDeletion: result.removed,
      pendingRemovedEdges: [],
      selectedNodeId: selectedNodeId === id ? null : selectedNodeId,
      selectedStepId: selectedStepId === id ? null : selectedStepId,
    });
  },

  undoDeletion: () => {
    const removed = get().lastDeletion;
    if (!removed) return;
    const restored = restoreRemoved(get().nodes, get().edges, removed);
    const { nodes, edges, metrics } = calculateMetrics(restored.nodes, restored.edges);
    set({ nodes, edges, metrics, lastDeletion: null, pendingRemovedEdges: [] });
  },

  dismissDeletion: () => set({ lastDeletion: null, pendingRemovedEdges: [] }),

  onConnect: (connection) => {
    const newEdges = addEdge(connection, get().edges);
    const { nodes, edges, metrics } = calculateMetrics(get().nodes, newEdges);
    set({ nodes, edges, metrics });
  },

  addNode: (node) => {
    const newNodes = [...get().nodes, node];
    const { nodes: calculatedNodes, edges, metrics } = calculateMetrics(newNodes, get().edges);
    set({
      nodes: calculatedNodes,
      edges,
      metrics
    });
  },

  addNextNode: (sourceNodeId) => {
    const nodes = get().nodes;
    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    if (!sourceNode) return;

    const generateId = () => `n_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newNodeId = generateId();

    // Next step goes in the reading direction: to the right in horizontal, below in vertical.
    const vertical = get().orientation === 'vertical';
    const newNode = {
      id: newNodeId,
      type: 'process',
      position: vertical
        ? { x: sourceNode.position.x, y: sourceNode.position.y + (sourceNode.height || 260) + 260 }
        : { x: sourceNode.position.x + (sourceNode.width || 300) + 340, y: sourceNode.position.y },
      data: { label: 'Process Step', cycleTimes: {}, volumeStreamIn: [] }
    };

    const newEdge = {
      id: `reactflow__edge-${sourceNodeId}-${newNodeId}`,
      source: sourceNodeId,
      target: newNodeId,
      sourceHandle: null,
      targetHandle: null,
      type: 'flow',
      markerEnd: { type: 'arrowclosed' },
      data: { routingType: 'global', volumeStream: [] }
    };

    const newNodes = [...nodes, newNode];
    const newEdges = [...get().edges, newEdge];

    const { nodes: calculatedNodes, edges: calculatedEdges, metrics } = calculateMetrics(newNodes, newEdges);
    set({
      nodes: calculatedNodes,
      edges: calculatedEdges,
      metrics
    });
  },

  updateNodeData: (id, data) => {
    const updatedNodes = get().nodes.map((node) => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...data } };
      }
      return node;
    });

    const { nodes, edges, metrics } = calculateMetrics(updatedNodes, get().edges);
    set({ nodes, edges, metrics });
  },

  updateEdgeData: (id, data) => {
    const updatedEdges = get().edges.map((edge) => {
      if (edge.id === id) {
        return { ...edge, data: { ...edge.data, ...data } };
      }
      return edge;
    });

    const { nodes, edges, metrics } = calculateMetrics(get().nodes, updatedEdges);
    set({ nodes, edges, metrics });
  },

  setGraph: (nodes, edges, title) => {
    const { nodes: calculatedNodes, edges: calculatedEdges, metrics } = calculateMetrics(nodes, edges);
    set({
      nodes: calculatedNodes,
      edges: calculatedEdges,
      metrics,
      laneBands: [],
      lastDeletion: null, pendingRemovedEdges: [],
      selectedNodeId: null, selectedStepId: null, selectedItemId: null,
      projectTitle: title || 'Untitled VSM'
    });
  },

  resetGraph: () => {
    set({
      nodes: [],
      edges: [],
      edgeLabelSizes: {},
      laneBands: [],
      lastDeletion: null, pendingRemovedEdges: [],
      metrics: {
        totalProcessTime: 0,
        totalLeadTime: 0,
        efficiency: 0,
        cycleNodeIds: []
      },
      selectedNodeId: null,
      selectedStepId: null,
      selectedItemId: null,
      projectTitle: 'Untitled VSM',
      fileHandle: null
    });
  },
}));

export default useStore;
