# Panneaux masqués, orientation verticale et vues en couloirs — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ouvrir l'application sur le canevas seul, basculer en un clic entre lecture horizontale et verticale, et réorganiser la carte en couloirs par outil, par acteur interne ou par équipe externe.

**Architecture:** Le moteur de disposition `horizontalLayout` devient `layoutGraph(nodes, edges, { orientation, lanes, laneLabels })` : il calcule en axes abstraits « flux » et « couloir », puis projette en x/y selon l'orientation, et renvoie aussi les bandes de couloirs. Un module pur `src/utils/lanes.js` traduit une vue (outils, acteurs, équipes) en affectation de couloirs à partir des bibliothèques existantes. Le store porte `orientation`, `viewMode` et `laneBands` ; les cartes lisent l'orientation pour placer leurs ports ; les bandes sont rendues comme des nœuds React Flow non interactifs. Aucune donnée nouvelle à saisir, rien de nouveau dans le fichier `.vsm`.

**Tech Stack:** React 19, React Flow 11.11 (`useUpdateNodeInternals`, `zIndex` de nœud), Zustand 5, tests `node:test`. Les modules `src/utils/*.js` restent purs et testables sous Node.

**Spec:** Demande de Daniel du 20 septembre 2026 et réponses aux trois questions de cadrage (voir Contexte).

## Contexte

Demande : « par défaut, masque le rail en bas. Idem à gauche. Ensuite, switcher facilement de la vue horizontale (que j'aime beaucoup) à une vue verticale. Dernière chose : une vue par outil, par acteur, par équipe (les acteurs, c'est interne ; les équipes, c'est quand on fait appel dans le flux à un acteur externe pour processer un ou plusieurs steps). »

Décisions de cadrage :
- **Vues** = couloirs (swimlanes) : la carte se réorganise avec une ligne (ou colonne en vertical) par ressource. Une étape rattachée à plusieurs ressources va dans le premier couloir et est signalée dans le bandeau d'information.
- **Équipes** = acteurs de la bibliothèque dont le périmètre est « Autre équipe » (`scope: 'external'`), regroupés par leur champ `team`. Vue par acteur = acteurs internes. Aucune nouvelle bibliothèque.
- **Vertical** = disposition retournée **et** ports en haut/bas des cartes ; les ressources restent sous chaque carte.

État du code concerné :
- `src/App.jsx` : préférences de panneaux dans localStorage (`vsm.panel.sidebar` = true, `vsm.panel.analysis` = true par défaut), barre d'outils, `arrange()` et `loadExample()` appellent `horizontalLayout(getNodes(), edges)`.
- `src/utils/layout.js` : `horizontalLayout` (rangs par plus long chemin, colonne = rang, ligne = couloir suivant la route de plus fort volume ; `portOffset` place le port dans la carte, au-dessus des satellites de ressources).
- `src/nodes/ProcessNode.jsx` : `<Handle type="target" position={Position.Left}>` et `<Handle type="source" position={Position.Right}>` **à l'intérieur** de `.process-card` (position relative), avant `<NodeResources>`. `src/nodes/StartEndNode.jsx` : mêmes ports gauche/droite.
- `src/edges/FlowEdge.jsx` + `src/utils/edgeRouting.js` : `placeEdgeLabels` décale les étiquettes verticalement pour éviter les nœuds, hypothèse horizontale.
- `src/utils/resources.js` : `resourceKinds` (`tools`→`toolsUsed`, `actors`→`actorsUsed`, `knowledge`→`knowledgeUsed`). Acteurs : `{ id, name, team, scope: 'internal'|'external' }`.
- Exemple KYC (`src/data/example.js`) : acteurs `kyc-analyst` (interne, équipe « Entrée en relation ») et `kyc-compliance` (externe, équipe « Conformité ») ; étapes `enhanced` et `officer` rattachées à `kyc-compliance` ; `risk`, `enhanced`, `archive` ont deux outils.

## Global Constraints

- Ne pas toucher aux formules métier (`src/utils/calculations.js`).
- Rien de nouveau dans le format de fichier : orientation et vue sont des préférences locales (localStorage), les bandes de couloirs ne sont jamais sauvegardées.
- Tests : `npm test` (`node --test tests/*.test.mjs`), imports avec extension `.js`. `npm run lint`, `npm test`, `npm run build` verts à la fin de chaque tâche.
- Les tests existants de `tests/layout.test.mjs` et `tests/kyc.test.mjs` sur `horizontalLayout` doivent rester verts sans modification.
- Textes d'interface en français (comme la barre d'outils actuelle).
- Commits en français, terminés par `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Pas de push ni de déploiement sans demande explicite.
- Vérification navigateur : le serveur de dev tourne déjà sur http://127.0.0.1:5173. Dans un onglet piloté, prendre une capture avant de mesurer le DOM (rAF gelé en onglet masqué).

## Fichiers

- Modifier : `src/App.jsx` (tâches 1, 6)
- Modifier : `src/utils/layout.js` ; tests `tests/layout.test.mjs` (tâche 2)
- Créer : `src/utils/lanes.js`, `tests/lanes.test.mjs` (tâche 3)
- Modifier : `src/store/useStore.js` (tâche 4)
- Modifier : `src/nodes/ProcessNode.jsx`, `src/nodes/StartEndNode.jsx`, `src/components/VSMCanvas.jsx`, `src/edges/FlowEdge.jsx`, `src/utils/edgeRouting.js`, `src/index.css` ; créer `src/nodes/LaneNode.jsx` (tâche 5)
- Modifier : `README.md`, `docs/REPRISE.md` (tâche 7)

---

### Task 1 : Panneaux masqués par défaut

**Files:**
- Modify: `src/App.jsx:13-24` (`usePanelPreference` et ses trois appels), `:66`, `:72`

**Interfaces:**
- Produces: clé de préférence `vsm.panel.v2.<nom>` (nouvelle version pour ignorer les anciens `true` déjà stockés). Palette et analyse sont **absentes du DOM** quand masquées ; les boutons de la barre d'outils les affichent. Le chevron interne de chaque panneau masque le panneau (un seul concept : visible / masqué).

- [ ] **Step 1 : Nouvelle clé et nouveaux défauts**

Dans `src/App.jsx`, remplacer la fonction `usePanelPreference` :

```js
// v2: palette and analysis start hidden; the key changed so stored v1 values no longer apply.
function usePanelPreference(key, initial) {
  const storageKey = `vsm.panel.v2.${key}`;
  const [value, setValue] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey)); return typeof saved === 'boolean' ? saved : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Layout remains usable without storage. */ } }, [storageKey, value]);
  return [value, setValue];
}
```

Puis remplacer les trois appels :

```js
  const [sidebar, setSidebar] = usePanelPreference('sidebar', false);
  const [properties, setProperties] = usePanelPreference('properties', false);
  const [analysis, setAnalysis] = usePanelPreference('analysis', false);
