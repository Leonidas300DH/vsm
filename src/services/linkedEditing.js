import { clone, libraries, signature, compareScenarios } from './project.js';
import { calculateMetrics } from '../utils/calculations.js';
import { resourceKinds } from '../utils/resources.js';
import { graphBoxes, collisions } from './placement.js';

const kinds = ['nodes', 'edges', ...libraries];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeKey = key => !['__proto__', 'constructor', 'prototype'].includes(key);
// Diff the submitted fields against the origin, not against a child. A child keeps
// its untouched nested fields (e.g. other categories' cycle times).
export function changedFields(before, updates, path = []) {
  return Object.entries(updates).flatMap(([key, value]) => {
    if (!safeKey(key)) throw new Error('Champ non autorisé.');
    const at = [...path, key];
    // Category rows are entities, not one replaceable value. Editing one volume
    // must not reset another category's independent volume or metadata.
    if (key === 'volumeItems' && Array.isArray(value)) {
      const old = new Map((before?.[key] || []).map(item => [item.id, item]));
      const next = new Map(value.map(item => [item.id, item]));
      if (next.size !== value.length || value.some(item => !item.id)) throw new Error('Identifiants de catégories invalides.');
      return [...new Set([...old.keys(), ...next.keys()])].flatMap(itemId => {
        if (!next.has(itemId)) return [{ path: at, itemId, operation: 'remove' }];
        if (!old.has(itemId)) return [{ path: at, itemId, operation: 'add', value: clone(next.get(itemId)) }];
        const fields = changedFields(old.get(itemId), next.get(itemId));
        return fields.length ? [{ path: at, itemId, operation: 'update', fields }] : [];
      });
    }
    if (object(value)) return changedFields(before?.[key], value, at);
    return signature(before?.[key]) === signature(value) ? [] : [{ path: at, value: clone(value) }];
  });
}
function patch(target, fields) {
  for (const { path, value, operation, itemId, fields: nestedFields } of fields) {
    let cursor = target;
    for (const key of path.slice(0, -1)) { if (!object(cursor[key])) cursor[key] = {}; cursor = cursor[key]; }
    const key = path.at(-1);
    if (operation) {
      const items = cursor[key] || [];
      const item = items.find(row => row.id === itemId);
      if (operation === 'remove') cursor[key] = items.filter(row => row.id !== itemId);
      else if (operation === 'add') {
        if (item) throw new Error(`Catégorie déjà présente : ${itemId}.`);
        cursor[key] = [...items, clone(value)];
      } else {
        if (!item) throw new Error(`Catégorie ${itemId} absente : aucune modification appliquée.`);
        patch(item, nestedFields);
      }
    } else cursor[key] = clone(value);
  }
}
export function linkedSession(project, saved = project.linkedEditing || {}) {
  const ids = project.scenarios.filter(s => !s.archived).map(s => s.id);
  const masterId = ids.includes(saved.masterId) ? saved.masterId : project.actualScenarioId;
  const childIds = [...new Set((saved.childIds || ids.filter(id => id !== masterId).slice(0, 1)).filter(id => ids.includes(id) && id !== masterId))];
  return { masterId, childIds, linkedIds: [...new Set((saved.linkedIds || childIds).filter(id => childIds.includes(id)))], positions: Boolean(saved.positions), active: false };
}
function checkValues(value, path = []) {
  if (typeof value === 'number' && (!Number.isFinite(value) || (value < 0 && !path.includes('position')))) throw new Error(`Valeur invalide : ${path.join('.')}`);
  if (object(value) || Array.isArray(value)) for (const [key, v] of Object.entries(value)) checkValues(v, [...path, key]);
  if ((path.at(-1) === 'percentage' || path.includes('itemRouting')) && typeof value === 'number' && value > 100) throw new Error('Le routage doit être compris entre 0 et 100 %.');
}
function ensureResources(target, source, nodes) {
  for (const node of nodes) for (const [kind, { field }] of Object.entries(resourceKinds)) {
    for (const id of node.data?.[field] || []) {
      target[kind] ||= [];
      if (target[kind].some(r => r.id === id)) continue;
      const entry = source[kind]?.find(r => r.id === id);
      if (!entry) throw new Error(`${target.name} : ressource absente (${id}).`);
      target[kind].push(clone(entry));
    }
  }
}
function validateGraph(scenario) {
  for (const kind of kinds) {
    const ids = (scenario[kind] || []).map(x => x.id);
    if (new Set(ids).size !== ids.length) throw new Error(`${scenario.name} : identifiants dupliqués.`);
  }
  const ids = new Set(scenario.nodes.map(n => n.id));
  if (scenario.edges.some(e => !ids.has(e.source) || !ids.has(e.target))) throw new Error(`${scenario.name} : une connexion vise une étape absente.`);
}
function newCollisions(before, after, geometry) {
  const hits = s => collisions(graphBoxes(s.nodes.map(n => ({ ...n, ...geometry?.[n.id], position: n.position })), s.edges), 0).map(pair => pair.map(b => `${b.kind}:${b.id}`).sort().join(' / '));
  const existing = new Set(hits(before));
  return hits(after).filter(hit => !existing.has(hit));
}
export const needsLinkedPreview = command => ['insert', 'remove', 'realign'].includes(command.type);

