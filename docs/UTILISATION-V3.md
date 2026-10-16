# VSM Studio 3

## Commencer

L’application fonctionne localement dans le navigateur, sans compte. « Exemple » ouvre un nouveau projet KYC fictif. Les anciens projets restent dans **Projets & historique**. Les couleurs et bibliothèques existantes restent disponibles.

La barre **Atelier** ouvre un espace de travail distinct du rail : calculs et diagnostics, hypothèses et sources, scénarios, simulation, sous-processus, revue et analyse Codex.

## Sauvegarder et partager

Après une seconde d’inactivité, IndexedDB enregistre le projet complet. « Enregistré » confirme la transaction terminée. Le navigateur conserve les 50 dernières versions automatiques et toutes les versions nommées. Une restauration ajoute une version et conserve la version précédente.

**Projets & historique** permet d’ouvrir un projet local, nommer/restaurer une version et importer un `.vsm`. **File > Save As** exporte un fichier portable. L’export depuis l’historique inclut les versions nommées ; les versions automatiques restent locales. Les bibliothèques, logos personnalisés et scénarios sont embarqués. Les documents disponibles dans ce navigateur sont embarqués ; une liste avertit des références manquantes avant l’export.

Deux onglets peuvent consulter un même projet. Si les deux modifient une même révision, le second enregistrement est refusé : **Créer une copie de récupération** conserve ses modifications dans un nouveau projet. Fermer une fenêtre avant la fin de la sauvegarde n’est pas une confirmation d’enregistrement ; attendre l’indicateur ou exporter le fichier.

**Annuler / Rétablir**, ou Cmd/Ctrl-Z et Cmd/Ctrl-Shift-Z hors des champs de saisie, couvrent les modifications métier et le placement. Les versions nommées sont la référence durable entre sessions.

## Lire la carte

Par défaut, le flux se lit de gauche à droite. **Aligner** mesure les cartes, ressources et étiquettes puis propose un aperçu. Appliquer est annulable. Les étiquettes sont centrées sur une seule courbe de Bézier ; elles ne modifient pas sa forme. Un verrou conserve la position d’une étape. Une contrainte incompatible produit un diagnostic et la carte reste en place.

Les trois vues changent uniquement l’affichage :
- **Vue d’ensemble** : étapes et flux ;
- **Opérations** : indicateurs et ressources ;
- **Données détaillées** : tableaux complets.

Les positions sont conservées lors du changement de vue. En cas d’encombrement après agrandissement des cartes, utiliser Aligner. L’inspecteur reste accessible.

## Documenter et calculer

Les chiffres historiques restent calculés par `legacy-2`, avec leurs conventions d’origine. Ils sont signalés comme historiques. L’atelier fournit séparément `analytic-1` :
- charge = somme des volumes multipliés par les temps unitaires ;
- processing time par dossier = somme des temps unitaires traversés ;
- lead time = processing time + attentes du parcours ;
- moyenne des parcours pondérée par leur volume quand le calcul est possible.

Dans **Hypothèses & sources**, une valeur vide signifie inconnue. Indiquer explicitement zéro pour une attente supposée nulle. Statut, unité, périmètre, source, date et responsable sont enregistrés sans écraser les anciens champs. Les unités de temps prises en charge sont `min`, `h` et `s`.

Pour les acteurs, renseigner effectif et minutes disponibles par personne sur une période commune, puis les fractions d’affectation. Les fractions d’un acteur ne doivent pas dépasser 1. Un simple rattachement ne crée aucune disponibilité. Les capacités IT et agent sont des minutes de traitement disponibles sur la même période ; elles sont indépendantes des outils rattachés.

Le diagnostic sépare surcharge, charge, attentes déclarées et parcours le plus long. Il donne sa formule et ouvre l’objet dans l’inspecteur. Il n’invente aucune file d’attente à partir de la surcharge. Les boucles restent sauvegardables ; leur calcul est indisponible. Les calendriers complexes, files stochastiques et synchronisations parallèles ne sont pas simulés.