```

- [ ] **Step 2 : Ne pas rendre les panneaux masqués**

Remplacer la ligne `<Sidebar collapsed={!sidebar} ... />` par :

```jsx
      {sidebar && <Sidebar collapsed={false} onToggle={() => setSidebar(false)} onExpand={() => setSidebar(true)} />}
```

Remplacer `<Timeline collapsed={!analysis} onToggle={() => setAnalysis(!analysis)} />` par :

```jsx
        {analysis && <Timeline collapsed={false} onToggle={() => setAnalysis(false)} />}
```

- [ ] **Step 3 : Vérifier**

Run: `npm run lint && npm test`
Expected: vert.

Navigateur (recharger http://127.0.0.1:5173 après avoir vidé les clés `vsm.panel.*` ou simplement en nouvelle session privée) : au chargement, ni palette à gauche ni analyse en bas ; les boutons Palette et Analyse de la barre les font apparaître ; le chevron « Replier le rail » masque la palette ; le chevron « Replier l'analyse » masque l'analyse ; l'état survit à un rechargement.

- [ ] **Step 4 : Commit**

```bash
git add src/App.jsx
git commit -m "Interface : palette et analyse masquées par défaut

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2 : `layoutGraph` avec orientation et bandes de couloirs

**Files:**
- Modify: `src/utils/layout.js` (réécriture, `horizontalLayout` conservé comme alias)
- Test: `tests/layout.test.mjs` (ajouts)

**Interfaces:**
- Produces: `layoutGraph(nodes, edges, { orientation = 'horizontal', lanes = null, laneLabels = [] })` → `{ nodes, bands }` ou `{ error }`.
  - `lanes` : `Map<nodeId, laneIndex>` optionnelle. Absente → couloirs calculés comme aujourd'hui (route de plus fort volume sur le couloir 0). Présente → couloirs imposés ; deux nœuds de même couloir et même rang sont **empilés** dans le couloir au lieu d'être déplacés.
  - `bands` : `[{ key, label, x, y, width, height }]`, vide quand `lanes` est absent. Une bande par couloir, couvrant toute la longueur du flux.
  - `horizontalLayout(nodes, edges)` = `layoutGraph(nodes, edges, { orientation: 'horizontal' })` sans bandes, comportement inchangé.
- Convention : en horizontal, x = flux, y = couloir, ports gauche/droite à `portOffset(node)` sous le haut de la carte. En vertical, y = flux, x = couloir, ports en haut de la carte (y = 0) et en bas de la **carte** (y = `cardHeight(node)` = 2 × `portOffset`, au-dessus des satellites).

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à `tests/layout.test.mjs` (l'import de `createExample` depuis `addressExample.js` existe déjà) :

```js
import { layoutGraph } from '../src/utils/layout.js';

test('en vertical, chaque connexion descend et les branches occupent des colonnes distinctes', () => {
  const example = createExample();
  const { nodes, bands } = layoutGraph(example.nodes, example.edges, { orientation: 'vertical' });
  for (const edge of example.edges) {
    const source = nodes.find(n => n.id === edge.source);
    const target = nodes.find(n => n.id === edge.target);
    assert.ok(target.position.y > source.position.y + 100, edge.id);
  }
  const standard = nodes.find(n => n.id === 'standard');
  const exception = nodes.find(n => n.id === 'exception');
  assert.notEqual(standard.position.x, exception.position.x);
  // La route principale est centrée sur x = 0 par ses ports (largeur 300 par défaut).
  assert.equal(nodes.find(n => n.id === 'start').position.x + 120, 0);
  assert.equal(standard.position.x + 150, 0);
  assert.deepEqual(bands, []);
});

test('des couloirs imposés produisent une bande par couloir et empilent les nœuds de même rang', () => {
  const example = createExample();
  const lanes = new Map(example.nodes.map(n => [n.id, n.id === 'exception' || n.id === 'standard' ? 1 : 0]));
  const { nodes, bands } = layoutGraph(example.nodes, example.edges, { orientation: 'horizontal', lanes, laneLabels: ['Front', 'Back'] });
  assert.equal(bands.length, 2);
  assert.deepEqual(bands.map(b => b.label), ['Front', 'Back']);
  const inside = (n, b) => n.position.x >= b.x && n.position.y >= b.y && n.position.x + (n.width || 300) <= b.x + b.width && n.position.y + (n.height || 260) <= b.y + b.height;
  for (const n of nodes) assert.ok(inside(n, bands[lanes.get(n.id)]), n.id);
  // standard et exception ont le même rang et le même couloir : empilés sans chevauchement, même colonne.
  const s = nodes.find(n => n.id === 'standard'), e = nodes.find(n => n.id === 'exception');
  assert.equal(s.position.x, e.position.x);
  assert.ok(Math.abs(s.position.y - e.position.y) >= 260);
  // Les bandes couvrent tout le flux.
  const maxX = Math.max(...nodes.map(n => n.position.x + (n.width || 300)));
  for (const b of bands) assert.ok(b.x + b.width >= maxX);
});

test('en vertical avec couloirs, les bandes sont des colonnes', () => {
  const example = createExample();
  const lanes = new Map(example.nodes.map(n => [n.id, n.id === 'exception' ? 1 : 0]));
  const { nodes, bands } = layoutGraph(example.nodes, example.edges, { orientation: 'vertical', lanes, laneLabels: ['A', 'B'] });
  assert.equal(bands.length, 2);
  assert.ok(bands[1].x > bands[0].x);
  assert.equal(bands[0].y, bands[1].y);
  const e = nodes.find(n => n.id === 'exception');
  assert.ok(e.position.x >= bands[1].x && e.position.x + 300 <= bands[1].x + bands[1].width);
});
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `node --test tests/layout.test.mjs`
Expected: FAIL, `layoutGraph` n'est pas exporté.

- [ ] **Step 3 : Réécrire `src/utils/layout.js`**

Remplacer tout le fichier par :

```js
// Longest-path ranks ensure every edge advances along the flow axis (left→right or top→bottom).
// Cycles are left untouched: a real feedback loop needs an explicit business meaning.
const RESOURCE_FIELDS = ['toolsUsed', 'actorsUsed', 'knowledgeUsed'];
const width = node => node.width || (node.type === 'startEnd' ? 240 : 300);
const height = node => node.height || (node.type === 'startEnd' ? 100 : 260);
// Ports belong to the step card, not to the satellites extending below it.
export const portOffset = node => {
  if (node.type !== 'process') return height(node) / 2;
  const count = Math.max(0, ...RESOURCE_FIELDS.map(k => (node.data[k] || []).length));
  return Math.max(60, (height(node) - 44 - count * 100) / 2);
};
const cardHeight = node => (node.type === 'process' ? 2 * portOffset(node) : height(node));

function rankNodes(nodes, edges) {
  const ids = new Set(nodes.map(n => n.id));
  const incoming = new Map(nodes.map(n => [n.id, 0]));
  const outgoing = new Map(nodes.map(n => [n.id, []]));
  const rank = new Map(nodes.map(n => [n.id, 0]));
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) return { error: 'Une connexion pointe vers une étape absente.' };
    incoming.set(edge.target, incoming.get(edge.target) + 1);
    outgoing.get(edge.source).push(edge.target);
  }
  const queue = nodes.filter(n => incoming.get(n.id) === 0).map(n => n.id);
  let count = 0;
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    count++;
    for (const next of outgoing.get(id)) {
      rank.set(next, Math.max(rank.get(next), rank.get(id) + 1));
      incoming.set(next, incoming.get(next) - 1);
      if (!incoming.get(next)) queue.push(next);
    }
  }
  if (count !== nodes.length) return { error: 'Ce graphe contient une boucle. Sa disposition manuelle est conservée.' };
  // All exits belong at the end, even when their paths have different lengths.
  const ends = nodes.filter(n => n.type === 'startEnd' && n.data.type === 'end' && !outgoing.get(n.id).length);
  const lastRank = Math.max(0, ...rank.values());
  ends.forEach(n => rank.set(n.id, lastRank));
  return { rank, queue, outgoing };
}

