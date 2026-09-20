// Validation and normalisation of .vsm project files.
// Accepts legacy files (no meta, version '1.0') and files written by this version.
export const FILE_VERSION = '2.0';
const NODE_TYPES = new Set(['process', 'startEnd']);

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);

const normaliseLibrary = (entries) =>
  (Array.isArray(entries) ? entries : []).filter(r => isObject(r) && r.id !== undefined && typeof r.name === 'string');

export function validateProject(data) {
  if (!isObject(data)) return { ok: false, errors: ['File is not a VSM project.'] };
  const errors = [];
  if (!Array.isArray(data.nodes)) errors.push('Missing or invalid "nodes" array.');
  if (!Array.isArray(data.edges)) errors.push('Missing or invalid "edges" array.');
  if (errors.length) return { ok: false, errors };

  const nodes = [];
  const seenNodes = new Set();
  data.nodes.forEach((raw, index) => {
    if (!isObject(raw) || raw.id === undefined || raw.id === null) { errors.push(`Node #${index}: missing id.`); return; }
    if (!NODE_TYPES.has(raw.type)) { errors.push(`Node "${raw.id}": unknown type "${raw.type}".`); return; }
    const id = String(raw.id);
    if (seenNodes.has(id)) { errors.push(`Node "${id}": duplicate id.`); return; }
    seenNodes.add(id);
    nodes.push({
      ...raw,
      id,
      position: { x: finite(raw.position?.x, 0), y: finite(raw.position?.y, 0) },
      data: isObject(raw.data) ? raw.data : {},
    });
  });
  // A malformed node is fatal: the user must know their file lost a step.
  if (errors.length) return { ok: false, errors };

  const edges = [];
  const seenEdges = new Set();
  const warnings = [];
  data.edges.forEach((raw, index) => {
    if (!isObject(raw)) { warnings.push(`Edge #${index}: ignored (not an object).`); return; }
    const source = String(raw.source ?? ''), target = String(raw.target ?? '');
    if (!seenNodes.has(source) || !seenNodes.has(target)) { warnings.push(`Edge "${raw.id ?? index}": ignored, refers to a missing step.`); return; }
    const id = raw.id !== undefined && raw.id !== null ? String(raw.id) : `edge-${source}-${target}-${index}`;
    if (seenEdges.has(id)) { warnings.push(`Edge "${id}": duplicate ignored.`); return; }
    seenEdges.add(id);
    edges.push({ ...raw, id, source, target, type: raw.type || 'flow', data: isObject(raw.data) ? raw.data : {} });
  });

  const title = typeof data.title === 'string' && data.title.trim() ? data.title
    : typeof data.projectTitle === 'string' && data.projectTitle.trim() ? data.projectTitle : '';

  return {
    ok: true,
    errors: warnings,
    project: {
      title,
      nodes,
      edges,
      tools: normaliseLibrary(data.tools),
      actors: normaliseLibrary(data.actors),
      knowledge: normaliseLibrary(data.knowledge),
    },
  };
}