## Scénarios et simulation

Une référence **Actuel** est explicitement choisie. Dupliquer crée une cible indépendante avec les mêmes identifiants d’objets pour comparer. Les ressources sont copiées : modifier une cible ne modifie pas l’actuel. L’archivage masque conceptuellement un scénario sans le supprimer ; il reste accessible et exporté.

**Simulation** travaille sur une copie exploratoire. Filtrer les mesures, modifier temps, volumes, attentes, effectifs, capacités ou routages ; les calculs suivent immédiatement. **Réinitialiser** abandonne l’exploration. **Enregistrer en scénario** crée une cible. Le tableau de comparaison affiche des écarts, et le bouton de mise en évidence marque les étapes modifiées sur la carte.

## Sous-processus, revue et rapport

Sélectionner des étapes puis ouvrir **Sous-processus**, ou compléter la sélection dans l’atelier. Le modèle conserve les connexions internes, ports externes, paramètres, ressources et provenance. À l’insertion, choisir explicitement la correspondance de chaque catégorie. Les paramètres peuvent être adaptés ; la copie obtient de nouveaux identifiants. Raccorder ensuite ses ports dans la carte. Modifier un modèle n’actualise pas les copies existantes.

Les commentaires ciblent une étape, une connexion ou une hypothèse (`cycle:identifiant`, `wait`, etc.), avec auteur et statut. Les identifiants restent stables après déplacement et renommage. Une suppression de l’objet laisse son commentaire marqué comme référence supprimée.

Le parcours de présentation possède un ordre modifiable ; **Présenter**, puis **Précédent / Suivant**, centre les étapes. Le PDF contient une vue d’ensemble numérotée, les fiches détaillées, logos, hypothèses, comparaison avec l’actuel et commentaires sélectionnés. **Exporter le rapport PDF** prépare le document ; son lien permet de le télécharger.

## Codex et IA facultative

Dans **Analyse Codex**, saisir les contraintes, vérifier le dossier exact et l’exporter. Les pièces jointes, logos et champs arbitraires sont exclus. Les descriptions métier et sources choisies sont visibles avant transmission.

Demander à Codex d’analyser ce dossier et de produire un JSON conforme à `proposalTemplate`. Réimporter le JSON, puis **Valider et prévisualiser**. Le contrat exige la référence de scénario/révision, les objets concernés, une comparaison humain/IT/agent, les hypothèses, coûts, supervision et exceptions. Les propositions ne sont jamais exécutées comme code. Après validation explicite, l’application crée une nouvelle cible et recalcule ses gains.

Les connecteurs OpenAI, Claude et Gemini utilisent ce même contrat dans l’installation locale ; voir INSTALLATION-LOCALE.md. Aucun appel ne se lance automatiquement.

## Onglets de scénarios

Le pied de page contient les scénarios du projet. Un nouveau projet commence avec **Baseline**. Les noms des scénarios existants sont conservés. L’étoile indique la référence, indépendamment de son nom : vous pouvez renommer Baseline en Current State.

- Cliquez sur un onglet pour travailler sur sa carte. Double-cliquez, utilisez F2 ou le menu **… → Renommer** pour changer son nom. Les flèches gauche/droite du clavier parcourent les onglets.
- **+** crée une copie indépendante. La source proposée est la référence ; vous pouvez choisir un autre scénario. Le menu **… → Dupliquer cet onglet** présélectionne l’onglet actif.
- Les cartes, mesures, catégories, routages, acteurs, outils, connaissances et références documentaires sont copiés. Le contenu des pièces jointes est conservé par le stockage documentaire existant. Modifier une bibliothèque dans une copie ne modifie pas les autres scénarios.
- La première copie créée depuis les onglets ou la simulation conserve une version nommée **Point de départ** dans l’historique. Les sauvegardes et les fichiers VSM incluent tous les scénarios, y compris les onglets archivés. Le zoom et le niveau de détail sont des préférences locales par onglet.
- Le menu **…** permet aussi de définir la référence, d’archiver et de restaurer un onglet. Archiver l’onglet actif revient à la référence ; la référence ne peut pas être archivée.