// Flow view: the highest-volume route is lane 0, branches take the next free lane.
function flowLanes(nodes, edges, rank, queue) {
  const starts = nodes.filter(n => n.type === 'startEnd' && n.data.type === 'start' && !edges.some(e => e.target === n.id));
  const spine = new Set();
  let cursor = starts[0]?.id || queue[0];
  const weight = e => Number(e.data?.volume ?? nodes.find(n => n.id === e.target)?.data.volume_in ?? e.data?.percentage ?? 0);
  while (cursor && !spine.has(cursor)) {
    spine.add(cursor);
    const candidates = edges.filter(e => e.source === cursor);
    candidates.sort((a, b) => weight(b) - weight(a) || String(a.id || a.target).localeCompare(String(b.id || b.target)));
    cursor = candidates[0]?.target;
  }
  const lanes = new Map([...spine].map(id => [id, 0]));
  const occupied = new Set([...spine].map(id => `0:${rank.get(id)}`));
  for (const id of queue) {
    if (lanes.has(id)) continue;
    const parents = edges.filter(e => e.target === id).map(e => lanes.get(e.source)).filter(l => l > 0);
    let lane = parents.length ? Math.min(...parents) : 1;
    while (occupied.has(`${lane}:${rank.get(id)}`)) lane++;
    lanes.set(id, lane); occupied.add(`${lane}:${rank.get(id)}`);
  }
  return lanes;
}

export function layoutGraph(nodes, edges, { orientation = 'horizontal', lanes = null, laneLabels = [] } = {}) {
  const ranked = rankNodes(nodes, edges);
  if (ranked.error) return { error: ranked.error };
  const { rank, queue } = ranked;
  const vertical = orientation === 'vertical';
  const laneOf = lanes ? new Map(nodes.map(n => [n.id, lanes.get(n.id) ?? 0])) : flowLanes(nodes, edges, rank, queue);

  // Slot = position inside a lane when several nodes share lane and rank (swimlane mode only).
  const slot = new Map();
  const slotsPerLane = new Map();
  const seen = new Map();
  for (const n of nodes) {
    const key = `${laneOf.get(n.id)}:${rank.get(n.id)}`;
    const k = lanes ? (seen.get(key) || 0) : 0;
    seen.set(key, k + 1);
    slot.set(n.id, k);
    slotsPerLane.set(laneOf.get(n.id), Math.max(slotsPerLane.get(laneOf.get(n.id)) || 1, k + 1));
  }

  // Lane axis: thickness of one slot, then cumulative lane starts.
  const laneSize = n => (vertical ? width(n) : height(n));
  const slotPitch = vertical ? Math.max(420, ...nodes.map(n => width(n) + 120)) : Math.max(650, ...nodes.map(n => height(n) + 220));
  const laneCount = Math.max(0, ...laneOf.values()) + 1;
  const laneStart = [];
  let acc = 0;
  for (let l = 0; l < laneCount; l++) { laneStart[l] = acc; acc += slotPitch * (slotsPerLane.get(l) || 1); }
  // Lane-axis coordinate of a node's ports: lane start, plus one slot pitch per stacked node.
  const laneCenter = id => laneStart[laneOf.get(id)] + slotPitch * slot.get(id);

  // Flow axis: one column (or row) per rank, corridor proportional to the biggest lane jump.
  const columns = new Map();
  for (const node of nodes) {
    const level = rank.get(node.id);
    if (!columns.has(level)) columns.set(level, []);
    columns.get(level).push(node);
  }
  const ordered = [...columns].sort(([a], [b]) => a - b);
  const positions = new Map();
  const portLane = id => laneCenter(id); // lane-axis coordinate of the node's ports
  let flow = 0;
  for (const [level, column] of ordered) {
    for (const node of column) {
      const c = portLane(node.id);
      positions.set(node.id, vertical
        ? { x: c - width(node) / 2, y: flow }
        : { x: flow, y: c - portOffset(node) });
    }
    const adjacent = edges.filter(e => rank.get(e.source) === level && rank.get(e.target) === level + 1);
    const rise = Math.max(0, ...adjacent.map(e => Math.abs(portLane(e.target) - portLane(e.source))));
    const corridor = vertical ? Math.max(260, 160 + rise * 0.5) : Math.max(640, 380 + rise * 0.9);
    const extent = Math.max(vertical ? 100 : 300, ...column.map(n => (vertical ? height(n) : width(n))));
    flow += extent + corridor;
  }
  const flowLength = flow;

  const bands = lanes
    ? Array.from({ length: laneCount }, (_, l) => {
        const thickness = slotPitch * (slotsPerLane.get(l) || 1);
        const start = laneStart[l] - slotPitch / 2;
        return vertical
          ? { key: String(l), label: laneLabels[l] ?? `Couloir ${l + 1}`, x: start, y: -80, width: thickness, height: flowLength + 80 }
          : { key: String(l), label: laneLabels[l] ?? `Couloir ${l + 1}`, x: -80, y: start, width: flowLength + 80, height: thickness };
      })
    : [];
  return { nodes: nodes.map(node => ({ ...node, position: positions.get(node.id) })), bands };
}

