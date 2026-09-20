# Reprise VSM v2

Diagnostic initial du 20 septembre 2026.
Source : https://github.com/Leonidas300DH/vsm
Commit de référence : 1862e9a9663bdb43b4ae00e4818ac5438cb9bc57.
Branche locale : reprise/v2.

## Concepts à conserver

- Cartographie visuelle : débuts, fins, processus, acteurs et systèmes IT.
- Volumes par catégorie de dossier et routage global, par catégorie ou par reliquat.
- Temps de traitement par catégorie et estimation de charge/ETP.
- Traçabilité des éléments, documents associés et catalogue d'outils.
- Vues des étapes, de l'utilisation des outils et des points de friction.
- Import/export de projets JSON .vsm et export PDF.

Ces fonctions sont repérées dans le code, pas encore validées de bout en bout.

## Diagnostic technique

La pile React 19, Vite 7, React Flow 11 et Zustand peut être conservée. Une réécriture intégrale n'est pas justifiée par la seule ancienneté du projet. Aucun backend identifié.

1. Calculs métier (src/utils/calculations.js) : conserver explicitement le processing time, les temps d’attente et le lead time, conformément à l’intention produit confirmée par Daniel. Leur coexistence et leur combinaison sont voulues. Le point à vérifier concerne le périmètre des agrégations : le code calcule actuellement volume × temps unitaire puis ajoute les attentes de plusieurs catégories et branches. Préciser si chaque indicateur décrit un dossier, un lot ou un parcours, ainsi que les unités et la période des volumes, avant de modifier les formules. Ne pas assimiler la présence de ces trois concepts à une erreur métier.
2. Validation du graphe : cycles non explicitement signalés par le tri topologique ; référence à un nœud absent susceptible de provoquer une erreur ; validation numérique à renforcer.
3. Pureté du moteur : des champs des nœuds d'entrée sont modifiés malgré la création de copies. Séparer données saisies et données calculées.
4. Placement (VSMCanvas.jsx) : décalages fixes de 250/60 pixels, sans conversion selon le zoom et le déplacement du canevas.
5. État (useStore.js) : action de titre dupliquée, sélections non réinitialisées au changement de projet, absence de recalcul directement dans onNodesChange. Vérifier les suppressions avec l'ensemble des callbacks React Flow.
6. Persistance : pas de sauvegarde automatique du projet courant ; pièces jointes stockées séparément dans IndexedDB, donc non intégrées au seul JSON exporté. Import sans schéma complet.
7. Interface : gros composants et styles en ligne ; timeline ordonnée selon la position horizontale des nœuds plutôt que selon les parcours du graphe.

## Vérifications effectuées

- npm ci : réussi.
- npm run build : réussi ; avertissement de taille, bundle principal supérieur à 1 Mo non compressé.
- npm run lint : échec, 18 erreurs héritées.
- npm audit à l'installation : 18 vulnérabilités signalées (1 faible, 6 modérées, 10 élevées, 1 critique). Applicabilité à analyser avant mise à niveau.
- Serveur local démarré et interface initiale observée dans le navigateur.
- Aucun test automatisé fourni ; import/export, pièces jointes et justesse des calculs non validés de bout en bout.

## Plan de reprise proposé

1. Définir le modèle métier et un schéma de fichier versionné, avec migration du format historique. Établir les unités, périodes, règles de branchement et sens des indicateurs.
2. Fiabiliser le moteur avec des cas de référence : parcours simple, bifurcation, fusion, reliquat, cycle et données invalides. Corriger les interactions et examiner les dépendances signalées.
3. Livrer un parcours complet : créer, renseigner, relier, analyser une surcharge, sauvegarder et rouvrir sans perte. Fournir un exemple réaliste.
4. Reprendre l'interface : canevas central, palette compacte, inspecteur contextuel, analyse repliable ; annuler/rétablir et sauvegarde automatique.
5. Ajouter ensuite comparaison état actuel/scénario cible et export portable avec documents. Collaboration et assistance IA restent des extensions possibles.

## État livré

Dépôt récupéré avec son historique dans VSMv2 et version héritée exécutable. Aucun code applicatif modifié, aucun push ni déploiement. Le présent document prépare la refonte ; celle-ci n'est pas encore implémentée.


## Direction graphique confirmée

Référence fournie par Daniel : https://chatgpt.com/s/cx_6aaf7a0ffe20819181e6bb3ea459ef1e
Prototype lié, consulté visuellement : https://process-command-dh.danielherbera.chatgpt.site/

- Inspiration ComfyUI/n8n pour les interactions : grand canevas, nœuds reliés, zoom/pan, sélection et inspecteur latéral, barre d’outils et minimap.
- Esthétique de centre de commande stratégique, sci-fi sobre adaptée à un outil professionnel.
- Fond bleu-noir, grille de points discrète, cartes compactes bleu ardoise, bordures fines et accents désaturés cyan, violet, or et vert selon les catégories.
- Typographie hiérarchisée : titres de nœuds condensés, métadonnées petites et discrètes, données métier lisibles.
- Liens fins et courbes, ports visibles, sélection nette ; privilégier la lisibilité des branches.
- Commencer directement par les outils et le canevas : aucun grand bloc introductif en haut, conformément à la dernière demande de la discussion de référence.
- Adapter cette direction aux fonctions VSM : processing time, attentes, lead time, volumes et charge/ETP restent accessibles dans l’inspecteur et l’analyse.

