import { create } from 'zustand';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import { calculateMetrics } from '../utils/calculations';

const useStore = create((set, get) => ({
  nodes: [],
  edges: [],
  metrics: {
    totalProcessTime: 0,
    totalLeadTime: 0,
    efficiency: 0
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

  setProjectTitle: (title) => set({ projectTitle: title }),
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
  onNodesChange: (changes) => {
    const newNodes = applyNodeChanges(changes, get().nodes);
    set({ nodes: newNodes });
  },

  onEdgesChange: (changes) => {
    const newEdges = applyEdgeChanges(changes, get().edges);
    const { nodes, edges, metrics } = calculateMetrics(get().nodes, newEdges);
    set({ nodes, edges, metrics });
  },

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

    const newNode = {
      id: newNodeId,
      type: 'process',
      position: { x: sourceNode.position.x + 250, y: sourceNode.position.y },
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
      projectTitle: title || 'Untitled VSM'
    });
  },

  resetGraph: () => {
    set({
      nodes: [],
      edges: [],
      metrics: {
        totalProcessTime: 0,
        totalLeadTime: 0,
        efficiency: 0
      },
      projectTitle: 'Untitled VSM',
      fileHandle: null
    });
  },
}));

export default useStore;