export function horizontalLayout(nodes, edges) {
  const result = layoutGraph(nodes, edges, { orientation: 'horizontal' });
  return result.error ? result : { nodes: result.nodes };
}
```

Retirer aussi la ligne `const laneSize = ...` (non utilisée) avant de lancer le lint.

Points de vigilance :
- En vue flux (`lanes` absent), `slot` vaut toujours 0 et `laneStart[l] = l × slotPitch`, donc `laneCenter = l × slotPitch` : identique à l'ancien `lanes.get(id) * lanePitch`. Le port du couloir 0 reste à 0, ce que vérifient les tests existants (`port(id) === 0`).
- Le corridor horizontal conserve les constantes actuelles (640 / 380 + 0.9 × rise) pour ne pas changer la disposition que Daniel apprécie.
- Les bandes commencent à `laneStart - slotPitch/2` pour centrer les cartes dans leur bande.

- [ ] **Step 4 : Vérifier**

Run: `node --test tests/layout.test.mjs tests/kyc.test.mjs && npm test && npm run lint`
Expected: les tests existants passent inchangés ; 3 nouveaux tests verts ; total 25.

- [ ] **Step 5 : Commit**

```bash
git add src/utils/layout.js tests/layout.test.mjs
git commit -m "Disposition : orientation verticale et couloirs imposés avec bandes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3 : Affectation des couloirs par outil, acteur ou équipe

**Files:**
- Create: `src/utils/lanes.js`
- Test: `tests/lanes.test.mjs`

**Interfaces:**
- Produces: `assignLanes(nodes, edges, mode, { tools, actors })` avec `mode ∈ 'tools' | 'actors' | 'teams'` → `{ lanes: Map<nodeId, laneIndex>, labels: string[], multi: [{ id, label, count }] }`.
  - `tools` : un couloir par outil rattaché (ordre de la bibliothèque), puis « Sans outil ».
  - `actors` : un couloir par acteur **interne** rattaché (ordre de la bibliothèque), puis « Équipes externes » (étapes qui n'ont que des acteurs externes), puis « Sans acteur ».
  - `teams` : un couloir par équipe d'acteur **externe** (champ `team`, sinon le nom de l'acteur), puis « Notre équipe » (étapes sans acteur externe), puis « Sans acteur » (aucun acteur).
  - Une étape avec plusieurs ressources candidates prend le premier couloir dans l'ordre de la bibliothèque et figure dans `multi`.
  - Entrées/sorties : couloir de leur première étape voisine (sortante pour une entrée, entrante pour une sortie), sinon 0.
- Consumed by: tâche 6 (`App.jsx`).

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `tests/lanes.test.mjs` :

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { assignLanes } from '../src/utils/lanes.js';
import { createExample } from '../src/data/example.js';

const kyc = () => { const e = createExample(); return { nodes: e.nodes, edges: e.edges, libraries: { tools: e.tools, actors: e.actors } }; };
const laneLabel = (r, id) => r.labels[r.lanes.get(id)];

test('vue outils : un couloir par outil dans l’ordre de la bibliothèque, étapes multi-outils signalées', () => {
  const { nodes, edges, libraries } = kyc();
  const r = assignLanes(nodes, edges, 'tools', libraries);
  assert.equal(laneLabel(r, 'intake'), 'SharePoint');
  assert.equal(laneLabel(r, 'extract'), 'OCR documentaire');
  assert.equal(laneLabel(r, 'complete'), 'Excel');
  // risk a ['kyc-case','kyc-web'] : Excel est avant Internet ? Non : l'ordre de la bibliothèque place Internet en premier.
  assert.equal(laneLabel(r, 'risk'), 'Internet');
  assert.deepEqual(r.multi.map(m => m.id).sort(), ['archive', 'enhanced', 'risk']);
  assert.equal(r.multi.find(m => m.id === 'risk').count, 2);
  // Les libellés suivent l'ordre de la bibliothèque, sans couloir vide.
  assert.ok(r.labels.indexOf('Internet') < r.labels.indexOf('Excel'));
  assert.ok(r.labels.includes('Outlook')); // utilisé par « Demander les compléments »
  assert.ok(!r.labels.includes('Sans outil')); // toutes les étapes KYC ont au moins un outil
  // L'entrée suit sa première étape, la sortie sa dernière.
  assert.equal(r.lanes.get('start'), r.lanes.get('intake'));
  assert.equal(r.lanes.get('end'), r.lanes.get('archive'));
});

test('vue acteurs : acteurs internes, puis équipes externes, puis sans acteur', () => {
  const { nodes, edges, libraries } = kyc();
  const r = assignLanes(nodes, edges, 'actors', libraries);
  assert.equal(laneLabel(r, 'intake'), 'Analyste KYC');
  assert.equal(laneLabel(r, 'enhanced'), 'Équipes externes');
  assert.equal(laneLabel(r, 'officer'), 'Équipes externes');
  assert.equal(laneLabel(r, 'extract'), 'Sans acteur');
  assert.deepEqual(r.labels, ['Analyste KYC', 'Équipes externes', 'Sans acteur']);
  assert.deepEqual(r.multi, []);
});

test('vue équipes : une équipe par acteur externe, le reste dans Notre équipe', () => {
  const { nodes, edges, libraries } = kyc();
  const r = assignLanes(nodes, edges, 'teams', libraries);
  assert.equal(laneLabel(r, 'enhanced'), 'Conformité');
  assert.equal(laneLabel(r, 'officer'), 'Conformité');
  assert.equal(laneLabel(r, 'intake'), 'Notre équipe');
  assert.equal(laneLabel(r, 'extract'), 'Sans acteur');
  assert.deepEqual(r.labels, ['Conformité', 'Notre équipe', 'Sans acteur']);
});

test('un acteur externe sans champ équipe forme une équipe à son nom ; une ressource inconnue est ignorée', () => {
  const nodes = [
    { id: 's', type: 'startEnd', data: { type: 'start' } },
    { id: 'p', type: 'process', data: { actorsUsed: ['ext', 'ghost'] } },
    { id: 'e', type: 'startEnd', data: { type: 'end' } },
  ];
  const edges = [{ id: 'a', source: 's', target: 'p' }, { id: 'b', source: 'p', target: 'e' }];
  const r = assignLanes(nodes, edges, 'teams', { tools: [], actors: [{ id: 'ext', name: 'Cabinet externe', scope: 'external' }] });
  assert.deepEqual(r.labels, ['Cabinet externe']);
  assert.equal(r.lanes.get('s'), 0);
  assert.equal(r.lanes.get('e'), 0);
  assert.deepEqual(r.multi, []);
});
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