Cette référence fixe la direction de la refonte ; le thème de l’application héritée n’a pas encore été modifié.


### Règle de disposition du graphe

Privilégier une progression horizontale de gauche à droite. Daniel rejette les étapes qui reviennent vers la gauche uniquement pour faire tenir le diagramme à l’écran, comme dans la référence AI Odyssey.

- Disposer les branches parallèles sur des lignes distinctes, toutes orientées de gauche à droite.
- Placer les étapes de convergence à droite des branches qui les précèdent.
- Étendre le canevas horizontalement et utiliser le déplacement, le zoom et la minimap plutôt que replier le parcours en serpentin.
- Réserver les connexions de retour aux véritables boucles métier (correction, reprise, nouvelle validation) et les identifier explicitement.
- Reprendre le style visuel du prototype AI Odyssey, sans reproduire son repli du parcours de publication vers la gauche.


## Première implémentation graphique

Thème sombre appliqué aux panneaux, cartes et connexions. Barre d’outils compacte, inspecteur contextuel, analyse repliable avec affichage explicite des attentes, exemple bancaire de 7 étapes et 7 connexions. Algorithme de disposition horizontale avec traitement explicite des cycles (position manuelle conservée). Placement par conversion des coordonnées du canevas. Timeline corrigée pour ne plus générer une largeur en pourcentage excessive. Erreurs de lint corrigées sans changement des formules métier.

Validation : lint et compilation réussis, tests du placement horizontal, branches, convergence, cycle, référence absente, graphe vide et immutabilité. Dans le navigateur : chargement de l’exemple, cadrage global, alignement, sélection et édition du libellé vérifiés. Aucun déploiement ni push.

## Bibliothèques et exécution

- Outils, acteurs (avec équipe et périmètre) et bases de connaissance sont des bibliothèques locales réutilisables. Elles sont incluses dans les fichiers VSM et fusionnées à l'ouverture sans supprimer les ressources locales sans rapport.
- Les références `toolsUsed`, `actorsUsed`, `knowledgeUsed` sont conservées dans chaque étape. Les boutons sous les cartes ouvrent un sélecteur ; les ressources peuvent aussi être glissées depuis la bibliothèque sur une carte. Détacher ne supprime pas la ressource.
- Les ressources sont rendues sous les étapes avec des ports en losange et des liens pointillés. Elles ne sont jamais incluses comme flux de volume.
- Les nouvelles étapes ont `executionMode: 'step'` : standard (notre équipe), actor (autre équipe), it (système), ai (agent). Toutes peuvent traiter un volume avec un cycle time. Les anciens acteurs/IT sans cette propriété conservent les calculs de support historiques. Le rôle reste configurable dans l'inspecteur.
- Le KYC fournit les trois bibliothèques et des étapes exécutées de chaque catégorie. Il s'agit de données illustratives.

## Remédiation du 20 septembre 2026

Audit puis correctifs prioritaires, un commit par point. Formules métier inchangées.

- Moteur pur : `calculateMetrics` ne modifie plus les nœuds fournis (`src/utils/calculations.js`).
- Arête vers une étape absente : marquée `isError` avec le libellé « Missing step », jamais parcourue, le reste du graphe est calculé.
- Boucle : les étapes hors tri topologique reçoivent l'erreur « Part of a loop: volume cannot be computed. », volume 0 ; leurs arêtes internes sont en erreur ; `metrics.cycleNodeIds` liste ces étapes.
- Valeurs non numériques : le moteur passe toute entrée par `num()` (NaN → 0) et l'inspecteur enregistre 0 pour un champ vidé (`toNumber` dans `PropertiesPanel.jsx`). La validation des sorties reste active.
- Suppression d'une étape : React Flow appelle `onEdgesChange` puis `onNodesChange` ; le store recalcule désormais sur un `remove` et efface la sélection si elle visait l'étape supprimée. `resetGraph` remet aussi la sélection à zéro.
- Import : `src/utils/projectSchema.js` (`validateProject`) vérifie et normalise le fichier avant `setGraph`. Nœud malformé → refus explicite ; arête orpheline ou en doublon → retirée avec avertissement. Les fichiers sans `meta` ou en `1.0` restent acceptés ; l'écriture passe en `meta.version = '2.0'`.
- Dépendances : `npm audit fix` sans rupture, 17 vulnérabilités corrigées, puis migration de jspdf 3.0.4 vers 4.2.1 (dernière vulnérabilité, critique). L'application n'utilise que `new jsPDF`, `addImage` et `save`, inchangés en v4 ; l'import passe sur l'export nommé `jsPDF`. `npm audit` : 0 vulnérabilité.
- Export PDF : jsPDF et html2canvas en `import()` dynamique ; chunk principal 1 041 kB → 451 kB, avertissement Vite disparu.

