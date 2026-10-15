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