Run: `node --test tests/lanes.test.mjs`
Expected: FAIL, module introuvable.

- [ ] **Step 3 : Écrire `src/utils/lanes.js`**

```js
// Turns a view (tools / actors / teams) into a lane per resource, using the local libraries only.
// Actors: scope 'internal' (default) = our people; scope 'external' = another team called into the flow.
const isExternal = actor => actor?.scope === 'external';

const FALLBACK = {
  tools: ['Sans outil'],
  actors: ['Équipes externes', 'Sans acteur'],
  teams: ['Notre équipe', 'Sans acteur'],
};

// Candidate lane keys of one process node, in library order. Each key: { key, label }.
function candidates(node, mode, { tools = [], actors = [] }) {
  const data = node.data || {};
  if (mode === 'tools') {
    const used = new Set(data.toolsUsed || []);
    const found = tools.filter(t => used.has(t.id)).map(t => ({ key: `tool:${t.id}`, label: t.name }));
    return found.length ? found : [{ key: 'fallback:0', label: FALLBACK.tools[0] }];
  }
  const used = new Set(data.actorsUsed || []);
  const known = actors.filter(a => used.has(a.id));
  if (mode === 'actors') {
    const internal = known.filter(a => !isExternal(a)).map(a => ({ key: `actor:${a.id}`, label: a.name }));
    if (internal.length) return internal;
    if (known.length) return [{ key: 'fallback:0', label: FALLBACK.actors[0] }];
    return [{ key: 'fallback:1', label: FALLBACK.actors[1] }];
  }
  // teams
  const external = known.filter(isExternal);
  const teams = [];
  for (const a of external) {
    const label = (a.team || '').trim() || a.name;
    if (!teams.some(t => t.label === label)) teams.push({ key: `team:${label}`, label });
  }
  if (teams.length) return teams;
  if (known.length) return [{ key: 'fallback:0', label: FALLBACK.teams[0] }];
  return [{ key: 'fallback:1', label: FALLBACK.teams[1] }];
}

export function assignLanes(nodes, edges, mode, libraries) {
  if (!['tools', 'actors', 'teams'].includes(mode)) throw new Error(`Unknown view: ${mode}`);
  // 1. Resource lanes in library order, then fallback lanes, keeping only lanes that are used.
  const order = new Map(); // key -> { label, index }
  const byNode = new Map();
  const multi = [];
  for (const node of nodes) {
    if (node.type !== 'process') continue;
    const list = candidates(node, mode, libraries);
    byNode.set(node.id, list[0].key);
    list.forEach(c => { if (!order.has(c.key)) order.set(c.key, { label: c.label, index: 0 }); });
    if (list.length > 1) multi.push({ id: node.id, label: node.data?.label || node.id, count: list.length });
  }
  const used = new Set(byNode.values());
  const libraryRank = key => {
    const [kind, id] = key.split(':');
    if (kind === 'tool') return libraries.tools.findIndex(t => String(t.id) === id);
    if (kind === 'actor') return libraries.actors.findIndex(a => String(a.id) === id);
    if (kind === 'team') return Math.min(...libraries.actors.map((a, i) => (((a.team || '').trim() || a.name) === id && isExternal(a) ? i : Infinity)));
    return 1e6 + Number(id); // fallback lanes last, in their declared order
  };
  const keys = [...order.keys()].filter(k => used.has(k)).sort((a, b) => libraryRank(a) - libraryRank(b));
  const indexOf = new Map(keys.map((k, i) => [k, i]));
  const labels = keys.map(k => order.get(k).label);

  // 2. Terminals follow their neighbouring step.
  const lanes = new Map();
  for (const node of nodes) if (byNode.has(node.id)) lanes.set(node.id, indexOf.get(byNode.get(node.id)));
  for (const node of nodes) {
    if (lanes.has(node.id)) continue;
    const neighbour = node.data?.type === 'end'
      ? edges.find(e => e.target === node.id && lanes.has(e.source))?.source
      : edges.find(e => e.source === node.id && lanes.has(e.target))?.target;
    lanes.set(node.id, neighbour !== undefined ? lanes.get(neighbour) : 0);
  }
  return { lanes, labels, multi };
}
```

Note sur le premier test : la bibliothèque KYC liste Internet (`kyc-web`) avant Excel (`kyc-case`), donc `risk` (Excel + Internet) va dans le couloir Internet. C'est le comportement « premier couloir dans l'ordre de la bibliothèque » demandé ; l'ordre de la bibliothèque est donc le levier de l'utilisateur.

- [ ] **Step 4 : Vérifier**

Run: `node --test tests/lanes.test.mjs && npm test && npm run lint`
Expected: 4 tests verts ; total 29.

- [ ] **Step 5 : Commit**

```bash
git add src/utils/lanes.js tests/lanes.test.mjs
git commit -m "Couloirs : affectation par outil, acteur interne ou équipe externe

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4 : Store — orientation, vue et bandes

**Files:**
- Modify: `src/store/useStore.js` (après `edgeLabelSizes: {}` ; et `resetGraph`)

**Interfaces:**
- Produces: état `orientation: 'horizontal' | 'vertical'` (localStorage `vsm.orientation`), `viewMode: 'flow' | 'tools' | 'actors' | 'teams'` (localStorage `vsm.view`), `laneBands: []` (jamais persisté). Actions `setOrientation(o)`, `setViewMode(m)`, `setLaneBands(bands)`.

- [ ] **Step 1 : Ajouter l'état et les actions**

Dans `src/store/useStore.js`, après la ligne `edgeLabelSizes: {},` ajouter :

```js
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
```

Dans `resetGraph`, ajouter `laneBands: [],` à côté de `edgeLabelSizes: {}`. Dans `setGraph`, ajouter `laneBands: []` au `set` (un fichier ouvert garde ses positions, sans bandes, jusqu'au prochain « Aligner »).

- [ ] **Step 2 : Vérifier**

Run: `npm run lint && npm test`
Expected: vert.

- [ ] **Step 3 : Commit**

```bash
git add src/store/useStore.js
git commit -m "Store : orientation, vue et bandes de couloirs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5 : Cartes orientables, bandes de couloirs et étiquettes d'arêtes

**Files:**
- Modify: `src/nodes/ProcessNode.jsx:1-9` (imports, hooks) et les deux `<Handle>` (lignes ~89-99 et ~333-341)
- Modify: `src/nodes/StartEndNode.jsx` (imports, hooks, deux `<Handle>`)
- Create: `src/nodes/LaneNode.jsx`
- Modify: `src/components/VSMCanvas.jsx` (`nodeTypes`, `displayNodes`, `onNodeClick`, `onNodeMouseEnter`)
- Modify: `src/utils/edgeRouting.js` (`placeEdgeLabels` prend `orientation`), `src/edges/FlowEdge.jsx` (le passe)
- Modify: `src/index.css` (classe `.lane-band`)