### Comparer

**Comparer** ouvre deux cartes en lecture seule, superposées par défaut. Les sélecteurs **A** et **B** choisissent les scénarios ; les boutons du haut permettent la disposition côte à côte et le zoom/déplacement lié ou libre. La séparation entre les cartes est ajustable à la souris ou au clavier.

Cliquer sur une étape centre et sélectionne son équivalent dans les deux cartes, lorsqu’il existe. Les badges Ajouté, Modifié et Retiré conservent les couleurs métier des étapes. Les ressources affichées proviennent de leur propre scénario.

Le panneau **Indicateurs et détails**, repliable, affiche les différences et les écarts **B − A** pour la charge par période, le processing time, l’attente et le lead time par dossier. Un clic sur une différence centre les étapes concernées. Les étiquettes de flux recalculées ne sont pas comptées comme des changements métier. Une donnée inconnue ne devient pas zéro ; un pourcentage relatif à zéro n’est pas calculé.

### Simuler depuis un onglet

**Simuler** ouvre directement la simulation du scénario actif. L’exploration ne modifie pas la source tant que vous n’avez pas choisi **Appliquer à cet onglet** ou **Créer un onglet**. Les changements appliqués restent annulables avec l’historique métier.

## Éditer plusieurs scénarios ensemble

Le bouton **Édition liée**, dans la barre des onglets ou depuis la comparaison,
ouvre un atelier avec le **maître en haut** et les enfants en dessous. Les cartes
restent horizontales ; la navigation liée et la propagation des modifications
sont deux commandes séparées.

1. Choisissez le **VSM maître**. Ce rôle ne change pas le scénario de référence.
2. Ouvrez le sélecteur **enfant(s)** et cochez les variantes à afficher.
3. Activez **Édition liée**. Sélectionner une étape ou une connexion du maître
   sélectionne ses correspondants chez les enfants liés. L’inspecteur modifie le
   scénario dont le nom apparaît en tête.
4. Modifiez une valeur : sa nouvelle valeur est copiée dans les enfants liés.
   Les champs non modifiés restent propres à chaque enfant. Les résultats sont
   recalculés selon les volumes de chaque scénario.
5. **Cliquer une étape ou une connexion dans un enfant le délie immédiatement.**
   Son badge devient **INDÉPENDANT**. Ses modifications ne remontent pas au maître
   et ne touchent pas les autres enfants. Les actions sur ses ressources le délient
   également.

**Pause** conserve le groupe mais arrête la propagation. **Relier** un enfant ne
remplace pas ses différences existantes : seules les prochaines modifications
se propagent. **Réaligner…** présente au préalable les scénarios concernés ; il
remplace les champs des éléments communs, conserve les éléments propres à
l’enfant et ses commentaires, et ne réactive pas son lien.

La création d’étapes/connexions et la suppression passent par un aperçu. Une
suppression d’étape retire aussi ses connexions ; les commentaires restent
conservés et leurs références peuvent être signalées absentes dans la revue.
Une référence absente ne provoque pas de recréation automatique. Une catégorie
incompatible, une référence orpheline ou un chevauchement détecté bloque toute
la transaction, sans modification partielle.

Les positions restent locales sauf si **Lier aussi les positions** est coché.
Les positions verrouillées sont respectées. La vérification géométrique utilise
les dimensions observées des cartes et des estimations pour les étiquettes ;
elle signale les nouvelles collisions plutôt que de déformer les connexions.

**Annuler / Rétablir** dans l’atelier agit en une fois sur tous les scénarios de
l’opération. La saisie d’un champ est regroupée jusqu’à sa perte de focus. Annuler
une modification ne relie jamais automatiquement un enfant délié entre-temps.
Les raccourcis Ctrl/Cmd+Z et Ctrl/Cmd+Maj+Z fonctionnent hors des champs de saisie.