Tests : `tests/calculations.test.mjs` (immutabilité, arête orpheline, boucle, NaN) et `tests/projectSchema.test.mjs` (5 cas). Total 22 tests.

Vérifié dans le navigateur : suppression d'une étape (métriques recalculées, sélection effacée), champ vidé (0, pas de NaN), import d'un fichier invalide (alerte, pas d'écran d'erreur) et d'un fichier avec avertissement, chargement à la demande des chunks PDF. Note pour l'automatisation : dans un onglet Chrome masqué, `requestAnimationFrame` est gelé et les arêtes ne s'affichent qu'après un premier rendu.

Hors périmètre, à planifier : placement des étiquettes d'arêtes en O(E²), export PDF sans limite de taille, langue de l'interface, découpage de `PropertiesPanel.jsx`, `alert`/`confirm`/`console.log`, pièces jointes absentes du `.vsm`, quota localStorage des fichiers récents.

## Orientation et focus (20 septembre 2026)

- Palette et analyse repliées au démarrage, rail fin avec chevron (préférences `vsm.panel.v2.*`, l'ancienne clé est ignorée). Le chevron ou les boutons de la barre les déplient ; elles ne sont jamais retirées de l'écran.
- `layoutGraph(nodes, edges, { orientation })` dans `src/utils/layout.js` : axes abstraits flux / couloir projetés en x/y. `horizontalLayout` est conservé comme alias. Orientation mémorisée dans `vsm.orientation` ; un fichier ouvert garde ses positions jusqu'au prochain « Aligner ». Le basculement relance la disposition après remesure des cartes (double `requestAnimationFrame`), car leur forme change avec l'orientation.
- Focus (`src/utils/focus.js`, testé dans `tests/focus.test.mjs`) : le sélecteur **Focus** liste les outils, les acteurs internes et les équipes externes (acteurs `scope: 'external'` regroupés par champ Équipe). Une sélection allume les étapes qui utilisent la ressource (`node-lineage`), leurs connexions mutuelles (`edge-lineage`) et les satellites correspondants (`is-focused`) ; tout le reste est estompé (`node-dimmed` / `edge-dimmed`). La carte ne bouge pas. État de session, jamais sauvegardé.
- Une première version « couloirs » (swimlanes) a été livrée puis retirée le même jour : elle réorganisait la carte au lieu de montrer les interactions avec une ressource.
- Automatisation navigateur : un onglet Chrome masqué gèle `requestAnimationFrame` et étrangle `setTimeout` ; prendre une capture avant de mesurer, ne pas attendre dans le script.

### Ressources à côté, bouton « + » et suppression (20 septembre 2026)

- En horizontal, les ressources restent sous la carte (`data-layout=below`, formule d'origine pour `portOffset(node, false)`). En vertical, `.step-with-resources[data-layout=side]` transpose le bloc : les trois ports (Outils, Acteurs, Connaissances) sont accrochés au bord droit de la carte, une rangée chacun, et les satellites partent vers la droite avec leurs fils (`NodeResources` émet des chemins SVG horizontaux). La carte vient en premier : les ports de flux sont sur son axe médian (`portOffset(node, true) = 150`, largeur fixe de la carte).
- Le bouton « + » est à côté du port de sortie, décalé : à droite en horizontal, sous la carte en vertical ; `addNextNode` place la nouvelle étape dans le sens de lecture courant.
- Suppression : corbeille dans l'en-tête des cartes (étapes, entrées, sorties) avec `window.confirm`, puis bandeau « Annuler ». `src/utils/graphEdits.js` (`removeNodes`, `restoreRemoved`, testé dans `tests/graphEdits.test.mjs`) fait le travail ; le store garde `lastDeletion` (nœuds et connexions retirés), alimenté aussi par la suppression clavier de React Flow (les arêtes retirées d'abord sont mises en attente dans `pendingRemovedEdges`). Une restauration ignore les connexions dont l'autre extrémité a disparu entre-temps. Total 30 tests.

### Thème clair (20 septembre 2026)

- Toutes les couleurs codées en dur de `src/` (135 teintes, 349 occurrences, hors `src/data`) sont devenues des variables `--c-<hex>` définies dans `src/theme.css` : `:root` porte la palette sombre d'origine à l'identique, `:root[data-theme="light"]` sa correspondance claire (inversion de luminosité, accents assombris, neutres réglés à la main). Un thème est donc une seule table ; ajouter une couleur en dur réintroduit une valeur non thémée.
- Le store porte `theme` (`vsm.theme` en localStorage) et l'applique sur `<html data-theme>` dès le chargement pour éviter un flash. Bouton soleil / lune dans la barre. `color-scheme` suit le thème pour les champs natifs.
- Les points de grille et la minimap de React Flow reçoivent des couleurs concrètes selon le thème (attributs SVG, pas du CSS).