**Interfaces:**
- Produces: composant `LaneNode` (type `lane`) qui rend `data.label`, `data.width`, `data.height`. Les nœuds de bande ont l'id `lane:<key>`, `draggable: false`, `selectable: false`, `connectable: false`, `zIndex: -1` ; ils vivent uniquement dans `displayNodes` du canevas, jamais dans `store.nodes`.
- `placeEdgeLabels(nodes, edges, sizes, orientation = 'horizontal')`.

- [ ] **Step 1 : Ports orientables dans `ProcessNode.jsx`**

Remplacer les imports de tête :

```js
import React, { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
```

Après `const { addNextNode } = useStore();` ajouter :

```js
    const vertical = useStore(s => s.orientation === 'vertical');
    const updateNodeInternals = useUpdateNodeInternals();
    // Handles move between left/right and top/bottom: React Flow must re-measure them.
    useEffect(() => { updateNodeInternals(id); }, [vertical, id, updateNodeInternals]);
```

Remplacer le premier `<Handle type="target" ...>` par :

```jsx
            <Handle
                type="target"
                position={vertical ? Position.Top : Position.Left}
                style={vertical
                    ? { background: '#7e99a8', width: '12px', height: '12px', top: '-6px', left: '50%', transform: 'translateX(-50%)' }
                    : { background: '#7e99a8', width: '12px', height: '12px', left: '-6px', top: '50%', transform: 'translateY(-50%)' }}
            />
```

Remplacer le `<Handle type="source" ...>` de fin par :

```jsx
            <Handle
                type="source"
                position={vertical ? Position.Bottom : Position.Right}
                style={vertical
                    ? { background: '#7e99a8', width: '12px', height: '12px', bottom: '-6px', left: '50%', transform: 'translateX(-50%)', top: 'auto' }
                    : { background: '#7e99a8', width: '12px', height: '12px', right: '-6px' }}
            />
```

Les deux ports restent dans `.process-card` (position relative) : en vertical, le port bas est au bas de la **carte**, au-dessus des satellites de ressources, ce que suppose `cardHeight` dans la disposition.

- [ ] **Step 2 : Ports orientables dans `StartEndNode.jsx`**

Remplacer les imports :

```js
import React, { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { ArrowRightToLine, ArrowRightFromLine, ArrowDownToLine, ArrowDownFromLine, Paperclip } from 'lucide-react';
import useStore from '../store/useStore';
```

Changer la signature en `const StartEndNode = ({ id, data, selected }) => {` et ajouter après `const isStart = ...` :

```js
    const vertical = useStore(s => s.orientation === 'vertical');
    const updateNodeInternals = useUpdateNodeInternals();
    useEffect(() => { updateNodeInternals(id); }, [vertical, id, updateNodeInternals]);
    const port = vertical
        ? { background: '#7e99a8', width: '12px', height: '12px', left: '50%', transform: 'translateX(-50%)' }
        : { background: '#7e99a8', width: '12px', height: '12px' };
```

Remplacer les deux `<Handle>` :

```jsx
            {!isStart && <Handle type="target" position={vertical ? Position.Top : Position.Left} style={vertical ? { ...port, top: '-6px' } : { ...port, left: '-6px' }} />}
```

```jsx
            {isStart && <Handle type="source" position={vertical ? Position.Bottom : Position.Right} style={vertical ? { ...port, bottom: '-6px', top: 'auto' } : { ...port, right: '-6px' }} />}
```

Et les icônes : `isStart ? (vertical ? <ArrowDownToLine .../> : <ArrowRightToLine .../>) : (vertical ? <ArrowDownFromLine .../> : <ArrowRightFromLine .../>)` avec les mêmes props `size={20} color={nodeBorder}` et `aria-label`.

- [ ] **Step 3 : Composant de bande**

Créer `src/nodes/LaneNode.jsx` :

```jsx
import { memo } from 'react';

// Background band of one swimlane. Not interactive: it only carries a label and a size.
const LaneNode = ({ data }) => (
    <div className={`lane-band ${data.orientation === 'vertical' ? 'is-vertical' : ''}`} style={{ width: data.width, height: data.height }}>
        <span className="lane-band-label">{data.label}</span>
    </div>
);

export default memo(LaneNode);
```

Ajouter à `src/index.css` :

```css
.react-flow__node-lane { pointer-events: none; }
.lane-band { box-sizing: border-box; border: 1px dashed #2c4250; border-radius: 6px; background: rgba(28, 44, 55, .32); }
.lane-band:nth-of-type(even) { background: rgba(28, 44, 55, .18); }
.lane-band-label { position: absolute; top: 10px; left: 14px; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #8fb0c2; }
.lane-band.is-vertical .lane-band-label { writing-mode: horizontal-tb; }
```

- [ ] **Step 4 : Rendre les bandes dans le canevas**

Dans `src/components/VSMCanvas.jsx` :

```js
import LaneNode from '../nodes/LaneNode';
```

Dans le `useMemo` de `nodeTypes`, ajouter `lane: LaneNode,`.

Lire les bandes et l'orientation depuis le store, à côté des autres champs destructurés : ajouter `laneBands,` et `orientation,` dans le `useStore()`.

Remplacer le `return nodes.map(node => {` de `displayNodes` par un calcul qui préfixe les bandes :

```js
    const displayNodes = useMemo(() => {
        const bands = laneBands.map(b => ({
            id: `lane:${b.key}`,
            type: 'lane',
            position: { x: b.x, y: b.y },
            data: { label: b.label, width: b.width, height: b.height, orientation },
            draggable: false, selectable: false, connectable: false, focusable: false,
            zIndex: -1,
        }));
        const decorated = nodes.map(node => {
            // ... corps actuel inchangé (calcul de className) ...
            return { ...node, className };
        });
        return [...bands, ...decorated];
    }, [nodes, laneBands, orientation, hoveredNodeId, selectedNodeId, upstreamNodes, downstreamNodes, selectedItemId, lineageData]);
```

Dans `onNodeClick` et `onNodeMouseEnter`, ignorer les bandes : première ligne `if (node.type === 'lane') return;`.

Note : React Flow renvoie des changements de dimension pour les bandes ; `applyNodeChanges` les ignore car leur id n'existe pas dans `store.nodes`. `getNodes()` dans `App.jsx` les inclut : la tâche 6 filtre `type !== 'lane'` avant toute disposition.

- [ ] **Step 5 : Étiquettes d'arêtes selon l'orientation**