Le projet complet, ses ressources et le choix du groupe sont sauvegardés et
transportés dans le fichier VSM. À chaque réouverture de l’atelier, **la propagation
est en pause**. Il n’existe aucune propagation en arrière-plan hors de cet atelier.

## Sous-processus imbriqués (format 3.1)

La carte conserve son apparence et toutes les étapes métier. Cliquer sur **Sélection**, en bas à gauche de la carte, puis tracer un rectangle autour des étapes. La barre affiche le nombre d’éléments retenus : donner un nom si souhaité, puis cliquer sur **Regrouper** pour créer le cadre, ou **Annuler** pour quitter sans modification (Échap fonctionne aussi). Aucun raccourci clavier ni menu n’est nécessaire. Les éléments doivent être connectés et appartenir au même niveau ; sinon la validation reste désactivée avec une explication. Un groupe entièrement encadré compte comme un seul élément. **Annuler / Rétablir** reste disponible après validation.

Un cadre contient les étapes, leurs ressources et les connexions internes. Le chevron replie le cadre en carte de synthèse ; le bouton d’agrandissement ouvre son détail avec un fil d’Ariane. Les groupes peuvent être imbriqués. Les états ouverts/repliés restent des préférences locales, indépendantes des scénarios comparés et de l’édition liée.

**Dissocier** retire seulement le cadre. **Supprimer le contenu** retire les étapes et leurs connexions après aperçu ; les bibliothèques restent conservées. Les deux opérations, ainsi que le déplacement collectif et le regroupement, sont annulables. Un enfant verrouillé bloque le déplacement collectif. Le réagencement horizontal tient compte des cadres et des étiquettes ; s’il ne trouve pas de placement valide, il conserve la carte et affiche le diagnostic.

La synthèse analytique utilise le détail actif. La charge est additionnée une fois par étape élémentaire. Les volumes sont les passages aux frontières, par catégorie, et non une somme des volumes internes ni un décompte garanti de dossiers uniques. Processing time, attentes internes et lead time sont pondérés par les routages. Les attentes des connexions externes ne sont pas attribuées au groupe. Les ressources sont réunies par identifiant, avec les étapes utilisatrices dans l’inspecteur ; aucune capacité supplémentaire n’est créée. Les boucles et données inconnues sont signalées.

Pour détailler une étape, la sélectionner puis choisir **Détailler en sous-étapes**. Ajouter des cartes, modifier leurs propriétés, relier les étapes et associer chaque connexion externe à une étape interne. Les temps ne sont pas inventés. **Enregistrer le brouillon** conserve ce travail sans remplacer l’étape active ; attendre la confirmation de sauvegarde. **Vérifier les écarts** compare les résultats du scénario avant/après. L’activation nécessite des frontières et routages valides, et une acceptation explicite des indicateurs incomplets. L’étape initiale reste consultable comme référence. Une activation avec réagencement forme une seule opération annulable.

Dans l’édition liée, un changement de structure présente les scénarios concernés avant application. Un enfant incompatible bloque la transaction entière. Les brouillons sont préparés localement dans leur scénario ; seule leur activation proposée est répliquée. Modifier un enfant le délie. Les copies de scénarios, modèles réutilisables, fichiers VSM, commentaires, présentations et rapports conservent la hiérarchie. Le dossier d’analyse contient les groupes actifs, sans transmettre les brouillons ni les documents de référence.

Le format 3.1 contient toujours le graphe détaillé à plat. Les anciennes cartes n’acquièrent aucun groupe à l’ouverture. Le nouvel exemple KYC contient un groupe de constitution du dossier et deux sous-groupes.

Dans un brouillon, sélectionnez une sous-étape puis « Réutiliser les pièces jointes de référence » pour y rattacher les documents initiaux. Le tableau avant/après compare les volumes aux frontières, les délais et les ressources de l’étape détaillée.
