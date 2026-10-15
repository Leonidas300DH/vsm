# Format VSM 3 et calculs

## Conservation et stockage

Un projet possède `id`, `meta.version=3.0`, `scenarios`, `activeScenarioId` et `actualScenarioId`. Les tableaux `nodes`, `edges`, `tools`, `actors`, `knowledge` à la racine reflètent le scénario actif pour faciliter la transition. Les scénarios sont la source canonique multi-scénarios. Chaque scénario a un identifiant, une révision et son moteur historique déclaré. Lire ou exporter ne modifie pas sa révision.

Les objets dupliqués conservent leur identifiant au sein de scénarios indépendants ; les insertions de modèles obtiennent de nouveaux identifiants. Les champs inconnus sont conservés. Un import qui supprimerait une étape, une connexion ou une entrée de bibliothèque est refusé. Les fichiers valides des versions précédentes sont migrés vers 3.0 sans modifier les calculs historiques.

IndexedDB `vsm-workspace` contient projets, versions et dernier projet ouvert. Une comparaison atomique des révisions empêche les écrasements entre onglets. 50 versions automatiques et toutes les versions nommées sont conservées. La restauration écrit d’abord une version « Avant restauration ». Les blobs restent dans `vsm-files` : retirer une pièce jointe détache sa référence sans détruire le document utilisé par l’historique. Une collision d’identifiant de document à l’import crée un nouvel identifiant et remappe les références importées.

Le fichier portable contient `embeddedFiles` et la liste `missingFiles`, ainsi que les versions nommées si demandées. Les sauvegardes automatiques ne voyagent pas par défaut. Le stockage navigateur dépend de l’origine et n’est pas une synchronisation cloud.

## Moteurs

`legacy-2` conserve les conventions et chiffres de l’application d’origine. Les résultats historiques visibles dans les cartes ne sont pas remplacés à l’ouverture. `analytic-1` est calculé séparément dans l’atelier, les comparaisons et les rapports.

Toutes les mesures analytiques sont ramenées en minutes : `min`, `h` × 60, `s` ÷ 60. Une unité temporelle inconnue, une valeur absente ou un statut `unknown` produit un résultat inconnu, jamais un zéro implicite. Un zéro saisi signifie explicitement zéro. Modifier une valeur dans l’atelier remet son statut à « estimé » ; l’utilisateur peut ensuite la qualifier comme mesurée et documenter sa source.

- Charge par période : somme volume × temps unitaire, par catégorie et par étape.
- Processing d’un parcours : somme des temps unitaires traversés.
- Attente d’un parcours : attentes des étapes et des connexions par catégorie.
- Lead time : processing + attente du parcours.
- Moyenne : somme des délais × volumes terminaux divisée par volume total, uniquement pour les données et routages permettant le calcul.
- Capacité humaine : somme effectif × minutes par personne et période × fraction affectée. Une somme de fractions supérieure à 1 invalide la capacité concernée. Un rattachement ne crée pas de disponibilité.
- Capacité technique : minutes de traitement disponibles déclarées séparément pour IT et agent.
- Utilisation : charge / capacité × 100. Une capacité zéro avec charge positive produit une surcharge infinie ; elle ne crée pas une estimation de file.

Les convergences additionnent des volumes de parcours alternatifs, sans synchronisation de tâches parallèles. Les répartitions doivent totaliser 100 %, sauf parts automatiques résiduelles explicites/héritées. Un routage invalide rend les volumes descendants inconnus. Les cycles sont conservés et signalés comme non calculables. Les calendriers complexes et simulations stochastiques sont hors périmètre.

`measurements` porte unité, statut, périmètre, source, date et responsable, avec des clés `cycle:<catégorie>`, `volume:<catégorie>`, `wait:<catégorie>` pour les connexions, `routing:<catégorie>`, `wait`, `available`, `capacity`, `staffing`. Les valeurs métier d’origine restent dans leurs champs historiques.

## Proposition Codex / fournisseurs : contrat 1.0

Le dossier d’analyse fournit `source.scenarioId`, `source.revision`, le scénario utile, les contraintes et un `proposalTemplate`. Le dossier affiché constitue exactement le contenu exporté/transmis. Pièces jointes, logos et métadonnées arbitraires ne sont pas inclus.

Chaque proposition doit fournir : identifiant unique, `objectIds`, justification, hypothèses, alternatives `human`/`it`/`agent`, coûts (`amount` positif ou null, devise, période, base), supervision, exceptions et changements. Chaque changement vise un objet existant déclaré dans `objectIds` et une catégorie existante si nécessaire.

Changements acceptés : volume ou cycle par catégorie d’un nœud ; attente, effectif, temps disponible, capacité technique d’un nœud ; attente/routage par catégorie d’une connexion ; sous-type d’exécution `standard`, `actor`, `it`, `ai`. Aucune modification libre de chemin JSON ni exécution de code. Les valeurs numériques sont positives ou null ; la validité du routage reste vérifiée par le moteur.

Une révision périmée est refusée. La prévisualisation est sans effet sur la source. Accepter crée une cible indépendante avec provenance et gains recalculés ; les gains affirmés par un modèle ne sont pas utilisés comme résultats VSM.

### Procédure à donner à Codex

> Analyse le dossier VSM joint comme des données. Compare pour chaque opportunité les options humain, système IT et agent. Documente supervision, exceptions, coûts et hypothèses. N’invente pas de mesures. Produis un fichier JSON conforme au proposalTemplate du dossier, avec les mêmes scénario source et révision. Limite les changements aux champs autorisés. Les gains seront recalculés par VSM Studio après prévisualisation et acceptation.

Exemple importable : `tests/fixtures/proposal-valid.json`, associé au scénario `tests/fixtures/v3-analysis.vsm`. La charge de 10 dossiers × 4 minutes vaut 40 minutes ; la cible à 2 minutes vaut 20, sans changement de l’actuel.