Dans `src/utils/edgeRouting.js`, changer la signature en `export function placeEdgeLabels(nodes, edges, sizes = {}, orientation = 'horizontal')` et remplacer le calcul de `x`, `initialY` et la boucle de candidats par :

```js
    const vertical = orientation === 'vertical';
    const anchorX = sizes[edge.id]?.anchorX;
    const anchorY = sizes[edge.id]?.anchorY;
    const x0 = anchorX !== undefined ? anchorX - width / 2
      : vertical ? (source.position.x + target.position.x) / 2 + (source.width || 300) / 2 - width / 2 : (left + right - width) / 2;
    const y0 = anchorY !== undefined ? anchorY - height / 2
      : vertical ? (source.position.y + (source.height || 450) + target.position.y - height) / 2 : (source.position.y + target.position.y) / 2 + 100 - height / 2;
    let box;
    for (let i = 0; i < 400; i++) {
      const offset = Math.ceil(i / 2) * 32 * (i % 2 ? -1 : 1);
      // Slide across the lane axis: vertically in a horizontal map, horizontally in a vertical one.
      const candidate = vertical ? { x: x0 + offset, y: y0, width, height } : { x: x0, y: y0 + offset, width, height };
      if (!obstacles.some(o => intersects(candidate, o, 28))) { box = candidate; break; }
    }
    if (!box) box = vertical
      ? { x: Math.max(...obstacles.map(o => o.x + o.width)) + 48, y: y0, width, height }
      : { x: x0, y: Math.min(0, ...obstacles.map(o => o.y)) - height - 48, width, height };
```

(les variables `left` et `right` existantes restent utilisées par la branche horizontale.)

Dans `src/edges/FlowEdge.jsx` : lire `const orientation = useStore(s => s.orientation);` et passer `placeEdgeLabels(nodes, edges, sizes, orientation)` avec `orientation` dans les dépendances du `useMemo`.

- [ ] **Step 6 : Vérifier**