// Pure transaction: all targets are prepared and validated before the store changes.
export function prepareLinkedEdit(project, session, originId, command, geometry = {}) {
  const next = clone(project), source = project.scenarios.find(s => s.id === originId && !s.archived);
  if (!source) throw new Error('Scénario source indisponible.');
  if (!['patch', 'move', 'insert', 'remove', 'realign', 'resource'].includes(command.type)) throw new Error('Commande inconnue.');
  if (command.kind && !kinds.includes(command.kind)) throw new Error('Collection inconnue.');
  const targets = originId === session.masterId && session.active ? session.linkedIds.filter(id => session.childIds.includes(id) && id !== originId) : [];
  const targetIds = command.type === 'realign' ? command.childIds : [originId, ...(command.type === 'move' && !session.positions ? [] : targets)];
  if (command.type === 'realign' && (originId !== session.masterId || !targetIds?.length || targetIds.some(id => !session.childIds.includes(id)))) throw new Error('Choisissez les enfants à réaligner.');
  const original = command.kind && source[command.kind]?.find(x => x.id === command.id);
  if (['patch', 'remove'].includes(command.type) && !original) throw new Error('Élément source introuvable.');
  const fields = command.type === 'patch' ? changedFields(original, command.updates) : [];
  if (fields.some(f => f.path[0] === 'id')) throw new Error('Un identifiant ne peut pas être modifié.');
  checkValues(command.updates || command.entry || {});
  const report = [], missing = [];
  for (const id of [...new Set(targetIds)]) {
    const target = next.scenarios.find(s => s.id === id && !s.archived);
    if (!target) throw new Error('Un scénario destinataire est indisponible.');
    const before = clone(target);
    let description = '', touchedNodes = [];
    if (command.type === 'resource') {
      if (!libraries.includes(command.kind) || !command.entry?.id || !command.entry.name?.trim()) throw new Error('Ressource invalide.');
      target[command.kind] ||= [];
      const entry = target[command.kind].find(x => x.id === command.entry.id);
      const prior = source[command.kind]?.find(x => x.id === command.entry.id);
      if (entry) patch(entry, changedFields(prior, command.entry));
      else target[command.kind].push(clone(command.entry));
      if (command.nodeId) {
        const node = target.nodes.find(n => n.id === command.nodeId);
        if (node) {
          const field = resourceKinds[command.kind].field;
          node.data[field] = [...new Set([...(node.data[field] || []), command.entry.id])];
        } else missing.push(`${target.name} : étape ${command.nodeId} absente, ressource non rattachée`);
      }
      description = `Ressource · ${command.entry.name}${command.nodeId ? ' · enregistrée et rattachée' : ''}`;
    } else if (command.type === 'patch') {
      const entry = target[command.kind]?.find(x => x.id === command.id);
      if (!entry) { missing.push(`${target.name} : ${original.data?.label || original.name || command.id} absent`); continue; }
      if (command.kind === 'nodes' && entry.type !== original.type) throw new Error(`${target.name} : type d’étape incompatible.`);
      const categories = new Set(target.nodes.flatMap(n => n.data.volumeItems || []).map(item => item.id));
      for (const f of fields) if (['cycleTimes', 'itemRouting', 'itemData'].includes(f.path[1]) && f.path[2] && !categories.has(f.path[2])) throw new Error(`${target.name} : catégorie ${f.path[2]} absente.`);
      patch(entry, fields);
      if (command.kind === 'nodes') touchedNodes = [entry];
      description = `${original.data?.label || original.name || command.id} · ${fields.map(f => f.path.join('.')).join(', ')}`;
    } else if (command.type === 'move') {
      const node = target.nodes.find(n => n.id === command.id);
      if (!node) { missing.push(`${target.name} : étape ${command.id} absente`); continue; }
      if (node.data.positionLocked) throw new Error(`${target.name} : position verrouillée.`);
      if (!Number.isFinite(command.position.x) || !Number.isFinite(command.position.y)) throw new Error('Position invalide.');
      node.position = clone(command.position);
      description = `Position · ${node.data.label || node.id}`;
    } else if (command.type === 'insert') {
      for (const kind of ['nodes', 'edges']) {
        for (const entry of command[kind] || []) {
          if (target[kind].some(x => x.id === entry.id)) throw new Error(`${target.name} : identifiant déjà présent (${entry.id}).`);
          target[kind].push(clone(entry));
        }
      }
      touchedNodes = command.nodes || [];
      description = `Ajouter ${touchedNodes.length} étape(s), ${(command.edges || []).length} connexion(s)`;
    } else if (command.type === 'remove') {
      if (!target[command.kind]?.some(x => x.id === command.id)) { missing.push(`${target.name} : ${command.id} absent`); continue; }
      if (libraries.includes(command.kind) && target.nodes.some(n => n.data[resourceKinds[command.kind].field]?.includes(command.id))) throw new Error(`${target.name} : cette ressource est encore utilisée.`);
      target[command.kind] = target[command.kind].filter(x => x.id !== command.id);
      const removedEdges = command.kind === 'nodes' ? target.edges.filter(e => e.source === command.id || e.target === command.id) : [];
      target.edges = target.edges.filter(e => !removedEdges.includes(e));
      description = `Supprimer ${original.data?.label || original.name || command.id}${removedEdges.length ? ` et ${removedEdges.length} connexion(s)` : ''}. Les commentaires restent conservés.`;
    } else {
      // Realignment only replaces common objects. Child-only branches and metadata survive.
      for (const kind of kinds) target[kind] = (target[kind] || []).map(entry => {
        const match = source[kind]?.find(x => x.id === entry.id);
        if (!match) return entry;
        const replacement = clone(match);
        if (kind === 'nodes' && !session.positions) replacement.position = clone(entry.position);
        return replacement;
      });
      touchedNodes = target.nodes.filter(n => source.nodes.some(x => x.id === n.id));
      description = 'Réaligner les éléments communs : leurs champs seront remplacés par ceux du maître. Les éléments propres à l’enfant restent conservés.';
    }
    ensureResources(target, source, touchedNodes);
    validateGraph(target);
    if (['move', 'insert'].includes(command.type) || (command.type === 'realign' && session.positions)) {
      const overlaps = newCollisions(before, target, geometry[id]);
      if (overlaps.length) throw new Error(`${target.name} : chevauchement créé (${overlaps[0]}). Aucune carte modifiée.`);
    }
    if (signature(before) === signature(target)) continue;
    const calculated = calculateMetrics(target.nodes, target.edges);
    target.nodes = calculated.nodes; target.edges = calculated.edges;
    report.push({ scenarioId: id, name: target.name, description, changes: compareScenarios(before, target) });
  }
  return { project: next, report, missing };
}