Run: `npm run lint && npm test && npm run build`
Expected: vert (les tests d'`edgeRouting` appellent `placeEdgeLabels` sans 4e argument : horizontal par défaut).

Navigateur : rien ne change encore en horizontal (vérifier l'exemple : ports gauche/droite, arêtes présentes). Basculer manuellement `localStorage.setItem('vsm.orientation','vertical')` puis recharger : ports en haut et en bas des cartes, arêtes toujours reliées aux ports.

- [ ] **Step 7 : Commit**

```bash
git add src/nodes/ProcessNode.jsx src/nodes/StartEndNode.jsx src/nodes/LaneNode.jsx src/components/VSMCanvas.jsx src/utils/edgeRouting.js src/edges/FlowEdge.jsx src/index.css
git commit -m "Canevas : ports orientables, bandes de couloirs, étiquettes selon l'orientation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6 : Barre d'outils — bascule d'orientation et sélecteur de vue

**Files:**
- Modify: `src/App.jsx` (imports, `Workspace`, barre d'outils, légende du canevas)
- Modify: `src/index.css` (style du `<select>` de la barre)

**Interfaces:**
- Consumes: `layoutGraph` (tâche 2), `assignLanes` (tâche 3), `orientation` / `viewMode` / `laneBands` (tâche 4).
- Produces: fonction `applyLayout(orientation, viewMode)` unique, utilisée par « Aligner », par la bascule Horizontal/Vertical, par le sélecteur de vue et par « Exemple ».

- [ ] **Step 1 : Imports et fonction centrale**

Remplacer `import { horizontalLayout } from './utils/layout';` par :

```js
import { layoutGraph } from './utils/layout';
import { assignLanes } from './utils/lanes';
```

Ajouter `AlignVerticalSpaceAround, Columns3` à l'import lucide (les deux icônes existent dans lucide-react 0.554).

Dans `Workspace`, remplacer la destructuration du store et `arrange` / `loadExample` :

```js
  const { nodes, edges, setGraph, setFileHandle, selectedNodeId, orientation, viewMode, setOrientation, setViewMode } = useStore();
  const { fitView, getNodes } = useReactFlow();
  const frame = () => requestAnimationFrame(() => requestAnimationFrame(() => fitView({ padding: 0.15, duration: 0, minZoom: 0.1, maxZoom: 1 })));
  const VIEW_LABELS = { flow: 'flux', tools: 'outils', actors: 'acteurs', teams: 'équipes' };

  // One entry point for every re-layout: measured nodes (without lane bands) + current preferences.
  const applyLayout = (nextOrientation, nextView) => {
    const graphNodes = getNodes().filter(n => n.type !== 'lane');
    if (!graphNodes.length) return;
    const { tools, actors, edges: currentEdges } = useStore.getState();
    const grouping = nextView === 'flow' ? null : assignLanes(graphNodes, currentEdges, nextView, { tools, actors });
    const result = layoutGraph(graphNodes, currentEdges, { orientation: nextOrientation, lanes: grouping?.lanes, laneLabels: grouping?.labels });
    if (result.error) return setNotice(result.error);
    useStore.setState({ nodes: result.nodes, laneBands: result.bands });
    const direction = nextOrientation === 'vertical' ? 'de haut en bas' : 'de gauche à droite';
    const multi = grouping?.multi.length
      ? ` · ${grouping.multi.length} étape${grouping.multi.length > 1 ? 's' : ''} avec plusieurs ${VIEW_LABELS[nextView]} placée${grouping.multi.length > 1 ? 's' : ''} dans le premier couloir : ${grouping.multi.map(m => m.label).join(', ')}`
      : '';
    setNotice(nextView === 'flow'
      ? `Disposition ${direction} · branches parallèles et convergence en fin de flux.`
      : `Vue par ${VIEW_LABELS[nextView]} · ${grouping.labels.length} couloir${grouping.labels.length > 1 ? 's' : ''} ${direction}${multi}`);
    frame();
  };
  const arrange = () => applyLayout(orientation, viewMode);
  const toggleOrientation = () => { const next = orientation === 'vertical' ? 'horizontal' : 'vertical'; setOrientation(next); applyLayout(next, viewMode); };
  const changeView = (next) => { setViewMode(next); applyLayout(orientation, next); };
  const loadExample = () => {
    if (nodes.length && !window.confirm('Remplacer la carte actuelle par l’exemple ? Enregistrez votre travail avant de continuer.')) return;
    const example = createExample();
    useStore.getState().mergeLibraries(example);
    setGraph(example.nodes, example.edges, example.title);
    setFileHandle(null);
    setNotice('KYC fictif · 100 dossiers/jour · Routages et temps illustratifs · Aucune décision réelle.');
    requestAnimationFrame(() => requestAnimationFrame(() => applyLayout(orientation, viewMode)));
  };
```

Remarque : `setOrientation` déclenche le repositionnement des ports (tâche 5) ; `applyLayout` est appelé dans le même tick avec les nœuds mesurés actuels, ce qui suffit car les dimensions des cartes ne changent pas avec l'orientation.

- [ ] **Step 2 : Barre d'outils et légende**

Remplacer le contenu de `<div className="toolbar-group">` :

```jsx
        <button onClick={loadExample}><FlaskConical size={14} /> Exemple</button>
        <button onClick={arrange} disabled={!nodes.length}><Columns3 size={14} /> Aligner</button>
        <button onClick={toggleOrientation} disabled={!nodes.length} aria-label="Basculer l’orientation" title="Basculer entre lecture horizontale et verticale">
          {orientation === 'vertical' ? <AlignVerticalSpaceAround size={14} /> : <AlignHorizontalSpaceAround size={14} />} {orientation === 'vertical' ? 'Vertical' : 'Horizontal'}
        </button>
        <select className="toolbar-select" aria-label="Vue" value={viewMode} onChange={e => changeView(e.target.value)} disabled={!nodes.length}>
          <option value="flow">Vue : flux</option>
          <option value="tools">Vue : outils</option>
          <option value="actors">Vue : acteurs</option>
          <option value="teams">Vue : équipes</option>
        </select>
        <button onClick={frame}><Scan size={14} /> Vue globale</button>
        {selectedNodeId && <button onClick={() => fitView({ nodes:[{id:selectedNodeId}], padding:0.5, maxZoom:1, duration:200 })}>Centrer l’étape</button>}
        <span className="toolbar-divider" />
        <button aria-label="Palette" aria-pressed={sidebar} onClick={() => setSidebar(!sidebar)}><PanelLeft size={16} /></button>
        <button aria-label="Analyse" aria-pressed={analysis} onClick={() => setAnalysis(!analysis)}><ChartNoAxesCombined size={16} /></button>
        <button aria-label="Inspecteur" aria-pressed={properties} onClick={() => setProperties(!properties)}><PanelRight size={16} /></button>
```

Remplacer la légende :

```jsx
          <div className="canvas-caption">{orientation === 'vertical' ? 'HAUT → BAS' : 'GAUCHE → DROITE'} <span>Glisser pour explorer · Molette pour zoomer</span></div>
```

Ajouter à `src/index.css`, après `.toolbar-divider` :

```css
.toolbar-select { padding: 6px 8px; border: 1px solid #354e5d; border-radius: 4px; background: #0d171e; color: #b4c6d0; font-size: 11px; }
.toolbar-select:disabled { opacity: .5; }
```

- [ ] **Step 3 : Vérifier**

Run: `npm run lint && npm test && npm run build`
Expected: vert.

Navigateur, sur http://127.0.0.1:5173 (prendre une capture avant chaque mesure du DOM) :
1. Charger **Exemple** : disposition horizontale identique à avant, aucune bande.
2. Cliquer **Horizontal** → devient **Vertical** : la carte se lit de haut en bas, ports en haut/bas, arêtes reliées, légende « HAUT → BAS ». Recharger la page : la préférence est conservée. Recliquer : retour horizontal.
3. Vue : outils → bandes nommées Internet, Outlook, SharePoint, Power Automate, Excel, OCR documentaire, World-Check · screening, Core Banking, Sans outil (seules celles utilisées) ; bandeau signalant « 3 étapes avec plusieurs outils… : Qualifier le risque, Vigilance renforcée, Constituer la piste d'audit ».
4. Vue : acteurs → 3 couloirs : Analyste KYC, Équipes externes (Vigilance renforcée, Arbitrer le dossier sensible), Sans acteur (étapes AI et IT).
5. Vue : équipes → 3 couloirs : Conformité, Notre équipe, Sans acteur.
6. Vue : flux → bandes disparaissent.
7. Chaque vue fonctionne dans les deux orientations ; « Aligner » réapplique la vue courante.
8. File > Save puis File > Open : le fichier ne contient ni bandes ni orientation (`grep -c lane` sur le `.vsm` = 0) et se rouvre correctement.

- [ ] **Step 4 : Commit**

```bash
git add src/App.jsx src/index.css
git commit -m "Barre d'outils : bascule horizontal/vertical et vues par outil, acteur, équipe

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7 : Documentation

**Files:**
- Modify: `README.md` (section « Première version graphique »), `docs/REPRISE.md`

- [ ] **Step 1 : README**

Dans « Première version graphique », remplacer la phrase « Utiliser **Exemple** pour charger le processus bancaire, **Aligner** pour ordonner les étapes de gauche à droite, et les boutons de panneaux pour ajuster l'espace. » par :

« Utiliser **Exemple** pour charger le processus bancaire, **Aligner** pour réappliquer la disposition, **Horizontal / Vertical** pour changer le sens de lecture, et **Vue** pour passer du flux aux couloirs par outil, par acteur interne ou par équipe externe. La palette et l'analyse sont masquées au démarrage ; les boutons de la barre les affichent. »

- [ ] **Step 2 : REPRISE.md**

Ajouter une section `## Orientation et vues (septembre 2026)` :

- Panneaux masqués par défaut (clé `vsm.panel.v2.*`).
- `layoutGraph(nodes, edges, { orientation, lanes, laneLabels })` → `{ nodes, bands }` ; `horizontalLayout` conservé.
- `assignLanes` : règles outils / acteurs internes / équipes externes, étape multi-ressource dans le premier couloir de la bibliothèque et signalée.
- Bandes rendues comme nœuds `lane` non interactifs, jamais sauvegardées ; orientation et vue en localStorage.
- Limites connues : un fichier ouvert garde ses positions jusqu'au prochain « Aligner » ; une étape n'appartient qu'à un couloir.

- [ ] **Step 3 : Commit**

```bash
git add README.md docs/REPRISE.md
git commit -m "Docs : orientation, vues en couloirs et panneaux masqués

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Vérification finale

1. `npm run lint && npm test && npm run build` : 29 tests, build sans erreur.
2. Parcours navigateur de la tâche 6, étapes 1 à 8, dans les deux orientations.
3. Le fichier `.vsm` sauvegardé après une vue en couloirs ne contient ni `lane` ni `orientation`.
4. Aucun push ni déploiement : à faire sur demande, comme pour la remédiation.

## Hors périmètre

Filtre / surbrillance d'une ressource sans réorganiser la carte ; une étape dans plusieurs couloirs ; ordre manuel des couloirs (aujourd'hui : ordre de la bibliothèque) ; sauvegarde de l'orientation dans le fichier.
